# Branch

**Git for documents. Built for humans and AI.**

Branch is a cloud markdown workspace with version history, local CLI sync, and AI collaboration. Every document has full change tracking, diffs, and rollback — whether edited by a human or an AI.

Live at **[web-iota-ruby-62.vercel.app](https://web-iota-ruby-62.vercel.app)**

---

## Quick Start

### Web App

```bash
git clone git@github.com:ronaksakhuja/branch.git
cd branch/web
cp .env.local.example .env.local
# Fill in your Clerk keys and Neon DATABASE_URL
npm install
npm run db:push
npm run dev
```

Open `http://localhost:3000`, sign in, create a workspace.

### CLI

```bash
npm i -g getbranch
branch auth              # opens browser, authenticates via Clerk
export BRANCH_WORKSPACE=my-workspace
branch pull              # downloads markdown files
branch status            # see local changes
branch diff              # view detailed diffs
branch push --author Claude --summary "Updated plan"
branch history           # view version history
```

Agent-friendly JSON output:

```bash
branch status --json
branch diff --json
branch history --json
```

---

## Architecture

```
browser ──→ Vercel (Next.js 16) ──→ Neon Postgres
                 │
CLI ──→ /api/* ──┘
         Bearer token
```

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS |
| Auth | Clerk (web + CLI browser redirect) |
| Database | Neon Postgres + Drizzle ORM |
| Hosting | Vercel |
| CLI | Node.js, zero deps, published as `getbranch` |
| Markdown | react-markdown + remark-gfm |
| Logging | In-memory logger at `/api/logs` |

---

## Deploy

### 1. Web App (Vercel)

```bash
cd web

# Set environment variables
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production
vercel env add CLERK_SECRET_KEY production
vercel env add DATABASE_URL production

# Push DB schema
npm run db:push

# Deploy
vercel --prod
```

Required env vars:

| Variable | Source |
|----------|--------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | [clerk.com](https://clerk.com) dashboard |
| `CLERK_SECRET_KEY` | [clerk.com](https://clerk.com) dashboard |
| `DATABASE_URL` | [neon.tech](https://neon.tech) connection string |

Clerk configuration:
- Add your Vercel URL to **Allowed Origins** in Clerk dashboard
- Enable **Email/Password** or **Social SSO** in Clerk **User & Authentication**

### 2. CLI (npm)

```bash
cd packages/cli
npm publish
```

The CLI is a single 12KB file with zero dependencies. Requires Node.js >= 18.

To test locally without publishing:

```bash
node packages/cli/src/index.js auth
export BRANCH_WORKSPACE=your-workspace
node packages/cli/src/index.js pull
```

---

## API

All routes are protected. Web users use Clerk session cookies, CLI users use `Bearer <userId>.cli`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET/POST` | `/api/workspaces` | List / create workspaces |
| `GET/POST` | `/api/workspaces/:id/documents` | List / create documents |
| `GET/PUT/DELETE` | `/api/workspaces/:id/documents/:path` | Get / update / delete |
| `GET` | `/api/workspaces/:id/documents/:path/versions` | Version history |
| `GET` | `/api/workspaces/:id/documents/:path/diff?from=&to=` | Compare versions |
| `GET` | `/api/workspaces/:id/pull` | Pull all documents (CLI) |
| `GET` | `/api/logs?limit=50&level=error` | View API logs |
| `GET` | `/api/me` | Current user info |

---

## Project Structure

```
branch/
├── web/                    # Next.js app
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx           # Main UI (Google Docs-style)
│   │   │   ├── layout.tsx         # Clerk provider
│   │   │   ├── api/               # API routes
│   │   │   │   ├── workspaces/
│   │   │   │   ├── logs/
│   │   │   │   └── me/
│   │   │   └── auth/cli/          # CLI browser auth page
│   │   ├── db/
│   │   │   ├── schema.ts          # Drizzle schema
│   │   │   └── index.ts           # DB connection
│   │   ├── lib/
│   │   │   ├── api.ts             # Client API helpers
│   │   │   ├── api-logger.ts     # Route wrapper with logging
│   │   │   ├── auth-helpers.ts    # Clerk auth + token auth
│   │   │   ├── db-helpers.ts      # DB operations
│   │   │   └── logger.ts          # In-memory logger
│   │   └── proxy.ts              # Clerk middleware
│   └── drizzle.config.ts
├── packages/cli/           # CLI (published as getbranch)
│   ├── src/index.js         # Single-file, zero deps
│   └── package.json
├── wiki/                   # Documentation
│   ├── PRD.md                  # Product requirements
│   └── BUILD_PLAN.md           # Architecture & roadmap
└── README.md
```
