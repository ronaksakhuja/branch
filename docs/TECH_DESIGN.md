# Technical Design

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                       Browser                           │
│  Next.js 16 · React 19 · Tailwind · ClerkProvider       │
└────────────┬────────────────────────────────────────────┘
             │ Clerk session cookie
             ▼
┌─────────────────────────────────────────────────────────┐
│                   Vercel (Serverless)                    │
│                                                         │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ proxy.ts │  │  API Routes  │  │  Auth Helpers    │  │
│  │ (Clerk)  │  │  (7 routes)  │  │  resolveUserId() │  │
│  └──────────┘  └──────┬───────┘  └──────────────────┘  │
│                       │                                  │
│              ┌────────▼────────┐                        │
│              │   db-helpers    │                        │
│              │  (abstraction)  │                        │
│              └───┬─────────┬───┘                        │
│                  │         │                             │
│         ┌────────▼──┐  ┌──▼───────────┐                │
│         │  Drizzle   │  │  git-engine  │                │
│         │  ORM       │  │  GitHub API  │                │
│         └─────┬──────┘  └──────┬───────┘                │
└───────────────┼────────────────┼────────────────────────┘
                │                │
                ▼                ▼
        ┌──────────────┐  ┌──────────────┐
        │ Neon Postgres │  │  GitHub API  │
        │               │  │  (PAT auth)  │
        │ users         │  │              │
        │ workspaces    │  │ branch-<id>  │
        │ documents     │  │ repos        │
        │ commit_       │  │              │
        │ annotations   │  │ markdown     │
        └──────────────┘  │ files        │
                          └──────────────┘
```

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | Next.js 16, React 19, Tailwind CSS | Server components, fast builds, utility CSS |
| Auth | Clerk | Free tier, prebuilt UI, middleware, API token support |
| Database | Neon Postgres + Drizzle ORM | Serverless Postgres, type-safe queries, free tier |
| Git Backend | GitHub API (Contents API) | Real Git, free private repos, zero infrastructure |
| Hosting | Vercel | Next.js native, free tier, edge functions |
| CLI | Node.js, zero deps | Single file, `npm i -g getbranch`, browser-based auth |
| Markdown | react-markdown + remark-gfm | GFM support, extensible |
| Logging | In-memory ring buffer | No external service, `/api/logs` endpoint |

---

## Data Model

### Postgres (metadata only)

```
users
  id: text (PK, Clerk user ID)
  email: text
  name: text
  created_at, updated_at: timestamp

workspaces
  id: text (PK, UUID)
  name: text
  slug: text (unique, URL-safe)
  owner_id: text → users.id
  created_at, updated_at: timestamp

workspace_members
  workspace_id, user_id (composite PK)
  role: owner | editor | viewer

documents
  id: text (PK)
  workspace_id: text → workspaces.id
  path: text (e.g. "startup/plan.md")
  title: text
  current_version_id: text (GitHub commit SHA)
  deleted_at: timestamp
  created_at, updated_at: timestamp
  INDEX (workspace_id, path)
```

### GitHub (content + history)

Each workspace → one private GitHub repo under `ronaksakhuja`.

```
ronaksakhuja/branch-<uuid>/
  ├── startup/
  │   ├── plan.md
  │   └── specs/
  │       └── mvp.md
  ├── finance/
  │   └── retirement.md
  └── personal/
      └── japan-trip.md
```

Git commit messages use structured trailers:

```
Updated MVP spec

Branch-Author-Type: AI
Branch-Author-Name: Claude
```

---

## Auth Flow

### Web

```
Browser → ClerkProvider → clerkMiddleware (proxy.ts)
                              │
                    Clerk session cookie
                              │
                    API route → auth() → userId
                              │
                    ensureUser() → sync to Postgres
```

### CLI

```
Terminal → branch auth
               │
               ▼
      Start local HTTP server on :9876
               │
               ▼
      Open browser → web-iota-ruby-62.vercel.app/auth/cli?port=9876
               │
               ▼
      Clerk session detected → redirect to localhost:9876?userId=user_xxx
               │
               ▼
      Save userId to .branch/config.json
               │
               ▼
      All CLI API calls: Authorization: Bearer <userId>.cli
