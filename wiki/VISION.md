# Vision

**Branch is the home for knowledge.**

GitHub became the home for code. Branch becomes the home for everything else
— strategy, research, decisions, plans, specs, and ideas that humans and AI
create together.

---

## The Problem

### Documents are dying

Every day, people use AI to create important documents. Claude writes a
strategy memo. ChatGPT drafts a research plan. A founder refines it in Google
Docs. Then they paste it back into Claude for the next iteration.

This creates disconnected copies. The original markdown, the Google Doc
version, the Claude revisions, the exported PDF — each is a snapshot that
drifts from the others. Nobody knows which is current.

### Knowledge becomes fragmented

Over weeks and months, the problem compounds:

- **Lost history** — you do not know what changed, when, or by whom
- **Lost context** — the AI's original reasoning is gone, replaced by flat text
- **Lost trust** — you hesitate to let AI edit because you fear losing your work
- **Lost collaboration** — humans and AI work on competing copies, never the same document

### The loop nobody asked for

```
Claude → Markdown → Google Docs → Human edits → Claude → New markdown → Manual merging
```

Documents become dead artifacts instead of living knowledge.

---

## Why Existing Tools Fall Short

| Tool | What it does well | What it misses |
|------|-------------------|----------------|
| Google Docs | Real-time collaboration | No markdown, no AI workflow, version history is buried |
| Notion | Rich documents, databases | Proprietary format, no CLI, limited AI integration |
| Obsidian | Local markdown, linked thinking | No cloud sync, no AI commit log, no sharing without plugins |
| GitHub | Version control | Built for code, intimidating for non-devs, no markdown viewer |
| Git (raw) | Perfect history | No web UI, no non-technical UX, AI tools do not integrate natively |

None of them are designed for the human + AI editing loop.

---

## The Insight

**Documents should behave like code.**

Code has:
- Version history (git log)
- Change reviews (diffs, PRs)
- Rollbacks
- Authorship per change
- A single source of truth
- Branching and merging

Documents deserve the same. But the interface must be document-native, not
developer-native. A markdown viewer that feels like reading, not like a code
editor. A version history that reads like a changelog, not `git log --oneline`.

---

## How Branch Solves It

### One source of truth

Every document lives in a Branch workspace. Markdown is the canonical format —
portable, AI-readable, and human-editable. No more competing copies.

### Every change is reviewable

When you or an AI edits a document, Branch records:
- Who made the change (Human, Claude, ChatGPT)
- What changed (line-by-line diff)
- Why (human-readable summary)
- When

You never wonder what AI changed or how to get back to a previous version.

### Humans and AI edit the same document

AI tools connect through the CLI, local files, or MCP. They read, search,
propose, and (when trusted) commit changes. Humans review in the web app.

### No lock-in

Documents are markdown. Your knowledge is portable. Bring your own AI model.
Switch providers tomorrow. The documents remain yours.

### CLI for power users and AI

```bash
branch pull           # download workspace
branch diff           # inspect changes (also --json for agents)
branch push           # commit with attribution
branch history        # full version log
```

AI coding agents (Claude Code, Cursor, Copilot) can read and edit local
markdown files, then use the CLI to inspect and push changes.

---

## The Product Promise

**Never lose your edits. Never wonder what AI changed.**

---

## What Branch Is Not

- Not a Google Docs replacement for real-time multiplayer editing
- Not a Notion clone for databases and project management
- Not a Git client — Git powers the engine, but the UX is document-first
- Not an AI platform — it works with any model, it does not lock you in

---

## Long-Term Vision

### Phase 1: Trusted AI Documents (now)

Version-controlled markdown workspaces where humans and AI can safely edit
the same documents.

### Phase 2: Team Knowledge (next)

Shared workspaces, permissions, and review workflows. A team's strategy docs,
specs, and decisions live in Branch instead of scattered across Slack, Notion,
and Google Drive.

### Phase 3: The Home for Knowledge (future)

Branch is where you store, evolve, and revisit important thinking. Personal.
Professional. Team. Organizational. Every document is a living artifact with
history, context, and provenance.

GitHub made code collaborative and versioned. Branch makes knowledge
collaborative and versioned — between humans, and between humans and AI.

---

## Principles

1. **Documents are markdown** — portable, universal, AI-native
2. **History is non-negotiable** — every change is tracked, attributed, reversible
3. **AI is a first-class collaborator** — not an afterthought or integration
4. **Humans stay in control** — review before commit, rollback anytime
5. **No lock-in** — your documents, your models, your tools
6. **UI is document-native** — it should feel like reading and writing, not like version control
