export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { wrapHandler } from "@/lib/api-logger";
import { getDb } from "@/db";
import { comments, workspaceMembers, users } from "@/db/schema";
import { eq, and, desc, isNull } from "drizzle-orm";
import { resolveWorkspaceId } from "@/lib/db-helpers";
import { id } from "@/lib/auth-helpers";

export const GET = wrapHandler(async (req, { userId }) => {
  const parts = req.nextUrl.pathname.split("/");
  const wsId = await resolveWorkspaceId(parts[3]);
  const docPath = decodeURIComponent(parts.slice(5, -1).join("/"));
  const db = getDb();

  const rows = await db
    .select({
      id: comments.id, lineNumber: comments.lineNumber, content: comments.content,
      authorId: comments.authorId, authorName: users.name, authorEmail: users.email,
      resolvedAt: comments.resolvedAt, resolvedById: comments.resolvedById,
      createdAt: comments.createdAt, updatedAt: comments.updatedAt,
    })
    .from(comments)
    .leftJoin(users, eq(comments.authorId, users.id))
    .where(and(eq(comments.workspaceId, wsId), eq(comments.documentPath, docPath)))
    .orderBy(desc(comments.createdAt));

  return NextResponse.json(rows);
});

export const POST = wrapHandler(async (req, { userId }) => {
  const parts = req.nextUrl.pathname.split("/");
  const wsId = await resolveWorkspaceId(parts[3]);
  const docPath = decodeURIComponent(parts.slice(5, -1).join("/"));
  const db = getDb();

  const isMember = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, wsId), eq(workspaceMembers.userId, userId)))
    .limit(1);

  if (isMember.length === 0) return NextResponse.json({ error: "Must be a workspace member" }, { status: 403 });

  const { lineNumber, content } = await req.json();
  if (lineNumber === undefined || !content) return NextResponse.json({ error: "lineNumber and content required" }, { status: 400 });

  const commentId = id("comment");
  await db.insert(comments).values({
    id: commentId, workspaceId: wsId, documentPath: docPath,
    lineNumber, content, authorId: userId,
  });

  return NextResponse.json({ id: commentId }, { status: 201 });
});
