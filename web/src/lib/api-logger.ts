import { NextRequest, NextResponse } from "next/server";
import { resolveUserId, ensureUser } from "./auth-helpers";
import { log } from "./logger";

export function wrapHandler(
  handler: (req: NextRequest, ctx: { userId: string }) => Promise<NextResponse>,
) {
  return async (req: NextRequest) => {
    const start = Date.now();
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;
    let resolvedUserId: string | null = null;

    try {
      resolvedUserId = await resolveUserId(req);
      await ensureUser(resolvedUserId);

      log({ level: "info", path, method, userId: resolvedUserId, message: `Request started` });

      const response = await handler(req, { userId: resolvedUserId });

      log({
        level: "info",
        path,
        method,
        userId: resolvedUserId,
        message: `Response ${response.status}`,
        duration: Date.now() - start,
      });

      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Internal error";
      const status = message === "Unauthorized" ? 401 : 500;

      log({
        level: "error",
        path,
        method,
        userId: resolvedUserId,
        message: `Error ${status}: ${message}`,
        error,
        duration: Date.now() - start,
      });

      return NextResponse.json({ error: message }, { status });
    }
  };
}
