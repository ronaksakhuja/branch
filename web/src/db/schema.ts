import { pgTable, text, timestamp, integer, primaryKey, index } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const workspaces = pgTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    role: text("role", { enum: ["owner", "editor", "viewer"] })
      .default("editor")
      .notNull(),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.userId] }),
  ],
);

export const documents = pgTable(
  "documents",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    path: text("path").notNull(),
    title: text("title").notNull(),
    currentVersionId: text("current_version_id"),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("documents_workspace_path_idx").on(table.workspaceId, table.path),
  ],
);

export const documentVersions = pgTable(
  "document_versions",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id),
    versionNumber: integer("version_number").notNull(),
    content: text("content").notNull(),
    summary: text("summary").notNull(),
    authorType: text("author_type", { enum: ["Human", "AI", "System"] })
      .notNull(),
    authorName: text("author_name").notNull(),
    authorId: text("author_id"),
    hash: text("hash").notNull(),
    parentVersionId: text("parent_version_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("document_versions_document_idx").on(table.documentId),
  ],
);

export const gitObjects = pgTable(
  "git_objects",
  {
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    hash: text("hash").notNull(),
    type: text("type", { enum: ["blob", "tree", "commit", "tag"] }).notNull(),
    content: text("content").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.hash] }),
    index("git_objects_type_idx").on(table.workspaceId, table.type),
  ],
);

export const gitRefs = pgTable(
  "git_refs",
  {
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    ref: text("ref").notNull(),
    targetHash: text("target_hash").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.ref] }),
  ],
);

export const shareLinks = pgTable(
  "share_links",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    documentPath: text("document_path"),
    token: text("token").notNull().unique(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    expiresAt: timestamp("expires_at"),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("share_links_token_idx").on(table.token),
    index("share_links_workspace_idx").on(table.workspaceId),
  ],
);
