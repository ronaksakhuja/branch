export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { wrapHandler } from "@/lib/api-logger";
import { getDb } from "@/db";
import { pendingInvites, workspaceMembers } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { resolveWorkspaceId } from "@/lib/db-helpers";
import { randomBytes } from "node:crypto";
import { id } from "@/lib/auth-helpers";

export const GET = wrapHandler(async (req, { userId }) => {
  const wsId = await resolveWorkspaceId(req.nextUrl.pathname.split("/")[3]);
  const db = getDb();

  const ownerCheck = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, wsId), eq(workspaceMembers.userId, userId), eq(workspaceMembers.role, "owner")))
    .limit(1);

  if (ownerCheck.length === 0) return NextResponse.json({ error: "Only owners can manage invites" }, { status: 403 });

  const invites = await db
    .select()
    .from(pendingInvites)
    .where(and(eq(pendingInvites.workspaceId, wsId), isNull(pendingInvites.acceptedAt)));

  return NextResponse.json(invites.map((i) => ({ id: i.id, email: i.email, role: i.role, token: i.token, createdAt: i.createdAt, expiresAt: i.expiresAt })));
});

export const POST = wrapHandler(async (req, { userId }) => {
  const wsId = await resolveWorkspaceId(req.nextUrl.pathname.split("/")[3]);
  const db = getDb();

  const ownerCheck = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, wsId), eq(workspaceMembers.userId, userId), eq(workspaceMembers.role, "owner")))
    .limit(1);

  if (ownerCheck.length === 0) return NextResponse.json({ error: "Only owners can invite" }, { status: 403 });

  const { email, role } = await req.json();
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const token = randomBytes(16).toString("hex");

  await db.insert(pendingInvites).values({
    id: id("invite"),
    workspaceId: wsId,
    email: email.trim().toLowerCase(),
    role: role || "viewer",
    token,
    invitedBy: userId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://branchcli.vercel.app";
  return NextResponse.json({ token, inviteUrl: `${appUrl}/invite/${token}` });
});
