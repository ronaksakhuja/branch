import { getDb } from "@/db";
import { documents, workspaces } from "@/db/schema";
import { eq, and, desc, isNull, or } from "drizzle-orm";
import { id } from "./auth-helpers";
import {
  initWorkspaceRepo,
  commitDocument,
  readDocument as gitReadDocument,
  listFiles as gitListFiles,
  getLog as gitGetLog,
  deleteDocument as gitDeleteDocument,
} from "./git-engine";

export function titleFromPath(path: string) {
  const filename = path.split("/").at(-1)?.replace(/\.md$/, "") || "Untitled";
  return filename.split("-").filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export async function resolveWorkspaceId(identifier: string) {
  const db = getDb();
  const rows = await db.select().from(workspaces).where(or(eq(workspaces.slug, identifier), eq(workspaces.id, identifier))).limit(1);
  if (rows.length === 0) throw new Error("Workspace not found");
  return rows[0].id;
}

export async function listWorkspaces(userId: string) {
  const db = getDb();
  return db.select().from(workspaces).where(eq(workspaces.ownerId, userId)).orderBy(desc(workspaces.updatedAt));
}

export async function createWorkspace(userId: string, name: string, slug: string) {
  const db = getDb();
  const workspaceId = id("workspace");
  await db.insert(workspaces).values({ id: workspaceId, name, slug, ownerId: userId });

  try { await initWorkspaceRepo(workspaceId); } catch (e) { console.error("Failed to init Git repo for workspace", workspaceId, e); }

  return workspaceId;
}

export async function listDocuments(workspaceId: string) {
  const db = getDb();

  const gitFiles = await gitListFiles(workspaceId).catch(() => [] as string[]);
  const dbDocs = await db.select().from(documents).where(and(eq(documents.workspaceId, workspaceId), isNull(documents.deletedAt))).orderBy(documents.path);

  const gitPaths = new Set(gitFiles);
  for (const gitPath of gitFiles) {
    if (!dbDocs.find((d) => d.path === gitPath)) {
      dbDocs.push({
        id: `git-${gitPath}`,
        workspaceId,
        path: gitPath,
        title: titleFromPath(gitPath),
        currentVersionId: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  return dbDocs.filter((d) => gitPaths.has(d.path)).sort((a, b) => a.path.localeCompare(b.path));
}

export async function getDocument(workspaceId: string, path: string) {
  const db = getDb();

  const content = await gitReadDocument(workspaceId, path).catch(() => null);

  const dbRows = await db.select().from(documents).where(and(eq(documents.workspaceId, workspaceId), eq(documents.path, path))).limit(1);
  const doc = dbRows[0] || {
    id: `git-${path}`,
    workspaceId,
    path,
    title: titleFromPath(path),
    currentVersionId: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  type GitLogEntry = { oid: string; commit: { message: string; author: { name: string; timestamp: number } }; payload: string };
  const gitLog = await gitGetLog(workspaceId, path, 100)
    .then((log) => log as unknown as GitLogEntry[])
    .catch((): GitLogEntry[] => []);

  const versions = gitLog.map((entry, index) => ({
    id: entry.oid,
    documentId: doc.id,
    versionNumber: gitLog.length - index,
    content: "",
    summary: entry.commit.message.split("\n")[0],
    authorType: "Human" as const,
    authorName: entry.commit.author.name,
    authorId: null as string | null,
    hash: entry.oid,
    createdAt: new Date(entry.commit.author.timestamp * 1000).toISOString(),
  }));

  return {
    ...doc,
    content: content || "",
    versions,
  };
}

export async function createDocument(
  workspaceId: string, path: string, content: string,
  authorName: string, authorId: string,
  authorType: "Human" | "AI" | "System", summary: string,
) {
  const db = getDb();
  const documentId = id("document");

  const sha = await commitDocument(workspaceId, path, content, { name: authorName, email: `${authorId}@branch.local` }, `${summary}\n\nBranch-Author-Type: ${authorType}\nBranch-Author-Name: ${authorName}`);

  await db.insert(documents).values({ id: documentId, workspaceId, path, title: titleFromPath(path), currentVersionId: sha });

  return documentId;
}

export async function updateDocument(
  workspaceId: string, path: string, content: string,
  authorName: string, authorId: string,
  authorType: "Human" | "AI" | "System", summary: string,
) {
  const sha = await commitDocument(workspaceId, path, content, { name: authorName, email: `${authorId}@branch.local` }, `${summary}\n\nBranch-Author-Type: ${authorType}\nBranch-Author-Name: ${authorName}`);

  const db = getDb();
  await db.update(documents).set({ currentVersionId: sha, updatedAt: new Date() }).where(and(eq(documents.workspaceId, workspaceId), eq(documents.path, path)));

  return sha;
}

export async function deleteDocument(
  workspaceId: string, path: string,
  authorName: string, authorId: string, summary: string,
) {
  const sha = await commitDocument(workspaceId, path, "", { name: authorName, email: `${authorId}@branch.local` }, `${summary}\n\nBranch-Author-Type: AI\nBranch-Author-Name: ${authorName}`);

  const db = getDb();
  await db.update(documents).set({ currentVersionId: sha, deletedAt: new Date(), updatedAt: new Date() }).where(and(eq(documents.workspaceId, workspaceId), eq(documents.path, path)));

  return sha;
}

export async function getDocumentVersions(documentId: string) {
  return [];
}

export async function getVersionDiff(versionIdA: string, versionIdB: string) {
  return { older: null, newer: null, olderContent: "", newerContent: "" };
}

export async function pullWorkspace(workspaceId: string) {
  const docs = await listDocuments(workspaceId);
  const result = [];
  for (const doc of docs) {
    const content = await gitReadDocument(workspaceId, doc.path).catch(() => "");
    result.push({ id: doc.id, path: doc.path, title: doc.title, content, updatedAt: doc.updatedAt, versionNumber: 1, currentVersionId: doc.currentVersionId || "" });
  }
  return result;
}
