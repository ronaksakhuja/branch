export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { wrapHandler } from "@/lib/api-logger";
import { listDocuments, createDocument, resolveWorkspaceId } from "@/lib/db-helpers";

export const GET = wrapHandler(async (req, { userId }) => {
  const workspaceId = await resolveWorkspaceId(req.nextUrl.pathname.split("/")[3]);
  const data = await listDocuments(workspaceId);
  return NextResponse.json(data);
});

export const POST = wrapHandler(async (req, { userId }) => {
  const workspaceId = await resolveWorkspaceId(req.nextUrl.pathname.split("/")[3]);
  const { path, content, summary } = await req.json();
  if (!path || content === undefined) {
    return NextResponse.json({ error: "path and content are required" }, { status: 400 });
  }
  const docId = await createDocument(workspaceId, path, content, userId, userId, "Human", summary || "Created document.");
  return NextResponse.json({ id: docId, path }, { status: 201 });
});
