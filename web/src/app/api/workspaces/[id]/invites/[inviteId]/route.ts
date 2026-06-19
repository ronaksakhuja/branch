export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { wrapHandler } from "@/lib/api-logger";
import { getDb } from "@/db";
import { pendingInvites, workspaceMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveWorkspaceId } from "@/lib/db-helpers";

export const DELETE = wrapHandler(async (req, { userId }) => {
  const wsId = await resolveWorkspaceId(req.nextUrl.pathname.split("/")[3]);
  const inviteId = req.nextUrl.pathname.split("/")[6];
  const db = getDb();

  const ownerCheck = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, wsId), eq(workspaceMembers.userId, userId), eq(workspaceMembers.role, "owner")))
    .limit(1);

  if (ownerCheck.length === 0) return NextResponse.json({ error: "Only owners can manage invites" }, { status: 403 });

  await db.delete(pendingInvites).where(and(eq(pendingInvites.id, inviteId), eq(pendingInvites.workspaceId, wsId)));
  return NextResponse.json({ ok: true });
});
