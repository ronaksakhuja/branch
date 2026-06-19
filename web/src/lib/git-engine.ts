import git from "isomorphic-git";
import { getDb } from "@/db";
import { gitObjects, gitRefs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";

export async function initWorkspaceRepo(workspaceId: string) {
  const dir = `/tmp/branch-git-${workspaceId}`;
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  await git.init({ fs: nodeFs(dir), dir, defaultBranch: "main" });

  await saveGitState(workspaceId, dir);
  fs.rmSync(dir, { recursive: true, force: true });
}

export async function saveGitState(workspaceId: string, dir: string) {
  const db = getDb();
  const objectsDir = path.join(dir, ".git", "objects");

  if (!fs.existsSync(objectsDir)) return;

  for (const { hash, content } of collectObjects(objectsDir)) {
    const type = detectType(content);
    await db
      .insert(gitObjects)
      .values({ workspaceId, hash, type, content: Buffer.from(content).toString("base64") })
      .onConflictDoUpdate({
        target: [gitObjects.workspaceId, gitObjects.hash],
        set: { content: Buffer.from(content).toString("base64"), type },
      });
  }

  const refPath = path.join(dir, ".git", "refs", "heads", "main");
  if (fs.existsSync(refPath)) {
    const targetHash = fs.readFileSync(refPath, "utf8").trim();
    await db
      .insert(gitRefs)
      .values({ workspaceId, ref: "refs/heads/main", targetHash })
      .onConflictDoUpdate({
        target: [gitRefs.workspaceId, gitRefs.ref],
        set: { targetHash },
      });
  }
}

function detectType(content: Uint8Array): "blob" | "tree" | "commit" | "tag" {
  const text = Buffer.from(content).toString("utf8", 0, 20);
  if (text.startsWith("commit ")) return "commit";
  if (text.startsWith("tree ")) return "tree";
  if (text.startsWith("blob ")) return "blob";
  return "blob";
}

function collectObjects(objectsDir: string): { hash: string; content: Uint8Array }[] {
  const results: { hash: string; content: Uint8Array }[] = [];
  if (!fs.existsSync(objectsDir)) return results;

  for (const entry of fs.readdirSync(objectsDir)) {
    const full = path.join(objectsDir, entry);
    if (fs.statSync(full).isDirectory()) {
      for (const file of fs.readdirSync(full)) {
        const hash = entry + file;
        results.push({ hash, content: fs.readFileSync(path.join(full, file)) });
      }
    }
  }
  return results;
}

export async function loadGitState(workspaceId: string, dir: string) {
  const db = getDb();
  const gitDir = path.join(dir, ".git");

  fs.mkdirSync(path.join(gitDir, "objects"), { recursive: true });
  fs.mkdirSync(path.join(gitDir, "refs", "heads"), { recursive: true });

  const refs = await db
    .select()
    .from(gitRefs)
    .where(eq(gitRefs.workspaceId, workspaceId));

  for (const ref of refs) {
    const refPath = path.join(gitDir, ref.ref);
    fs.mkdirSync(path.dirname(refPath), { recursive: true });
    fs.writeFileSync(refPath, `${ref.targetHash}\n`);
  }

  fs.writeFileSync(path.join(gitDir, "HEAD"), "ref: refs/heads/main\n");

  const headRef = refs.find((r) => r.ref === "refs/heads/main");
  if (!headRef) return;

  const toLoad = new Set<string>();
  toLoad.add(headRef.targetHash);
  await expandHashes(workspaceId, headRef.targetHash, toLoad);

  for (const hash of toLoad) {
    const rows = await db
      .select()
      .from(gitObjects)
      .where(and(eq(gitObjects.workspaceId, workspaceId), eq(gitObjects.hash, hash)))
      .limit(1);

    if (rows.length > 0) {
      const prefix = hash.slice(0, 2);
      const suffix = hash.slice(2);
      const objDir = path.join(gitDir, "objects", prefix);
      fs.mkdirSync(objDir, { recursive: true });
      fs.writeFileSync(path.join(objDir, suffix), Buffer.from(rows[0].content, "base64"));
    }
  }
}

async function expandHashes(workspaceId: string, hash: string, set: Set<string>) {
  if (set.has(hash)) return;
  set.add(hash);

  const db = getDb();
  const rows = await db
    .select()
    .from(gitObjects)
    .where(and(eq(gitObjects.workspaceId, workspaceId), eq(gitObjects.hash, hash)))
    .limit(1);

  if (rows.length === 0) return;

  const textContent = Buffer.from(rows[0].content, "base64").toString("utf8");
  const objType = rows[0].type;

  if (objType === "commit" || textContent.startsWith("commit ")) {
    const matches = textContent.match(/[a-f0-9]{40}/g);
    if (matches) {
      for (const m of matches) await expandHashes(workspaceId, m, set);
    }
  }

  if (objType === "tree") {
    const hex = Buffer.from(rows[0].content, "base64").toString("hex");
    const matches = hex.match(/[a-f0-9]{40}/g);
    if (matches) {
      for (const m of matches) await expandHashes(workspaceId, m, set);
    }
  }
}

function nodeFs(dir: string) {
  const resolvePath = (p: string) => {
    const rel = p.replace(dir, "").replace(/^\//, "");
    return path.join(dir, rel);
  };

  return {
    promises: {
      readFile: async (p: string) => fs.readFileSync(resolvePath(p)),
      writeFile: async (p: string, data: Uint8Array) => {
        const fp = resolvePath(p);
        fs.mkdirSync(path.dirname(fp), { recursive: true });
        fs.writeFileSync(fp, data);
      },
      unlink: async (p: string) => {
        const fp = resolvePath(p);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      },
      readdir: async (p: string) => {
        const fp = resolvePath(p);
        return fs.existsSync(fp) ? fs.readdirSync(fp) : [];
      },
      mkdir: async (p: string) => fs.mkdirSync(resolvePath(p), { recursive: true }),
      rmdir: async () => {},
      stat: async (p: string) => {
        const fp = resolvePath(p);
        if (!fs.existsSync(fp)) throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
        return fs.statSync(fp);
      },
      lstat: async (p: string) => {
        const fp = resolvePath(p);
        if (!fs.existsSync(fp)) throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
        return fs.lstatSync(fp);
      },
      readlink: async () => { throw Object.assign(new Error("ENOENT"), { code: "ENOENT" }); },
      symlink: async () => {},
    },
  };
}

export async function commitDocument(
  workspaceId: string,
  filepath: string,
  content: string,
  author: { name: string; email: string },
  message: string,
) {
  const dir = `/tmp/branch-git-${workspaceId}-${randomUUID().slice(0, 8)}`;
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  await git.init({ fs: nodeFs(dir), dir, defaultBranch: "main" });
  await loadGitState(workspaceId, dir);

  const fileDir = path.join(dir, filepath);
  fs.mkdirSync(path.dirname(fileDir), { recursive: true });
  fs.writeFileSync(fileDir, content);

  await git.add({ fs: nodeFs(dir), dir, filepath });

  const sha = await git.commit({
    fs: nodeFs(dir),
    dir,
    message,
    author: { ...author, timestamp: Math.floor(Date.now() / 1000), timezoneOffset: 0 },
  });

  await saveGitState(workspaceId, dir);
  fs.rmSync(dir, { recursive: true, force: true });

  return sha;
}

export async function readDocument(
  workspaceId: string,
  filepath: string,
): Promise<string | null> {
  const dir = `/tmp/branch-git-${workspaceId}-${randomUUID().slice(0, 8)}`;
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  await git.init({ fs: nodeFs(dir), dir, defaultBranch: "main" });
  await loadGitState(workspaceId, dir);

  const headSha = await getHeadShaDirect(workspaceId);
  if (!headSha) {
    fs.rmSync(dir, { recursive: true, force: true });
    return null;
  }

  try {
    await git.checkout({ fs: nodeFs(dir), dir, ref: headSha, force: true });
    const fullPath = path.join(dir, filepath);
    const result = fs.existsSync(fullPath) ? fs.readFileSync(fullPath, "utf8") : null;
    fs.rmSync(dir, { recursive: true, force: true });
    return result;
  } catch {
    fs.rmSync(dir, { recursive: true, force: true });
    return null;
  }
}

export async function listFiles(workspaceId: string): Promise<string[]> {
  const dir = `/tmp/branch-git-${workspaceId}-${randomUUID().slice(0, 8)}`;
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  await git.init({ fs: nodeFs(dir), dir, defaultBranch: "main" });
  await loadGitState(workspaceId, dir);

  const headSha = await getHeadShaDirect(workspaceId);
  if (!headSha) {
    fs.rmSync(dir, { recursive: true, force: true });
    return [];
  }

  try {
    const files = await git.listFiles({ fs: nodeFs(dir), dir, ref: headSha });
    fs.rmSync(dir, { recursive: true, force: true });
    return files;
  } catch {
    fs.rmSync(dir, { recursive: true, force: true });
    return [];
  }
}

export async function getLog(
  workspaceId: string,
  filepath?: string,
  depth = 50,
) {
  const dir = `/tmp/branch-git-${workspaceId}-${randomUUID().slice(0, 8)}`;
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  await git.init({ fs: nodeFs(dir), dir, defaultBranch: "main" });
  await loadGitState(workspaceId, dir);

  const headSha = await getHeadShaDirect(workspaceId);
  if (!headSha) {
    fs.rmSync(dir, { recursive: true, force: true });
    return [];
  }

  try {
    const log = await git.log({ fs: nodeFs(dir), dir, ref: headSha, depth, filepath });
    fs.rmSync(dir, { recursive: true, force: true });
    return log;
  } catch {
    fs.rmSync(dir, { recursive: true, force: true });
    return [];
  }
}

export async function diffGit(
  _workspaceId: string,
  _refA: string,
  _refB: string,
): Promise<string | null> {
  return null;
}

async function getHeadShaDirect(workspaceId: string) {
  const db = getDb();
  const rows = await db
    .select({ targetHash: gitRefs.targetHash })
    .from(gitRefs)
    .where(and(eq(gitRefs.workspaceId, workspaceId), eq(gitRefs.ref, "refs/heads/main")))
    .limit(1);
  return rows.length > 0 ? rows[0].targetHash : null;
}

export { getHeadShaDirect as getHeadSha };
