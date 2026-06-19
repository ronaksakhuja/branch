# Technical Design

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Claude Desktop / AI                       │
│                  (MCP Server via stdio)                      │
└────────────────────┬────────────────────────────────────────┘
                     │ MCP tools (list, get, create, update)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                       Browser                               │
│  Next.js 16 · React 19 · Tailwind · ClerkProvider           │
└────────────┬────────────────────────────────────────────────┘
             │ Clerk session cookie
             ▼
┌─────────────────────────────────────────────────────────────┐
│                   Vercel (Serverless)                        │
│                                                             │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ proxy.ts │  │  API Routes  │  │  Auth Helpers         │  │
│  │ (Clerk)  │  │  (8 routes)  │  │  resolveUserId()      │  │
│  └──────────┘  └──────┬───────┘  └──────────────────────┘  │
│                       │                                      │
│              ┌────────▼────────┐                            │
│              │   db-helpers    │                            │
│              │  (abstraction)  │                            │
│              └───┬─────────┬───┘                            │
│                  │         │                                 │
│         ┌────────▼──┐  ┌──▼───────────┐                    │
│         │  Drizzle   │  │  git-engine  │                    │
│         │  ORM       │  │  GitHub API  │                    │
│         └─────┬──────┘  └──────┬───────┘                    │
└───────────────┼────────────────┼────────────────────────────┘
                │                │
                ▼                ▼
        ┌──────────────┐  ┌──────────────┐
        │ Neon Postgres │  │  GitHub API  │
        │               │  │  (PAT auth)  │
        │ users         │  │              │
        │ workspaces    │  │ branch-<id>  │
        │ documents     │  │ repos        │
        └──────────────┘  │              │
                          │ markdown     │
                          │ files        │
                          └──────────────┘

┌─────────────────────────────────────────────────────────────┐
│                          CLI                                 │
│  Node.js · zero deps · npm: getbranch                       │
│  branch login → browser Clerk auth → saves userId           │
│  branch pull / push / status / diff / log                   │
└─────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | Next.js 16, React 19, Tailwind CSS | Server components, fast builds, utility CSS |
| Auth | Clerk | Free tier, prebuilt UI, middleware, browser-based CLI auth |
| Database | Neon Postgres + Drizzle ORM | Serverless Postgres, type-safe queries, free tier |
| Git Backend | GitHub API (Contents API) | Real Git, free private repos, zero infrastructure |
| Hosting | Vercel | Next.js native, free tier, edge functions |
| CLI | Node.js, zero deps | Single file, `npm i -g getbranch`, colored output |
| MCP Server | MCP SDK + Zod | Claude-native document access via stdio |
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
  id: text (PK)
  name: text
  slug: text (unique)
  owner_id: text → users.id
  created_at, updated_at: timestamp

workspace_members
  workspace_id, user_id (composite PK)
  role: owner | editor | viewer

documents
  id: text (PK)
  workspace_id: text → workspaces.id
  path: text
  title: text
  current_version_id: text (GitHub commit SHA)
  deleted_at: timestamp
  created_at, updated_at: timestamp
```

### GitHub (content + history)

One private repo per workspace under `ronaksakhuja`:

```
ronaksakhuja/branch-<uuid>/
  ├── startup/plan.md
  ├── finance/retirement.md
  └── personal/notes.md
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
Browser → ClerkProvider → proxy.ts (clerkMiddleware) → Clerk session cookie → API auth()

### CLI
```
branch login
  → start HTTP server on random port
  → open browser → /auth/cli?port=XXXX
  → Clerk session detected → redirect to localhost:XXXX?userId=xxx
  → save userId to .branch/config.json
  → API calls: Authorization: Bearer <userId>.cli
```

### MCP Server
```
Claude Desktop → stdio → branch-mcp process
  → reads BRANCH_USER_ID, BRANCH_WORKSPACE from env
  → API calls: Authorization: Bearer <userId>.cli
```

---

## API Design

