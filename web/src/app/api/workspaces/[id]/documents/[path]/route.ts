export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { wrapHandler } from "@/lib/api-logger";
import { getDocument, updateDocument, deleteDocument, resolveWorkspaceId } from "@/lib/db-helpers";

async function extractIds(req: NextRequest) {
  const parts = req.nextUrl.pathname.split("/");
  const workspaceId = await resolveWorkspaceId(parts[3]);
  const docPath = decodeURIComponent(parts.slice(5).join("/"));
  return { workspaceId, docPath };
}

export const GET = wrapHandler(async (req, { userId }) => {
  const { workspaceId, docPath } = await extractIds(req);
  const doc = await getDocument(workspaceId, docPath);
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  return NextResponse.json(doc);
});

export const PUT = wrapHandler(async (req, { userId }) => {
  const { workspaceId, docPath } = await extractIds(req);
  const { content, summary, authorType } = await req.json();
  if (content === undefined) return NextResponse.json({ error: "content is required" }, { status: 400 });
  await updateDocument(workspaceId, docPath, content, userId, userId, authorType || "Human", summary || "Updated document.");
  return NextResponse.json({ ok: true });
});

export const DELETE = wrapHandler(async (req, { userId }) => {
  const { workspaceId, docPath } = await extractIds(req);
  const { summary } = await req.json();
  await deleteDocument(workspaceId, docPath, userId, userId, summary || "Deleted document.");
  return NextResponse.json({ deleted: true });
});
