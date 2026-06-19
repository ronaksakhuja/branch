# Git Engine Migration Plan

## Why Git

Git is the most mature version control system on the planet. It handles:
- Content-addressed storage (every object has a SHA)
- Commit DAG (parent references, branches, merges)
- Line-by-line diffs
- Authorship and timestamps
- Push/pull over HTTP
- 20 years of edge cases solved

Branch using Git internally means:
- `branch diff` → `git diff` (already battle-tested)
- `branch history` → `git log` with structured trailers
- `branch rollback` → `git checkout <commit> -- <file>`
- Branches → actual Git branches (later)
- Merges → actual Git merges (later)
- CLI → `git clone` / `git pull` / `git push` (real Git, not our wrapper)

---

## Architecture

### Git as the content engine. Postgres as the metadata engine.

```
DB (Postgres)            Git Repo (bare)
─────────────────────    ─────────────────
users                    workspace.git/
workspaces               ├── objects/       (commits, trees, blobs)
workspace_members        ├── refs/heads/main
documents (path, sha)    └── HEAD
commit_annotations
share_links
```

**Git owns:**
- Document content (every version is a blob in Git)
- Version history (Git commits form the DAG)
- Diffs (git diff between any two commits)
- Rollbacks (git checkout any commit)
- Branches (future)

**Postgres owns:**
- Users and auth
- Workspace ownership
- Document paths and current SHA pointers
- Commit annotations (AI author type, model, summary)
- Permissions and sharing
- Search indexes

---

## Server-Side: isomorphic-git

### Why isomorphic-git

Vercel serverless functions have no persistent disk. We cannot run a bare
Git repo on the filesystem. `isomorphic-git` solves this — it's a pure
JavaScript Git implementation that reads/writes Git objects through a
pluggable filesystem layer.

```ts
import git from "isomorphic-git";
import http from "isomorphic-git/http/node";

// List files in the workspace (like git ls-tree)
const files = await git.listFiles({ fs, dir: "/repo" });

// Show a file at HEAD
const { blob } = await git.readBlob({ fs, dir: "/repo", oid: "HEAD", filepath: "startup/plan.md" });

// Commit a change
const sha = await git.commit({
  fs, dir: "/repo",
  message: "Updated MVP spec\n\nBranch-Author-Type: AI\nBranch-Author-Name: Claude",
  author: { name: "Claude", email: "claude@branch.ai" },
});
```

### Storage Backend: Vercel Blob (or S3)

Git objects (commits, trees, blobs) are stored as files in Vercel Blob:

```
blob: branch-git/workspace_123/objects/ab/cd123...
blob: branch-git/workspace_123/refs/heads/main
blob: branch-git/workspace_123/HEAD
blob: branch-git/workspace_123/index
```

isomorphic-git's `fs` layer is a custom adapter that reads/writes to Vercel
Blob instead of the filesystem.

```
git operations ──→ isomorphic-git ──→ fs adapter ──→ Vercel Blob
```

### Alternative: In-DB Git Objects

For a simpler MVP, store Git objects directly in Postgres:

```sql
CREATE TABLE git_objects (
  workspace_id TEXT NOT NULL,
  hash TEXT NOT NULL,
  type TEXT NOT NULL,  -- 'blob', 'tree', 'commit'
  content BYTEA NOT NULL,
  PRIMARY KEY (workspace_id, hash)
);

CREATE TABLE git_refs (
  workspace_id TEXT NOT NULL,
  ref TEXT NOT NULL,           -- 'refs/heads/main'
  target_hash TEXT NOT NULL,
  PRIMARY KEY (workspace_id, ref)
);
```

The `fs` adapter for isomorphic-git reads/writes to these Postgres tables.
This keeps everything in one database — no additional services.

**Decision:** Use in-DB Git objects for MVP. Vercel Blob for production
scale (blobs are cheaper than DB rows for binary data).

---

## Migration Path

### Phase 1: Create Git repos for existing workspaces

For each workspace, create the initial Git repo with all current documents
as the first commit.