```

---

## API Design

All routes are `force-dynamic`. Auth via `resolveUserId()` (checks Clerk session + Bearer token).

### Routes

| Method | Path | Auth | Operation |
|--------|------|------|-----------|
| GET | `/api/workspaces` | ✓ | List user's workspaces |
| POST | `/api/workspaces` | ✓ | Create workspace + GitHub repo |
| GET | `/api/workspaces/:id/documents` | ✓ | List documents in workspace |
| POST | `/api/workspaces/:id/documents` | ✓ | Create document (GitHub commit) |
| GET | `/api/workspaces/:id/documents/:path` | ✓ | Get document + versions |
| PUT | `/api/workspaces/:id/documents/:path` | ✓ | Update document (GitHub commit) |
| DELETE | `/api/workspaces/:id/documents/:path` | ✓ | Delete document (GitHub commit) |
| GET | `/api/workspaces/:id/documents/:path/versions` | ✓ | Version history (from GitHub) |
| GET | `/api/workspaces/:id/documents/:path/diff` | ✓ | Diff two versions |
| GET | `/api/workspaces/:id/pull` | ✓ | Pull all documents (CLI) |
| GET | `/api/logs` | ✓ | View API logs |
| GET | `/api/me` | ✓ | Current user info |
| GET | `/auth/cli` | Public | CLI browser auth page |

### Route Handler Pattern

```ts
export const GET = wrapHandler(async (req, { userId }) => {
  // Business logic
  return NextResponse.json(data);
});
```

`wrapHandler` handles:
- Auth resolution (`resolveUserId`)
- User sync (`ensureUser`)
- Error catching (returns `{ error }` with correct status)
- Logging (`log()` with timing)

### Slug → ID Resolution

Workspace URLs use slugs for readability but DB uses UUIDs. `resolveWorkspaceId()` transparently resolves:

```ts
// /api/workspaces/ronak/documents → workspace_abc123
const workspaceId = await resolveWorkspaceId("ronak");
```

---

## Git Engine

### GitHub API Operations

```
commitDocument() → PUT /repos/{owner}/{repo}/contents/{path}
                   Content: base64 encoded
                   Committer/author: from Clerk user
                   SHA from existing file for updates

readDocument()  → GET /repos/{owner}/{repo}/contents/{path}
                   Accept: application/vnd.github.raw+json
                   404 → null (file not found)

listFiles()     → GET /repos/{owner}/{repo}/git/trees/main?recursive=1
                   Filter: type=blob, endsWith(.md)

getLog()        → GET /repos/{owner}/{repo}/commits?path={path}

deleteDocument() → DELETE /repos/{owner}/{repo}/contents/{path}
                   Requires SHA from existing file
```

### Repo Naming

```
workspace UUID → branch-<uuid>
  workspace_abc123 → ronaksakhuja/branch-workspace-abc123
```

### Lazy Initialization

All operations call `ensureRepo()` first. If the repo doesn't exist, it's created:

```ts
async function ensureRepo(workspaceId: string) {
  const exists = await fetch(`/repos/${owner}/${repoName(workspaceId)}`);
  if (!exists.ok) await initWorkspaceRepo(workspaceId);
}
```

Existing workspaces get their repo on first document operation.

---

## CLI Design

Single file, zero dependencies, published as `getbranch` on npm.

```
branch auth       → Local HTTP server + browser redirect → saves userId
branch init       → Creates .branch/config.json
branch pull       → GET /api/workspaces/:id/pull → writes files to disk
branch status     → Local file comparison against pulled state
branch diff       → Local line-by-line diff
branch push       → PUT/POST/DELETE per changed file
branch history    → GET versions endpoint per document
```

### Config

```
.branch/
  config.json    → { userId, workspaceSlug, workspaceId, pulledState }
```

---

## Deployment

### Vercel (web)

```bash
cd web
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production
vercel env add CLERK_SECRET_KEY production
vercel env add DATABASE_URL production
vercel env add GITHUB_TOKEN production
vercel env add GITHUB_OWNER production
vercel --prod
```

### npm (CLI)

```bash
cd packages/cli
npm publish
```

---

## Security

| Concern | Solution |
|---------|----------|
| Web auth | Clerk handles OAuth, sessions, brute force protection |
| API auth | `resolveUserId()` checks Clerk session + Bearer token |
| CLI auth | Browser-based Clerk session transfer, no passwords |
| GitHub access | PAT stored as Vercel env var, never exposed to client |
| Repos | All private, created via server-side PAT |
| DB credentials | Neon connection string in Vercel env vars |
| Secrets in git | `.gitignore` blocks `.env*`, verified before each push |
| SQL injection | Drizzle ORM parameterized queries |
| Rate limiting | GitHub API: 5000/hr shared. Add Vercel rate limiting later |

---

## Key Decisions

| Decision | Rationale |
|----------|----------|
| GitHub API over isomorphic-git | Real Git, zero infrastructure, free. Migratable to Railway later. |
| Clerk over Auth.js | Prebuilt UI, middleware, free tier generous for MVP |
| Neon over Vercel Postgres | Not deprecated, same price, better DX |
| Single branch-data repo over per-workspace | Simplifies initial deployment. Per-workspace model ready to scale. |
| TypeScript in API, plain JS in CLI | API needs type safety. CLI benefits from zero build step. |
| In-memory logger over external | No cost, sufficient for MVP debugging |

---

## Migration Path

### GitHub API → Railway Git Server

When rate limits or latency become issues:

1. `git clone --mirror` each GitHub repo
2. Upload to Railway persistent volume
3. Update `git-engine.ts` to point to Railway
4. No UI, API, or CLI changes needed

### Repo-per-workspace → Single-org repos

If per-workspace repos become too many:

1. Move all workspace folders into one repo
2. Update `repoName()` logic in git-engine
3. Migrate existing repos with `git subtree`
