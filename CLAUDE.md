# CLAUDE.md

> This file teaches Claude how Branch works. Read it when working on this project.

## What Branch Is

Branch is a cloud markdown workspace with version history, local CLI sync, and AI collaboration. Every document has full change tracking, diffs, and rollback — whether edited by a human or a Claude.

**Tagline:** Git for documents. Built for humans and AI.

## Architecture

```
Browser/Claude → Vercel (Next.js) → Neon Postgres (metadata)
                                → GitHub API (content + history)

CLI → Vercel API → GitHub API

Claude Desktop → MCP Server (stdio) → Vercel API → GitHub API
```

- **Web app**: Next.js 16, React 19, Tailwind, deployed on Vercel
- **Auth**: Clerk (free tier, web + CLI browser redirect)
- **Database**: Neon Postgres via Drizzle ORM (users, workspaces, documents metadata)
- **Git engine**: GitHub Contents API (real Git commits, free private repos)
- **CLI**: Node.js, zero deps, published as `getbranch` on npm
- **MCP server**: Stdio transport, published as `branch-mcp` on npm

## How Data Flows

1. **User creates workspace** → DB record + private GitHub repo via API
2. **User saves document** → PUT to GitHub Contents API (real Git commit) + DB path/SHA update
3. **User reads document** → GET from GitHub Contents API (raw markdown)
4. **Version history** → GitHub Commits API
5. **CLI pull** → GET /api/workspaces/:id/pull → DB + GitHub → writes files to disk
6. **CLI push** → reads local files → PUT/POST to API → GitHub commits
7. **MCP tools** → stdio → Vercel API → GitHub API

## Key Files

| File | Purpose |
|------|---------|
| `web/src/lib/git-engine.ts` | GitHub API client — commitDocument, readDocument, listFiles, getLog, deleteDocument |
| `web/src/lib/db-helpers.ts` | Business logic — workspaces, documents, auth sync |
| `web/src/lib/auth-helpers.ts` | Clerk + Bearer token auth (`resolveUserId`) |
| `web/src/lib/api-logger.ts` | Route wrapper with auth, error handling, logging |
| `web/src/lib/logger.ts` | In-memory ring buffer (500 entries), /api/logs endpoint |
| `web/src/db/schema.ts` | Drizzle ORM schema — users, workspaces, documents |
| `web/src/proxy.ts` | Clerk middleware for Next.js 16 |
| `web/src/app/page.tsx` | Main UI — Google Docs-style markdown editor |
| `web/src/app/auth/cli/page.tsx` | CLI browser auth page |
| `packages/cli/src/index.js` | CLI — single file, zero deps, colored output |
| `packages/mcp/src/index.js` | MCP server — Claude-native document access |

## CLI Commands

```
branch login              Browser-based Clerk auth
branch whoami             Show current user and workspace
branch workspace list     List all workspaces
branch workspace <slug>   Set active workspace
branch pull               Download documents
branch status             Show local changes (colored A/M/D)
branch diff               Line-by-line diffs
branch push               Upload changes (--message, --author)
branch log                Version history (--oneline, --json)
branch open               Open workspace in browser
```

## MCP Tools

Claude Desktop connects via stdio. Env vars: `BRANCH_USER_ID`, `BRANCH_WORKSPACE`, `BRANCH_API_URL`.

| Tool | Description |
|------|-------------|
| `list_documents` | List all documents |
| `get_document` | Read content |
| `view_history` | Version history |
| `create_document` | Create new document |
| `update_document` | Update (AI-authored commit) |
| `propose_document_update` | Read current content to suggest edits |

## API Routes

All routes are `force-dynamic`. Auth via `resolveUserId()` (Clerk session OR Bearer token).

```
GET    /api/workspaces
POST   /api/workspaces
GET    /api/workspaces/:id/documents
POST   /api/workspaces/:id/documents
GET    /api/workspaces/:id/documents/:path
PUT    /api/workspaces/:id/documents/:path
DELETE /api/workspaces/:id/documents/:path
GET    /api/workspaces/:id/documents/:path/versions
GET    /api/workspaces/:id/documents/:path/diff?from=&to=
GET    /api/workspaces/:id/pull
GET    /api/logs?limit=50&level=error
GET    /api/me
```

## Auth Model

- **Web**: Clerk session cookie → `auth()` → userId
- **CLI**: `branch login` → browser redirect → `Bearer <userId>.cli`
- **MCP**: Env var `BRANCH_USER_ID` → `Bearer <userId>.cli`
- **Backend**: `resolveUserId()` checks Clerk session first, then Bearer token

## Environment Variables

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
DATABASE_URL                  Neon Postgres connection
GITHUB_TOKEN                  Personal access token with repo scope
GITHUB_OWNER                  GitHub username/org for workspace repos
NEXT_PUBLIC_APP_URL
```

## Development Commands

```bash
# Web app
cd web
npm run dev          Start dev server
npm run build        Production build
npm run lint         ESLint
npm run db:push      Push schema to Neon

# CLI
cd packages/cli
npm run check        Syntax check
npm i -g .           Install globally

# MCP server
cd packages/mcp
node src/index.js    Start server (needs env vars)
```

## Conventions

- API routes use `wrapHandler` — never write raw try/catch
- All routes export `export const dynamic = "force-dynamic"`
- Commits: conventional style (`feat:`, `fix:`, `docs:`)
- No keys in commits — `.gitignore` blocks `.env*`
- `resolveWorkspaceId()` handles slug → UUID transparently
- `ensureRepo()` creates GitHub repos lazily on first use
