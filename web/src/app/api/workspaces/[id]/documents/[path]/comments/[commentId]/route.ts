export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { wrapHandler } from "@/lib/api-logger";
import { getDb } from "@/db";
import { comments, workspaceMembers, workspaces } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveWorkspaceId } from "@/lib/db-helpers";

async function canComment(wsId: string, userId: string) {
  const db = getDb();
  const member = await db.select().from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, wsId), eq(workspaceMembers.userId, userId))).limit(1);
  if (member.length > 0) return true;
  const owner = await db.select().from(workspaces).where(and(eq(workspaces.id, wsId), eq(workspaces.ownerId, userId))).limit(1);
  return owner.length > 0;
}

export const PATCH = wrapHandler(async (req, { userId }) => {
  const parts = req.nextUrl.pathname.split("/");
  const wsId = await resolveWorkspaceId(parts[3]);
  const docPath = decodeURIComponent(parts.slice(5, 7).join("/"));
  const commentId = parts[8];
  const db = getDb();

  if (!(await canComment(wsId, userId))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { resolved } = await req.json();
  if (resolved) {
    await db.update(comments).set({ resolvedAt: new Date(), resolvedById: userId }).where(and(eq(comments.id, commentId), eq(comments.workspaceId, wsId), eq(comments.documentPath, docPath)));
  }

  return NextResponse.json({ ok: true });
});

export const DELETE = wrapHandler(async (req, { userId }) => {
  const parts = req.nextUrl.pathname.split("/");
  const wsId = await resolveWorkspaceId(parts[3]);
  const docPath = decodeURIComponent(parts.slice(5, 7).join("/"));
  const commentId = parts[8];
  const db = getDb();

  const rows = await db.select().from(comments).where(and(eq(comments.id, commentId), eq(comments.authorId, userId))).limit(1);
  if (rows.length === 0) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  await db.delete(comments).where(eq(comments.id, commentId));
  return NextResponse.json({ ok: true });
});
