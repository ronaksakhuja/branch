export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { wrapHandler } from "@/lib/api-logger";
import { getDb } from "@/db";
import { workspaceMembers, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveWorkspaceId } from "@/lib/db-helpers";

export const GET = wrapHandler(async (req, { userId }) => {
  const wsId = await resolveWorkspaceId(req.nextUrl.pathname.split("/")[3]);
  const db = getDb();
  const rows = await db
    .select({ userId: workspaceMembers.userId, role: workspaceMembers.role, joinedAt: workspaceMembers.joinedAt, name: users.name, email: users.email })
    .from(workspaceMembers)
    .leftJoin(users, eq(workspaceMembers.userId, users.id))
    .where(eq(workspaceMembers.workspaceId, wsId));
  return NextResponse.json(rows);
});

export const POST = wrapHandler(async (req, { userId }) => {
  const wsId = await resolveWorkspaceId(req.nextUrl.pathname.split("/")[3]);
  const db = getDb();

  const isOwner = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, wsId), eq(workspaceMembers.userId, userId), eq(workspaceMembers.role, "owner")))
    .limit(1);

  if (isOwner.length === 0) return NextResponse.json({ error: "Only workspace owners can manage members" }, { status: 403 });

  const { email, role } = await req.json();
  if (!email || !role) return NextResponse.json({ error: "email and role required" }, { status: 400 });

  const userRows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (userRows.length === 0) return NextResponse.json({ error: "User not found. They must sign in to Branch first." }, { status: 404 });

  await db
    .insert(workspaceMembers)
    .values({ workspaceId: wsId, userId: userRows[0].id, role })
    .onConflictDoUpdate({ target: [workspaceMembers.workspaceId, workspaceMembers.userId], set: { role } });

  return NextResponse.json({ ok: true });
});

export const DELETE = wrapHandler(async (req, { userId }) => {
  const wsId = await resolveWorkspaceId(req.nextUrl.pathname.split("/")[3]);
  const db = getDb();

  const isOwner = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, wsId), eq(workspaceMembers.userId, userId), eq(workspaceMembers.role, "owner")))
    .limit(1);

  if (isOwner.length === 0) return NextResponse.json({ error: "Only workspace owners can manage members" }, { status: 403 });

  const url = new URL(req.url);
  const targetUserId = url.searchParams.get("userId");
  if (!targetUserId) return NextResponse.json({ error: "userId query param required" }, { status: 400 });

  await db
    .delete(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, wsId), eq(workspaceMembers.userId, targetUserId)));

  return NextResponse.json({ ok: true });
});