All routes are `force-dynamic`. Auth via `resolveUserId()` (Clerk session + Bearer token).

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/workspaces` | List/create workspaces |
| GET/POST | `/api/workspaces/:id/documents` | List/create documents |
| GET/PUT/DELETE | `/api/workspaces/:id/documents/:path` | Get/update/delete document |
| GET | `/api/workspaces/:id/documents/:path/versions` | Version history |
| GET | `/api/workspaces/:id/documents/:path/diff` | Diff two versions |
| GET | `/api/workspaces/:id/pull` | Pull all documents (CLI) |
| GET | `/api/logs` | View API logs |
| GET | `/api/me` | Current user info |
| GET | `/auth/cli` | CLI browser auth page (public) |

### Route Handler Pattern

```ts
export const GET = wrapHandler(async (req, { userId }) => {
  return NextResponse.json(data);
});
```

`wrapHandler` handles auth, user sync, error catching, and logging with timing.

---

## Git Engine

GitHub Contents API used as the document storage layer:

```
commitDocument() → PUT /repos/{owner}/{repo}/contents/{path}
readDocument()  → GET /repos/{owner}/{repo}/contents/{path}
listFiles()     → GET /repos/{owner}/{repo}/git/trees/main?recursive=1
getLog()        → GET /repos/{owner}/{repo}/commits
deleteDocument() → DELETE /repos/{owner}/{repo}/contents/{path}
```

All operations map to real Git commits. Repos are created lazily on first use. Each workspace → one private GitHub repo.

### Migration Path

When rate limits or latency become issues, migrate to a dedicated Railway Git server by exporting GitHub repos and updating `git-engine.ts`. No API or UI changes needed.

---

## CLI Design

Single 13KB file, zero dependencies, published as `getbranch` on npm.

### Commands

```
branch login              Authenticate via browser → Clerk session
branch whoami             Show current user and workspace
branch workspace list     List all workspaces
branch workspace <slug>   Set active workspace
branch pull               Download documents from cloud
branch status             Show local changes (A/M/D with colors)
branch diff               Line-by-line diffs with colors
branch push               Upload local changes to cloud
branch log [--oneline]    Version history
branch open               Open workspace in browser
```

### Flags

`--message/-m`, `--author/-a`, `--json`, `--oneline`

### Config

```
.branch/config.json → { userId, workspaceSlug, workspaceId, pulledState }
```

---

## MCP Server

Claude-native document collaboration via MCP stdio transport.

### Tools

| Tool | Description |
|------|-------------|
| `list_documents` | List all documents in workspace |
| `get_document` | Read full content of a document |
| `view_history` | Version history with author/date |
| `create_document` | Create a new markdown document |
| `update_document` | Update existing document (AI-authored) |
| `propose_document_update` | Read current content to suggest changes |

### Claude Desktop Config

```json
{
  "mcpServers": {
    "branch": {
      "command": "node",
      "args": ["/path/to/branch/packages/mcp/src/index.js"],
      "env": {
        "BRANCH_USER_ID": "user_xxx",
        "BRANCH_WORKSPACE": "personal-finance",
        "BRANCH_API_URL": "https://branchcli.vercel.app"
      }
    }
  }
}
```

Place at `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS).

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
cd packages/cli && npm publish
```

### npm (MCP Server)

```bash
cd packages/mcp && npm publish
```

---

## Security

| Concern | Solution |
|---------|----------|
| Web auth | Clerk handles sessions, brute force protection |
| API auth | resolveUserId() checks Clerk + Bearer token |
| CLI auth | Browser-based Clerk session transfer |
| GitHub access | PAT stored as Vercel env var, never client-side |
| Repos | All private, created server-side |
| DB credentials | Neon connection string in Vercel env |
| Secrets in git | .gitignore blocks .env*, verified before pushes |
| SQL injection | Drizzle ORM parameterized queries |

---

## Key Decisions

| Decision | Rationale |
|----------|----------|
| GitHub API over isomorphic-git | Real Git, free, zero infra. Migratable to Railway. |
| Clerk over Auth.js | Prebuilt UI, middleware, browser-based CLI auth |
| Neon over Vercel Postgres | Not deprecated, same price, better DX |
| MCP over custom integration | Claude-native, stdio transport, zero setup |
| TypeScript in API, JS in CLI/MCP | API needs type safety. CLI benefits from zero build. |
| In-memory logger over external | Free, sufficient for MVP |

---

## Project Structure

```
branch/
├── docs/
│   └── TECH_DESIGN.md
├── wiki/
│   ├── PRD.md
│   ├── VISION.md
│   └── BUILD_PLAN.md
├── plans/
│   ├── plan.md
│   └── git-engine.md
├── web/                    Next.js app
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx           Google Docs-style UI
│   │   │   ├── layout.tsx         ClerkProvider
│   │   │   ├── api/               API routes
│   │   │   └── auth/cli/          CLI browser auth page
│   │   ├── db/schema.ts           Drizzle schema
│   │   ├── lib/
│   │   │   ├── api.ts             Client helpers
│   │   │   ├── api-logger.ts      Route wrapper
│   │   │   ├── auth-helpers.ts    Clerk + token auth
│   │   │   ├── db-helpers.ts      DB operations
│   │   │   ├── git-engine.ts      GitHub API client
│   │   │   └── logger.ts          In-memory logger
│   │   └── proxy.ts              Clerk middleware
│   └── drizzle.config.ts
├── packages/
│   ├── cli/                Published as getbranch
│   └── mcp/                Published as branch-mcp
└── README.md
```
