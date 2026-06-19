export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getLogs, clearLogs } from "@/lib/logger";
import { resolveUserId } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  try {
    await resolveUserId(req);

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit")) || 100, 500);
    const level = searchParams.get("level") as "info" | "warn" | "error" | "debug" | null;
    const clear = searchParams.get("clear") === "1";

    const entries = getLogs(limit, level || undefined);

    if (clear) {
      clearLogs();
    }

    return NextResponse.json({ logs: entries, count: entries.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
