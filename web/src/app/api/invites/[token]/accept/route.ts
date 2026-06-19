export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { wrapHandler } from "@/lib/api-logger";
import { getDb } from "@/db";
import { pendingInvites, workspaceMembers } from "@/db/schema";
import { eq, and, isNull, gt } from "drizzle-orm";

export const POST = wrapHandler(async (req, { userId }) => {
  const token = req.nextUrl.pathname.split("/")[3];
  const db = getDb();

  const rows = await db
    .select()
    .from(pendingInvites)
    .where(and(eq(pendingInvites.token, token), isNull(pendingInvites.acceptedAt), gt(pendingInvites.expiresAt, new Date())))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Invite not found or expired" }, { status: 404 });
  }

  const invite = rows[0];

  await db
    .insert(workspaceMembers)
    .values({ workspaceId: invite.workspaceId, userId, role: invite.role })
    .onConflictDoNothing({ target: [workspaceMembers.workspaceId, workspaceMembers.userId] });

  await db
    .update(pendingInvites)
    .set({ acceptedAt: new Date() })
    .where(eq(pendingInvites.id, invite.id));

  return NextResponse.json({ ok: true, workspaceId: invite.workspaceId });
});
