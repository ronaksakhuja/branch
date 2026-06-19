export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { wrapHandler } from "@/lib/api-logger";
import { getDocument, resolveWorkspaceId } from "@/lib/db-helpers";

export const GET = wrapHandler(async (req) => {
  const parts = req.nextUrl.pathname.split("/");
  const workspaceId = await resolveWorkspaceId(parts[3]);
  const docPath = decodeURIComponent(parts.slice(5, -1).join("/"));
  const doc = await getDocument(workspaceId, docPath);
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  return NextResponse.json(doc.versions);
});
