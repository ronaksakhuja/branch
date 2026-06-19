import { getDb } from "@/db";
import { documents, documentVersions, workspaces } from "@/db/schema";
import { eq, and, desc, isNull, inArray, or } from "drizzle-orm";
import { id } from "./auth-helpers";
import crypto from "node:crypto";

export function hashContent(content: string) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

export function titleFromPath(path: string) {
  const filename = path.split("/").at(-1)?.replace(/\.md$/, "") || "Untitled";
  return filename
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export async function resolveWorkspaceId(identifier: string) {
  const db = getDb();

  if (identifier.startsWith("workspace_")) {
    const rows = await db.select().from(workspaces).where(eq(workspaces.id, identifier)).limit(1);
    if (rows.length === 0) throw new Error("Workspace not found");
    return rows[0].id;
  }

  const rows = await db
    .select()
    .from(workspaces)
    .where(or(eq(workspaces.slug, identifier), eq(workspaces.id, identifier)))
    .limit(1);

  if (rows.length === 0) throw new Error("Workspace not found");
  return rows[0].id;
}

export async function listWorkspaces(userId: string) {
  const db = getDb();
  return db
    .select()
    .from(workspaces)
    .where(eq(workspaces.ownerId, userId))
    .orderBy(desc(workspaces.updatedAt));
}

export async function createWorkspace(userId: string, name: string, slug: string) {
  const db = getDb();
  const workspaceId = id("workspace");
  await db.insert(workspaces).values({
    id: workspaceId,
    name,
    slug,
    ownerId: userId,
  });
  return workspaceId;
}

export async function listDocuments(workspaceId: string) {
  const db = getDb();
  return db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.workspaceId, workspaceId),
        isNull(documents.deletedAt),
      ),
    )
    .orderBy(documents.path);
}

export async function getDocument(workspaceId: string, path: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.workspaceId, workspaceId),
        eq(documents.path, path),
      ),
    )
    .limit(1);

  if (rows.length === 0) {
    return null;
  }

  const document = rows[0];
  const versions = await getDocumentVersions(document.id);
  const currentVersion = versions.find((v) => v.id === document.currentVersionId);

  return {
    ...document,
    content: currentVersion?.content || "",
    versions,
  };
}

export async function createDocument(
  workspaceId: string,
  path: string,
  content: string,
  authorName: string,
  authorId: string,
  authorType: "Human" | "AI" | "System",
  summary: string,
) {
  const db = getDb();
  const documentId = id("document");
  const versionId = id("version");
  const hash = hashContent(content);
  const title = titleFromPath(path);

  await db.insert(documents).values({
    id: documentId,
    workspaceId,
    path,
    title,
    currentVersionId: versionId,
  });

  await db.insert(documentVersions).values({
    id: versionId,
    documentId,
    versionNumber: 1,
    content,
    summary,
    authorType,
    authorName,
    authorId,
    hash,
  });

  return documentId;
}

export async function updateDocument(
  workspaceId: string,
  path: string,
  content: string,
  authorName: string,
  authorId: string,
  authorType: "Human" | "AI" | "System",
  summary: string,
) {
  const db = getDb();
  const existing = await getDocument(workspaceId, path);

  if (!existing) {
    throw new Error("Document not found");
  }

  const versionId = id("version");
  const hash = hashContent(content);
  const versionNumber = existing.versions.length + 1;

  await db.insert(documentVersions).values({
    id: versionId,
    documentId: existing.id,
    versionNumber,
    content,
    summary,
    authorType,
    authorName,
    authorId,
    hash,
    parentVersionId: existing.currentVersionId,
  });

  await db
    .update(documents)
    .set({ currentVersionId: versionId, updatedAt: new Date() })
    .where(eq(documents.id, existing.id));

  return versionId;
}

export async function deleteDocument(
  workspaceId: string,
  path: string,
  authorName: string,
  authorId: string,
  summary: string,
) {
  const db = getDb();
  const existing = await getDocument(workspaceId, path);

  if (!existing) {
    throw new Error("Document not found");
  }

  const versionId = id("version");
  const versionNumber = existing.versions.length + 1;

  await db.insert(documentVersions).values({
    id: versionId,
    documentId: existing.id,
    versionNumber,
    content: "",
    summary,
    authorType: "AI",
    authorName,
    authorId,
    hash: hashContent(""),
    parentVersionId: existing.currentVersionId,
  });

  await db
    .update(documents)
    .set({
      currentVersionId: versionId,
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(documents.id, existing.id));

  return versionId;
}

export async function getDocumentVersions(documentId: string) {
  const db = getDb();
  return db
    .select()
    .from(documentVersions)
    .where(eq(documentVersions.documentId, documentId))
    .orderBy(desc(documentVersions.versionNumber));
}

export async function getVersionDiff(versionIdA: string, versionIdB: string) {
  const db = getDb();
  const versions = await db
    .select()
    .from(documentVersions)
    .where(
      inArray(documentVersions.id, [versionIdA, versionIdB]),
    );

  if (versions.length !== 2) {
    throw new Error("Versions not found");
  }

  const versionA = versions.find((v) => v.id === versionIdA);
  const versionB = versions.find((v) => v.id === versionIdB);

  if (!versionA || !versionB) {
    throw new Error("Version lookup failed");
  }

  const [older, newer] =
    versionA.versionNumber < versionB.versionNumber
      ? [versionA, versionB]
      : [versionB, versionA];

  return {
    older,
    newer,
    olderContent: older.content,
    newerContent: newer.content,
  };
}

export async function pullWorkspace(workspaceId: string) {
  const docs = await listDocuments(workspaceId);
  const result = [];

  for (const document of docs) {
    const full = await getDocument(workspaceId, document.path);
    result.push({
      id: full?.id,
      path: document.path,
      title: document.title,
      content: full?.content || "",
      updatedAt: document.updatedAt,
      versionNumber: full?.versions.length || 1,
      currentVersionId: document.currentVersionId,
    });
  }

  return result;
}
