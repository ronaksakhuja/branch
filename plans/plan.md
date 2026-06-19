# Plan

## What's Built

| Component | Status |
|-----------|--------|
| Web app (Next.js 16, Vercel) | Deployed |
| Auth (Clerk, web + CLI redirect) | Live |
| Database (Neon Postgres, Drizzle) | Live |
| API (workspaces, documents, versions, diff, pull) | Live |
| Google Docs-style UI (centered content, doc cache) | Live |
| CLI (published as `getbranch` on npm) | Live |
| CLI auth (browser redirect, `/auth/cli`) | Live |
| Logging (/api/logs, in-memory) | Live |
| Docs (wiki/PRD, wiki/VISION, wiki/BUILD_PLAN) | Done |
| Git repo (github.com/ronaksakhuja/branch) | Done |

---

## Next Sprint

### 1. Git engine backend (P0)
**Problem:** Current versioning is application-level in Postgres. We committed
to Git as the canonical engine from day one. DB-level versioning is missing
branches, merging, proper diffs, and ecosystem compatibility.
**Fix:** Each workspace gets a bare Git repo on the server. Web edits create
Git commits server-side. `branch pull` clones/pulls the repo. `branch push`
commits and pushes to the Branch remote. Postgres stores workspace metadata,
auth, and commit annotations — Git owns document content and history.

**Architecture:**
```
server: /repos/workspace_123.git          (bare repo)
CLI:    git clone → edit → git commit → git push origin main
web:    checkout → edit file → git add → git commit → push to bare
```

**Steps:**
- Add server-side bare repo management (create on workspace creation)
- Update API routes to read/write via `git show`/`git commit` instead of DB
- Server-side commits use `git -c user.name=... -c user.email=... commit`
- `branch diff` uses `git diff` (already done locally)
- `branch history` uses `git log` with structured trailers for AI metadata
- DB stores `commit_sha` references, not full content
- Migrate existing DB-stored versions into Git commits

### 2. Author display names
**Problem:** Documents show author as `user_3FMZ6T5QTnM5v7i4yKTkbkr1EEF` instead of
actual names.
**Fix:** Store author name from `--author` flag in CLI, display Clerk name for
web edits. Add `author_name` param to createDocument/updateDocument.

### 3. Delete documents from web UI
**Problem:** No way to delete a document from the browser.
**Fix:** Add delete button in document view (with confirmation). Wire to
`DELETE /api/workspaces/:id/documents/:path`.

### 4. Mobile responsive
**Problem:** Three-panel layout breaks on phones.
**Fix:** Stack panels vertically on small screens. Documents drawer becomes
full-screen overlay. Bottom bar stays fixed.

### 5. Document search
**Problem:** Can't search across documents in a workspace.
**Fix:** Add search input to top bar. With Git engine, use `git grep`. With
DB, use `ILIKE` on content.

### 6. Image support
**Problem:** Markdown images don't render.
**Fix:** Allow image uploads when saving documents. Store images in the Git
repo alongside markdown (or Vercel Blob). Render in markdown viewer.

---

## Medium Term

### 7. MCP server
**Problem:** AI tools (Claude, ChatGPT) can't access Branch documents
programmatically.
**Fix:** Build TypeScript MCP server exposing tools:
- `branch_list_documents`
- `branch_get_document`
- `branch_search_documents`
- `branch_propose_changes`
- `branch_commit_changes`

With Git engine, MCP tools wrap `git show`, `git log`, `git diff`, `git grep`.

### 8. Sharing and permissions
**Problem:** Workspaces are single-user only.
**Fix:** Add workspace members table with roles (viewer, editor, owner).
Share dialog generates invite links. Permissions enforced in API routes.

### 9. API token management
**Problem:** CLI auth uses Bearer token with userId, no tokens to manage.
**Fix:** Generate/revoke API tokens from web settings page. Token has scopes
(read, write). CLI uses proper token format instead of raw userId.

---

## Long Term

### 10. Obsidian plugin
Sync Branch workspace to Obsidian vault. Two-way sync with Git history.

### 11. Document branches
Actual Git branches for document variants. "Draft a new version of the
strategy doc without losing the current one."

### 12. Templates
Pre-built workspace templates (Startup, Investment Memo, Product Spec,
Trip Planner). One-click workspace creation.

### 13. Team workspaces
Organization accounts, billing, audit logs, SSO.

### 14. Public sharing
Share a document as a public read-only page with beautiful rendering.
Like a Notion public page but markdown-native.

### 15. AI auto-commit
Trusted AI models can commit directly without human review. Configurable
per workspace. "Claude, update the budget section and push."

---

## Technical Debt

| Item | Priority |
|------|----------|
| Remove unused imports from API routes (9 lint warnings) | Low |
| Add proper TypeScript types for API responses | Medium |
| Move `computeDiff` to shared lib | Low |
| Add rate limiting to API routes | Medium |
| Add automated tests (API + UI) | High |
| CI/CD pipeline (GitHub Actions) | Medium |
| Database migrations versioning | Low |

---

## Immediate Actions

1. Fix author display names → show `--author` value or Clerk name
2. Add delete button to web UI
3. Make layout mobile responsive
4. Add full-text search across documents
