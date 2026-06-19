export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { wrapHandler } from "@/lib/api-logger";

export const GET = wrapHandler(async (_req, { userId }) => {
  return NextResponse.json({ userId });
});