```
workspace "ronak" (7 documents)
  ↓
git init --bare
  ↓
For each document:
  write file → git add → git commit
  Store commit_sha in DB
```

### Phase 2: Rewrite API routes

Current flow (DB):
```
GET /api/workspaces/:id/documents/:path
  → SELECT * FROM documents WHERE workspace_id = ? AND path = ?
  → SELECT * FROM document_versions WHERE document_id = ?
  → Return { content: version.content, versions }
```

New flow (Git):
```
GET /api/workspaces/:id/documents/:path
  → Look up workspace Git repo
  → git show HEAD:<path>   (via isomorphic-git)
  → git log --follow <path> (via isomorphic-git)
  → Return { content: blob, versions: parsed log }
```

### Phase 3: Update CLI

Current CLI:
```
branch pull  → GET /api/workspaces/:id/pull → write files to disk
branch push  → detect changes → PUT/POST/DELETE API calls
```

New CLI:
```
branch pull  → git clone <workspace-url>  (or git pull if exists)
branch push  → git add . → git commit → git push origin main
```

The CLI becomes a thin wrapper around real Git. No more custom diff engine,
no more change detection — Git handles it all.

### Phase 4: Deprecate DB version tables

After migration:
- `document_versions` table → replaced by Git commit history
- `documents.content` column → replaced by `git show`
- Keep `documents` table for path → SHA mapping and fast lookups

---

## Detailed Changes

### New dependencies

```bash
npm install isomorphic-git
```

### New files

```
web/src/
├── lib/
│   └── git-engine.ts        # isomorphic-git wrapper
├── db/
│   └── git-objects.ts       # PG tables for git objects + refs
```

### Modified files

```
web/src/lib/db-helpers.ts    # Rewrite to use git-engine instead of DB queries
web/src/app/api/...          # No changes needed (routes use db-helpers)
packages/cli/src/index.js    # Replace API calls with git clone/push
```

### DB schema changes

```sql
-- New tables
CREATE TABLE git_objects (...);
CREATE TABLE git_refs (...);

-- Modified
ALTER TABLE documents ADD COLUMN current_sha TEXT;
ALTER TABLE documents ADD COLUMN git_repo_path TEXT;

-- Deprecated (keep for migration, remove later)
-- document_versions table becomes read-only
```

---

## Rollout Strategy

1. **Parallel write**: Every API save writes to BOTH DB and Git. Read from Git.
2. **Validate**: Compare Git and DB versions for a week. No discrepancies.
3. **Switch**: Read from Git only. DB versions become read-only archive.
4. **Cleanup**: Remove DB version tables after 30 days.

---

## Testing Plan

### Unit tests (isomorphic-git)
- Initialize a repo
- Commit a document
- Read back the document
- Read version history
- Diff two versions
- Branch and merge

### Integration tests (API)
- Create workspace → Git repo exists
- POST document → Git commit created
- GET document → content from Git blob
- PUT document → new Git commit, parent references correct
- DELETE document → Git commit with empty file
- Pull workspace → all documents returned with correct SHAs

### CLI tests
- `branch init` + `branch pull` → local repo matches remote
- Local edit → `branch diff` shows changes
- `branch push` → remote gets new commit
- `branch history` → shows commits from both CLI and web

---

## Timeline

| Phase | Effort | Dependencies |
|-------|--------|-------------|
| isomorphic-git wrapper | 1 day | None |
| Git object storage (PG) | 0.5 days | wrapper |
| Rewrite db-helpers to use Git | 1 day | wrapper + storage |
| Update CLI to use real Git | 0.5 days | db-helpers |
| Migration script | 0.5 days | All above |
| Testing and deploy | 1 day | All above |

**Total: ~4.5 days**

---

## Risks

| Risk | Mitigation |
|------|-----------|
| isomorphic-git is slow for large repos | Workspaces are small (markdown files). Profile and optimize. |
| Vercel cold starts with Git operations | Cache frequently accessed objects in memory. |
| Blob storage costs for Git objects | In-DB storage is free for MVP scale. |
| Migration data loss | Parallel write during rollout. DB versions kept for 30 days. |
