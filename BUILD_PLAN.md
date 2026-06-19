# Branch Build Plan

## Current Status

**Web App** — Deployed on Vercel at https://web-iota-ruby-62.vercel.app
- Clerk auth (sign in/sign out)
- Neon Postgres via Drizzle ORM
- Workspace CRUD with slug→ID resolution
- Document CRUD with version history
- Google Docs-style UI with document cache
- API routes: workspaces, documents, versions, diff, pull
- In-memory logger with /api/logs endpoint

**CLI** — Published as `getbranch` on npm
- `branch auth` — browser-based Clerk session capture
- `branch pull/push/status/diff/history`
- Zero dependencies, single 12KB file
- Bearer token auth against web API

**CLI Auth Page** — `/auth/cli` redirect page for CLI browser auth

## Next Steps

1. API token management in web UI
2. Proper author names (not Clerk IDs)
3. Real-time collaboration
4. Git engine backend
5. MCP server for AI tools
6. Sharing and permissions
7. Mobile responsive UI
8. Homebrew formula

## Architecture

```
browser ──→ Vercel (Next.js) ──→ Neon Postgres
                  │
CLI ──→ /api/* ──┘
         (Bearer token auth)
```
