# Collaboration & Sharing Redesign

## Current State

| Feature | Status | Issue |
|---------|--------|-------|
| Share links | Works | Modal has two tabs, confusing flow |
| Collaborators | Works | User must already have Branch account |
| Share button | Top bar | Not contextual to current document |
| Shared workspaces | None | No way to see workspaces shared with you |
| Invite flow | Email only | Dead end for new users |

## Desired UX

```
Viewing a document
  └─ Click "Share" (near document title, or bottom bar)
       │
       ├─ "Copy link" ── auto-generated for THIS document
       │   └─ /share/<token> — anyone can view, no auth
       │
       └─ "Invite people" ── type email
            ├─ Existing user → auto-joined to workspace
            └─ New user → invite email → sign up → auto-joined
```

```
Workspace list
  ├─ Your workspaces
  │   └─ personal-finance, ronak, ...
  └─ Shared with you
      └─ startup-plan (shared by ronak@email.com)
```

## Technical Changes

### 1. Invite system for new users

New flow:
```
Owner types email → POST /api/workspaces/:id/invites
  → Creates record in pending_invites (email, token, role, expiresAt)
  → Returns invite URL

Owner sends invite link manually (or we email later)
  → GET /share/invite/:token
  → Shows "You've been invited to workspace X"
  → If signed in → auto-accept
  → If not → Clerk sign up → auto-accept and redirect to workspace
```

**New table:**
```sql
pending_invites
  id: text (PK)
  workspaceId: text → workspaces.id
  email: text
  role: text (viewer | editor)
  token: text (unique)
  invitedBy: text → users.id
  acceptedAt: timestamp (nullable)
  expiresAt: timestamp
  createdAt: timestamp
```

**New routes:**
```
POST   /api/workspaces/:id/invites      Create invite
GET    /api/workspaces/:id/invites      List pending invites
DELETE /api/workspaces/:id/invites/:id  Cancel invite
GET    /api/invites/:token              Invite landing page
POST   /api/invites/:token/accept       Accept invite
```

**New page:**
```
/src/app/invite/[token]/page.tsx    # "You've been invited" page
```

### 2. Shared with me

Add `?shared=true` param to workspace list API:

```
GET /api/workspaces?shared=true
  → All workspaces where user is a member (any role)
  → Includes owner_name, role for each
```

Update `listWorkspaces` in db-helpers:

```ts
export async function listWorkspaces(userId: string, includeShared = false) {
  if (!includeShared) {
    // Only owned workspaces (current behavior)
    return db.select().from(workspaces).where(eq(workspaces.ownerId, userId));
  }
  // All workspaces where user is member
  return db
    .select()
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, userId));
}
```

### 3. Simplified share panel

Remove the modal tabs. Single panel:

```
┌─────────────────────────────┐
│  Share "Japan Trip"      ✕  │
│                             │
│  ┌─────────────────────┐    │
│  │ /share/abc123...    │ 📋 │
│  └─────────────────────┘    │
│  Anyone with the link can   │
│  view this document.        │
│                             │
│  ── or ──                   │
│                             │
│  Invite collaborators       │
│  ┌──────────────┐ ┌──────┐ │
│  │ email@...    │ │Invite│ │
│  └──────────────┘ └──────┘ │
│                             │
│  Collaborators              │
│  ● Ronak (owner)            │
│  ○ friend@email.com (editor)│
│  ○ viewer@email.com (viewer)│
└─────────────────────────────┘
```

### 4. Contextual share button

Move the share action to the document view:
- Add "Share" button next to the document title in the content header
- Auto-creates a link for the CURRENT document (not workspace-level)
- Workspace-level sharing accessible from the workspace selector dropdown
- Bottom bar gets a "Share" button too

### 5. API cleanup

Remove old share routes that conflict with new:

```
[Keep]    GET    /api/workspaces/:id/members
[Keep]    POST   /api/workspaces/:id/members
[Keep]    DELETE /api/workspaces/:id/members?userId=
[New]     POST   /api/workspaces/:id/invites
[New]     GET    /api/workspaces/:id/invites
[New]     GET    /api/invites/:token
[New]     POST   /api/invites/:token/accept

[Keep]    GET    /api/workspaces/:id/share      (list links)
[Replace] POST   /api/workspaces/:id/share      (auto-create for current doc)
[Keep]    DELETE /api/workspaces/:id/share?token=
[Keep]    GET    /api/share/:token               (public view)
```

## Implementation Order

### Phase 1: Invite system (core)
1. Add `pending_invites` table
2. POST /api/workspaces/:id/invites
3. GET /api/workspaces/:id/invites
4. DELETE /api/workspaces/:id/invites/:id
5. GET /api/invites/:token (landing page)
6. POST /api/invites/:token/accept
7. `/invite/[token]` page

### Phase 2: Shared with me
1. Update `listWorkspaces` to accept `includeShared`
2. Update workspace list API to accept `?shared=true`
3. Update workspace list UI with "Your workspaces" / "Shared with you" sections

### Phase 3: Simplified share panel
1. Remove two-tab modal
2. Build single share panel with copy link + invite
3. Auto-create share link for current document on panel open
4. Move share trigger to document title area + bottom bar

### Phase 4: Document-level sharing
1. Share link auto-scoped to current document path
2. Workspace-level sharing as secondary option

## UI Wireframes

### Share panel open
```
╔══════════════════════════════════════════╗
║  ● Branch              personal-finance  ║
║  /                                       ║
║  Documents  /  Japan Trip  v3            ║
╠══════════════════════════════════════════╣
║                                          ║
║          # Japan Trip                    ║
║                                          ║
║          ## Ideas                        ║
║          - Tokyo food crawl              ║
║          - Kyoto temples                 ║
║          ...                             ║
║                                          ║
╠══════════════════════════════════════════╣
║  view | edit | diff    Versions  Share   ║
╚══════════════════════════════════════════╝

                    ┌──────────────────────┐
                    │  Share "Japan Trip"  │
                    │                      │
                    │  ┌──────────────┐ 📋 │
                    │  │ /share/abc.. │    │
                    │  └──────────────┘    │
                    │                      │
                    │  Invite people       │
                    │  ┌─────────┐ ┌────┐  │
                    │  │ email   │ │Add │  │
                    │  └─────────┘ └────┘  │
                    │                      │
                    │  ● Ronak (owner)     │
                    │  ○ alice@ (editor)   │
                    └──────────────────────┘
```

### Workspace list with shared
```
╔════════════════════════╗
║  Branch         Signout║
║  ┌────────────────────┐║
║  │ personal-finance  ▼│║
║  └────────────────────┘║
║                        ║
║  Your workspaces       ║
║  ● personal-finance    ║
║                        ║
║  Shared with you       ║
║  ○ startup (by Ronak)  ║
║  ○ team-docs (by Alice)║
║                        ║
║  [+ New workspace]     ║
╚════════════════════════╝
```
