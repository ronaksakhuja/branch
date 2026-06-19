export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { wrapHandler } from "@/lib/api-logger";
import { pullWorkspace, resolveWorkspaceId } from "@/lib/db-helpers";

export const GET = wrapHandler(async (req, { userId }) => {
  const identifier = req.nextUrl.pathname.split("/")[3];
  const workspaceId = await resolveWorkspaceId(identifier);
  const docs = await pullWorkspace(workspaceId);
  return NextResponse.json({ documents: docs, workspaceId });
});
