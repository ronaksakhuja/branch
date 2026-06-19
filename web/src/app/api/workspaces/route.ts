export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { wrapHandler } from "@/lib/api-logger";
import { listWorkspaces, createWorkspace } from "@/lib/db-helpers";

export const GET = wrapHandler(async (_req, { userId }) => {
  const data = await listWorkspaces(userId);
  return NextResponse.json(data);
});

export const POST = wrapHandler(async (req, { userId }) => {
  const { name, slug } = await req.json();
  if (!name || !slug) {
    return NextResponse.json({ error: "name and slug are required" }, { status: 400 });
  }
  const workspaceId = await createWorkspace(userId, name, slug);
  return NextResponse.json({ id: workspaceId, name, slug }, { status: 201 });
});
