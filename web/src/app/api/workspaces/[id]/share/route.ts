export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { wrapHandler } from "@/lib/api-logger";
import { getDb } from "@/db";
import { shareLinks } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { resolveWorkspaceId } from "@/lib/db-helpers";
import { randomBytes } from "node:crypto";

export const GET = wrapHandler(async (req, { userId }) => {
  const wsId = await resolveWorkspaceId(req.nextUrl.pathname.split("/")[3]);
  const db = getDb();
  const links = await db
    .select()
    .from(shareLinks)
    .where(and(eq(shareLinks.workspaceId, wsId), isNull(shareLinks.revokedAt)));
  return NextResponse.json(links.map((l) => ({ id: l.id, token: l.token, documentPath: l.documentPath, createdAt: l.createdAt, expiresAt: l.expiresAt })));
});

export const POST = wrapHandler(async (req, { userId }) => {
  const wsId = await resolveWorkspaceId(req.nextUrl.pathname.split("/")[3]);
  const db = getDb();
  const { documentPath } = await req.json();

  const token = randomBytes(16).toString("hex");
  await db.insert(shareLinks).values({
    id: token,
    workspaceId: wsId,
    documentPath: documentPath || null,
    token,
    createdBy: userId,
  });

  return NextResponse.json({ token, url: `${process.env.NEXT_PUBLIC_APP_URL || "https://web-iota-ruby-62.vercel.app"}/share/${token}` });
});

export const DELETE = wrapHandler(async (req, { userId }) => {
  const wsId = await resolveWorkspaceId(req.nextUrl.pathname.split("/")[3]);
  const db = getDb();
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token query param required" }, { status: 400 });

  await db.update(shareLinks).set({ revokedAt: new Date() }).where(and(eq(shareLinks.workspaceId, wsId), eq(shareLinks.token, token)));
  return NextResponse.json({ ok: true });
});
