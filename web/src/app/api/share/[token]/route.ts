export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { shareLinks, workspaces } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { readDocument as gitReadDocument } from "@/lib/git-engine";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const db = getDb();

  const rows = await db
    .select()
    .from(shareLinks)
    .where(and(eq(shareLinks.token, token), isNull(shareLinks.revokedAt)))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Share link not found or revoked" }, { status: 404 });
  }

  const link = rows[0];
  const wsRows = await db.select().from(workspaces).where(eq(workspaces.id, link.workspaceId)).limit(1);

  if (wsRows.length === 0) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const content = link.documentPath
    ? await gitReadDocument(link.workspaceId, link.documentPath).catch(() => null)
    : null;

  return NextResponse.json({
    workspace: wsRows[0].name,
    documentPath: link.documentPath,
    content,
    sharedAt: link.createdAt,
  });
}
