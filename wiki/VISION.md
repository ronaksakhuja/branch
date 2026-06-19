# Vision

**Branch is where knowledge lives.**

Not scattered across Claude threads, Google Docs, Notion pages, and local markdown files. In one place. With history. With the ability to roll back. With AI as a first-class collaborator, not an afterthought.

**Try it:** [branchcli.vercel.app](https://branchcli.vercel.app) · **CLI:** `npm i -g getbranch` · **GitHub:** [ronaksakhuja/branch](https://github.com/ronaksakhuja/branch)

---

## The Problem We Solve

### Documents are now co-authored by humans and AI

You ask Claude to draft a strategy memo. You refine it. Claude revises it. You share it with a colleague. They edit it. Claude proposes more changes. Before you know it, there are six versions spread across three tools and nobody knows which is current.

### Existing tools were built for a world without AI

Google Docs is great for real-time typing, but AI doesn't use cursors. Notion is great for databases, but its markdown export is an afterthought. Git is perfect for code, but nobody wants to explain `git rebase` to a product manager. None of these tools treat AI as a collaborator with equal standing — the ability to read, propose, and commit changes with attribution.

### Knowledge has no home

Your documents are scattered. There is no single place where all your important thinking lives, versioned, searchable, and accessible to both you and your AI tools. Branch is that home.

---

## What Branch Is

Branch is a **cloud markdown workspace** where every document has full version history, every change is attributed (human or AI), and every version is reviewable and restorable.

Under the hood, every workspace is a real Git repository. Real commits. Real diffs. Real rollbacks. But the interface is document-native — it feels like reading and writing, not like version control.

### Three surfaces, one product

| Surface | For |
|---------|-----|
| **Web app** | Reading, writing, reviewing, sharing. Google Docs-like, Apple-inspired design. |
| **CLI** | Local editing, AI agents. `branch pull`, `branch diff`, `branch push --author Claude`. |
| **MCP server** | Claude Desktop native access. Six tools. Direct read/write/commit from Claude. |

---

## How Branch Works

### A workspace is a Git repo

When you create a workspace, Branch creates a private GitHub repository. Every document save is a Git commit. Every version is a commit in the log. Every diff is a real `git diff`. You get the full power of Git — branches, merging, history — without ever touching a terminal.

### Every change is reviewable

Open any document and see its version history in the right sidebar. Click any version to see what changed. Restore with one click. You never wonder what AI changed or how to get back.

### AI is a first-class collaborator

Claude, ChatGPT, Gemini — they read documents through the CLI or MCP. They propose changes. You review. They commit. The version history shows "Author: Claude" next to "Author: Ronak." AI is not an integration — it's a user.

### Sharing that works

Create a read-only link for any document. Send it to anyone. They see a beautifully rendered page — no sign-in required. Invite collaborators to your workspace. They get edit access. It's Google Docs sharing with Git underneath.

---

## The Product Today

We've built:

- **Web app** — Next.js on Vercel, Clerk auth, Neon Postgres, GitHub API backend
- **Three-view UX** — Home (workspace cards), Workspace (document grid), Document (editor with version sidebar)
- **CLI** — Published as `getbranch` on npm. Browser-based auth. `pull`, `push`, `diff`, `log`, `status`
- **MCP server** — Published as `branch-mcp`. Six tools for Claude Desktop
- **Collaboration** — Invite-by-email, workspace members, roles, pending invites
- **Sharing** — Read-only links with beautiful public pages
- **Landing page** — Explains the product to new users
- **Logging** — In-memory ring buffer at `/api/logs`

---

## The Product Promise

> **Never lose your edits. Never wonder what AI changed.**

Every document in Branch has a complete, attributed history. You can see who changed what, when, and why. You can restore any version. You can share with confidence. AI and humans edit the same source of truth.

---

## What Branch Is Not

Branch is not:
- A Google Docs replacement — we are not building real-time multiplayer editing
- A Notion clone — we are not building databases, kanban boards, or wikis
- A Git client — Git powers the engine, but the UX hides it
- An AI platform — you bring your own models, we don't lock you in

Branch is the home for your important documents. The ones you edit over weeks and months. The ones AI helps you write. The ones you need to revisit, revise, and share.

---

## Long-Term Vision

### Today: Personal knowledge
A single user, their workspace, their documents, their AI tools. Versioned. Reviewable. Shareable.

### Tomorrow: Team knowledge
Shared workspaces with permissions. A team's strategy docs, specs, decisions, and research — living in Branch instead of scattered across Slack, Notion, and Google Drive.

### The future: The home for knowledge
Where you store, evolve, and revisit important thinking. Personal. Professional. Team. Organizational. Every document is a living artifact with history, context, and provenance.

---

## Principles

1. **Documents are markdown** — portable, universal, AI-readable
2. **Git underneath, document on top** — real version control, zero learning curve
3. **AI is a first-class user** — read, propose, commit, with attribution
4. **Humans stay in control** — review before commit, rollback anytime
5. **No lock-in** — your documents, your models, your tools
6. **Beautiful by default** — Apple-inspired design, content-first, intuitive

---

## Try It Now

**[branchcli.vercel.app](https://branchcli.vercel.app)** — Sign in, create a workspace, start writing.

**CLI in 10 seconds:**
```bash
npm i -g getbranch
branch login
branch workspace list
branch pull
branch push -m "Hello world" -a Ronak
```

**Claude Desktop (MCP):** Add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "branch": {
      "command": "node",
      "args": ["/path/to/branch/packages/mcp/src/index.js"],
      "env": {
        "BRANCH_USER_ID": "<your-user-id>",
        "BRANCH_WORKSPACE": "<workspace-slug>"
      }
    }
  }
}
```
