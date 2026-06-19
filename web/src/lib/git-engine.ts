const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const GITHUB_OWNER = process.env.GITHUB_OWNER || "ronaksakhuja";
const API_BASE = "https://api.github.com";

function repoName(workspaceId: string) {
  return `branch-${workspaceId.replace(/[^a-zA-Z0-9-]/g, "-").slice(0, 40)}`;
}

function headers() {
  return {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

export async function initWorkspaceRepo(workspaceId: string) {
  const name = repoName(workspaceId);
  const res = await fetch(`${API_BASE}/repos/${GITHUB_OWNER}/${name}`, { headers: headers() });
  if (res.ok) return;

  await fetch(`${API_BASE}/user/repos`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ name, private: true, description: "Branch workspace", auto_init: true }),
  });
}

async function ensureRepo(workspaceId: string) {
  const name = repoName(workspaceId);
  const res = await fetch(`${API_BASE}/repos/${GITHUB_OWNER}/${name}`, { headers: headers() });
  if (!res.ok) {
    await initWorkspaceRepo(workspaceId);
  }
}

export async function commitDocument(
  workspaceId: string, filepath: string, content: string,
  author: { name: string; email: string }, message: string,
) {
  await ensureRepo(workspaceId);
  const repo = repoName(workspaceId);
  const url = `${API_BASE}/repos/${GITHUB_OWNER}/${repo}/contents/${encodeURIComponent(filepath)}`;
  const existing = await fetch(url, { headers: headers() });
  const sha = existing.ok ? (await existing.json()).sha : undefined;

  const body: Record<string, unknown> = { message, content: Buffer.from(content).toString("base64"), committer: author, author };
  if (sha) body.sha = sha;

  const res = await fetch(url, { method: "PUT", headers: headers(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`GitHub commit failed: ${res.status}`);
  const data = await res.json();
  return data.content?.sha || "";
}

export async function readDocument(workspaceId: string, filepath: string): Promise<string | null> {
  await ensureRepo(workspaceId);
  const repo = repoName(workspaceId);
  const url = `${API_BASE}/repos/${GITHUB_OWNER}/${repo}/contents/${encodeURIComponent(filepath)}`;
  const h = headers();
  h.Accept = "application/vnd.github.raw+json";
  const res = await fetch(url, { headers: h });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub read failed: ${res.status}`);
  return res.text();
}

export async function listFiles(workspaceId: string): Promise<string[]> {
  await ensureRepo(workspaceId);
  const repo = repoName(workspaceId);
  const res = await fetch(`${API_BASE}/repos/${GITHUB_OWNER}/${repo}/git/trees/main?recursive=1`, { headers: headers() });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.tree || []).filter((i: { type: string; path: string }) => i.type === "blob" && i.path.endsWith(".md")).map((i: { path: string }) => i.path);
}

export async function getLog(workspaceId: string, filepath?: string, depth = 50) {
  await ensureRepo(workspaceId);
  const repo = repoName(workspaceId);
  let url = `${API_BASE}/repos/${GITHUB_OWNER}/${repo}/commits?per_page=${depth}`;
  if (filepath) url += `&path=${encodeURIComponent(filepath)}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) return [];
  const commits = await res.json();
  return commits.map((c: { sha: string; commit: { message: string; author: { name: string; date: string } } }) => ({
    oid: c.sha,
    commit: { message: c.commit.message, author: { name: c.commit.author.name, email: "", timestamp: new Date(c.commit.author.date).getTime() / 1000, timezoneOffset: 0 } },
    payload: "",
  }));
}

export async function deleteDocument(
  workspaceId: string, filepath: string,
  author: { name: string; email: string }, message: string,
) {
  await ensureRepo(workspaceId);
  const repo = repoName(workspaceId);
  const url = `${API_BASE}/repos/${GITHUB_OWNER}/${repo}/contents/${encodeURIComponent(filepath)}`;
  const existing = await fetch(url, { headers: headers() });
  if (!existing.ok) throw new Error("File not found");
  const { sha } = await existing.json();
  const res = await fetch(url, { method: "DELETE", headers: headers(), body: JSON.stringify({ message, sha, committer: author, author }) });
  if (!res.ok) throw new Error(`GitHub delete failed: ${res.status}`);
}

export async function getHeadSha(_workspaceId: string) { return null; }
