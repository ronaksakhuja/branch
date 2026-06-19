export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { wrapHandler } from "@/lib/api-logger";
import { getVersionDiff } from "@/lib/db-helpers";

export const GET = wrapHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const versionA = searchParams.get("from");
  const versionB = searchParams.get("to");
  if (!versionA || !versionB) return NextResponse.json({ error: "from and to required" }, { status: 400 });
  const diff = await getVersionDiff(versionA, versionB);
  return NextResponse.json(diff);
});
