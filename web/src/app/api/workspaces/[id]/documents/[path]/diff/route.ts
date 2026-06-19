export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { wrapHandler } from "@/lib/api-logger";
import { resolveWorkspaceId } from "@/lib/db-helpers";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const GITHUB_OWNER = process.env.GITHUB_OWNER || "ronaksakhuja";
const API_BASE = "https://api.github.com";

function repoName(workspaceId: string) {
  return `branch-${workspaceId.replace(/[^a-zA-Z0-9-]/g, "-").slice(0, 40)}`;
}

function ghHeaders() {
  return { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: "application/vnd.github.raw+json", "X-GitHub-Api-Version": "2022-11-28" };
}

async function readAtCommit(repo: string, filepath: string, sha: string) {
  const url = `${API_BASE}/repos/${GITHUB_OWNER}/${repo}/contents/${encodeURIComponent(filepath)}?ref=${sha}`;
  const res = await fetch(url, { headers: ghHeaders() });
  if (!res.ok) return "";
  return res.text();
}

export const GET = wrapHandler(async (req) => {
  const parts = req.nextUrl.pathname.split("/");
  const wsId = await resolveWorkspaceId(parts[3]);
  const docPath = decodeURIComponent(parts.slice(5, -1).join("/"));
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) return NextResponse.json({ error: "from and to required" }, { status: 400 });

  const repo = repoName(wsId);
  const [olderContent, newerContent] = await Promise.all([
    readAtCommit(repo, docPath, from),
    readAtCommit(repo, docPath, to),
  ]);

  return NextResponse.json({ olderContent, newerContent });
});
