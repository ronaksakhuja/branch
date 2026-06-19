# Vision

**Branch is where knowledge lives.**

Not scattered across Claude threads, Google Docs, Notion pages, and local markdown files. In one place. With history. With the ability to roll back. With AI as a first-class collaborator, not an afterthought.

**Try it:** [branchcli.vercel.app](https://branchcli.vercel.app) · **CLI:** `npm i -g getbranch` · **GitHub:** [ronaksakhuja/branch](https://github.com/ronaksakhuja/branch)

---

## The Problem We Solve

### The loop nobody asked for

You ask Claude to draft a strategy memo. It writes markdown. You copy it into Google Docs. You make small tweaks — fix a number, add a bullet, rephrase a sentence. Then you need Claude to do a revision. You copy the Google Doc back into markdown. You paste it into Claude. "Here are my changes, now revise for XYZ." Claude outputs new markdown. You copy it into Google Docs again.

This loop repeats every time you iterate. With every cycle you lose:
- What changed between versions
- Which edits were yours vs. the AI's
- The reasoning behind any change
- Trust that you're working on the latest version

The document is never a living artifact — it's a series of disconnected snapshots.

### Existing tools miss the point

Google Docs is great for real-time typing, but AI doesn't use cursors. Notion is great for databases, but its markdown is an afterthought. GitHub is perfect for code, but nobody wants to teach a product manager `git rebase`. None of these tools treat AI as a collaborator — someone who reads, proposes, and commits changes with the same standing as a human.

### Why not just use GitHub?

Branch uses GitHub under the hood — every workspace is a real private Git repo. So why not use GitHub directly?

Because GitHub was designed for code, and most people who work with documents are not developers. They don't want to learn `git clone` or `git push`. They want to click a line and leave a comment. They want to share a read-only link that renders beautifully, like Google Docs. They want to see what changed without decoding a diff.

GitHub gives you the engine. Branch gives you the steering wheel, the dashboard, and a seat that feels familiar. Same power, zero learning curve.

The CLI is for those who want it — `branch push --author Claude` is a thin wrapper around `git commit`. AI agents use it. Developers use it. Everyone else uses the web UI. They're all working on the same Git repo. They just don't need to know it.

### AI needs context, not just content

When an AI reviews a document, it needs more than the current text. It needs to know what changed, why, and who made each decision. It needs the comment threads, the version history, the context of every revision. Without this, it's guessing. With it, it's informed.

### The future is AI-to-AI

Your AI and my AI will collaborate. Your AI reviews a document, sees the full commit history and comment threads, understands the context, and proposes changes. My AI reviews them. Humans stay in the loop — making the small judgment calls that only they can — but the heavy lifting happens between agents. Branch is the shared workspace where that conversation lives.

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

Where AI agents collaborate on your behalf — your AI reviews a document, sees every commit and comment for context, proposes changes, and my AI reviews. Humans make the judgment calls. Agents do the heavy lifting. Branch is the shared workspace where that conversation lives.

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
