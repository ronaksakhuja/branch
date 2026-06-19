export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { pendingInvites, workspaces } from "@/db/schema";
import { eq, and, isNull, gt } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const db = getDb();

  const rows = await db
    .select()
    .from(pendingInvites)
    .where(and(eq(pendingInvites.token, token), isNull(pendingInvites.acceptedAt), gt(pendingInvites.expiresAt, new Date())))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Invite not found, already accepted, or expired" }, { status: 404 });
  }

  const invite = rows[0];
  const wsRows = await db.select().from(workspaces).where(eq(workspaces.id, invite.workspaceId)).limit(1);

  return NextResponse.json({
    email: invite.email,
    role: invite.role,
    workspaceName: wsRows[0]?.name || "Unknown",
    token: invite.token,
  });
}
