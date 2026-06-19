import { auth, clerkClient } from "@clerk/nextjs/server";
import { randomUUID } from "node:crypto";

export async function requireUserId() {
  const { userId } = await auth();

  if (userId) {
    return userId;
  }

  throw new Error("Unauthorized");
}

export async function resolveUserId(req: Request) {
  const { userId } = await auth();

  if (userId) {
    return userId;
  }

  const header = req.headers.get("authorization");

  if (header?.startsWith("Bearer ")) {
    const token = header.slice(7);
    const parts = token.split(".");

    if (parts.length === 2) {
      const [apiUserId] = parts;
      return apiUserId;
    }
  }

  throw new Error("Unauthorized");
}

export function id(prefix: string) {
  return `${prefix}_${randomUUID()}`;
}

export async function ensureUser(userId: string) {
  const { getDb } = await import("@/db");
  const { users } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");

  const db = getDb();
  const existing = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  const client = await clerkClient();
  const clerkUser = await client.users.getUser(userId);
  const email = clerkUser.emailAddresses[0]?.emailAddress || `${userId}@branch.local`;
  const name = `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() || undefined;

  const [row] = await db
    .insert(users)
    .values({
      id: userId,
      email,
      name,
    })
    .returning();

  return row;
}
