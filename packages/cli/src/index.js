#!/usr/bin/env node

import { createServer } from "node:http";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const branchDirectoryName = ".branch";
const configFileName = "config.json";
const DEFAULT_API_URL = process.env.BRANCH_API_URL || "https://web-iota-ruby-62.vercel.app";

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function parseFlags(args) {
  const flags = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      flags[key] = true;
      continue;
    }
    flags[key] = next;
    index += 1;
  }
  return flags;
}

function ensureDirectory(path) {
  mkdirSync(path, { recursive: true });
}

function findWorkspaceRoot(start = process.cwd()) {
  let current = resolve(start);
  while (current !== dirname(current)) {
    if (existsSync(join(current, branchDirectoryName, configFileName))) {
      return current;
    }
    current = dirname(current);
  }
  return null;
}

function readConfig(root) {
  return JSON.parse(readFileSync(join(root, branchDirectoryName, configFileName), "utf8"));
}

function writeConfig(root, config) {
  writeFileSync(join(root, branchDirectoryName, configFileName), `${JSON.stringify(config, null, 2)}\n`);
}

function requireConfig() {
  const root = findWorkspaceRoot();
  if (!root) fail("No Branch workspace found. Run `branch init` first.");
  return { root, config: readConfig(root) };
}

function getAuth(config) {
  const userId = process.env.BRANCH_USER_ID || config.userId;
  if (!userId) fail("Not authenticated. Run `branch auth` first.");
  return `Bearer ${userId}.cli`;
}

async function apiFetch(config, path, options = {}) {
  const url = `${DEFAULT_API_URL}${path}`;
  const headers = {
    Authorization: getAuth(config),
    "Content-Type": "application/json",
    ...options.headers,
  };
  const res = await fetch(url, { ...options, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) fail(`API ${res.status}: ${body.error || "Unknown error"}`);
  return body;
}

function readLocalDocuments(root) {
  const files = [];
  function walk(directory) {
    for (const entry of readdirSync(directory)) {
      if (entry === branchDirectoryName || entry === "node_modules" || entry === ".git" || entry === ".next") continue;
      const absolutePath = join(directory, entry);
      const details = statSync(absolutePath);
      if (details.isDirectory()) { walk(absolutePath); continue; }
      if (details.isFile() && entry.endsWith(".md")) {
        files.push({ path: relative(root, absolutePath).split("\\").join("/"), content: readFileSync(absolutePath, "utf8") });
      }
    }
  }
  walk(root);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function getLocalChanges(root, pulledState) {
  const local = readLocalDocuments(root);
  const pulled = pulledState || {};
  const changes = [];
  const localByPath = new Map(local.map((f) => [f.path, f]));
  for (const file of local) {
    const pd = pulled[file.path];
    if (!pd) { changes.push({ type: "added", path: file.path, content: file.content }); }
    else if (file.content !== pd.content) { changes.push({ type: "changed", path: file.path, before: pd.content, after: file.content }); }
  }
  for (const [path, pd] of Object.entries(pulled)) {
    if (!localByPath.has(path)) changes.push({ type: "removed", path, before: pd.content });
  }
  return changes;
}

function buildLineDiff(before = "", after = "") {
  const bl = before.split("\n"), al = after.split("\n");
  const out = [];
  let pi = 0, ci = 0;
  while (pi < bl.length && ci < al.length) {
    if (bl[pi] === al[ci]) { if (bl[pi] !== "") out.push(` ${bl[pi]}`); pi++; ci++; continue; }
    const np = bl.slice(pi + 1).indexOf(al[ci]), nc = al.slice(ci + 1).indexOf(bl[pi]);
    if (np !== -1 && (nc === -1 || np <= nc)) {
      for (let i = 0; i <= np; i++) { if (bl[pi + i] !== "") out.push(`-${bl[pi + i]}`); }
      pi += np + 1; if (bl[pi] !== "") out.push(` ${bl[pi]}`); pi++; ci++;
    } else if (nc !== -1) {
      for (let i = 0; i <= nc; i++) { if (al[ci + i] !== "") out.push(`+${al[ci + i]}`); }
      ci += nc + 1; if (al[ci] !== "") out.push(` ${al[ci]}`); ci++; pi++;
    } else {
      if (bl[pi] !== "") out.push(`-${bl[pi]}`); if (al[ci] !== "") out.push(`+${al[ci]}`); pi++; ci++;
    }
  }
  while (pi < bl.length) { if (bl[pi] !== "") out.push(`-${bl[pi]}`); pi++; }
  while (ci < al.length) { if (al[ci] !== "") out.push(`+${al[ci]}`); ci++; }
  return out.join("\n");
}

async function commandAuth() {
  const root = findWorkspaceRoot() || process.cwd();
  const branchDir = join(root, branchDirectoryName);
  const configPath = join(branchDir, configFileName);

  if (!existsSync(configPath)) {
    await commandInit();
  }

  const config = readConfig(root);
  const port = 9876;

  console.log("Opening browser for authentication...");

  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url || "/", `http://localhost:${port}`);
      const userId = url.searchParams.get("userId");

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`<!DOCTYPE html><html><body style="font-family:system-ui;text-align:center;padding:40px"><h2>Branch CLI</h2><p>${userId ? "Authenticated. You can close this window." : "Authentication failed."}</p></body></html>`);

      if (userId) {
        config.userId = userId;
        config.workspaceSlug = config.workspaceSlug || process.env.BRANCH_WORKSPACE || "";
        writeConfig(root, config);
        console.log(`Authenticated as ${userId}`);
      } else {
        console.log("Authentication failed. Make sure you are signed in on the web app.");
      }

      server.close();
      resolve();
    });

    server.listen(port, () => {
      const authUrl = `${DEFAULT_API_URL}/auth/cli?port=${port}`;
      try {
        execSync(`open "${authUrl}"`);
      } catch {
        console.log(`Please open: ${authUrl}`);
      }
    });
  });
}

async function commandInit() {
  const root = findWorkspaceRoot() || process.cwd();
  const branchDir = join(root, branchDirectoryName);
  const configPath = join(branchDir, configFileName);

  if (existsSync(configPath)) {
    console.log("Branch workspace already initialized.");
    return;
  }

  ensureDirectory(branchDir);
  writeConfig(root, { userId: null, workspaceSlug: process.env.BRANCH_WORKSPACE || null, workspaceId: null, pulledState: {} });
  console.log("Initialized Branch workspace.");
  console.log("Run `branch auth` to authenticate.");
}

async function commandPull() {
  const { root, config } = requireConfig();
  const workspaceId = config.workspaceId || config.workspaceSlug || process.env.BRANCH_WORKSPACE;
  if (!workspaceId) fail("No workspace configured. Set BRANCH_WORKSPACE or add slug to config.");

  const data = await apiFetch(config, `/api/workspaces/${workspaceId}/pull`);
  const pulledState = {};
  for (const doc of data.documents) {
    const target = join(root, doc.path);
    ensureDirectory(dirname(target));
    writeFileSync(target, doc.content);
    pulledState[doc.path] = { versionId: doc.currentVersionId, versionNumber: doc.versionNumber, content: doc.content };
  }
  config.pulledState = pulledState;
  config.workspaceId = data.workspaceId;
  writeConfig(root, config);
  console.log(`Pulled ${data.documents.length} documents.`);
}

async function commandStatus({ json = false } = {}) {
  const { root, config } = requireConfig();
  const changes = getLocalChanges(root, config.pulledState);
  if (json) { console.log(JSON.stringify({ changes }, null, 2)); return; }
  if (changes.length === 0) { console.log("No local changes."); return; }
  for (const c of changes) console.log(`${c.type.padEnd(7)} ${c.path}`);
}

async function commandDiff({ json = false } = {}) {
  const { root, config } = requireConfig();
  const changes = getLocalChanges(root, config.pulledState);
  if (json) { console.log(JSON.stringify({ changes }, null, 2)); return; }
  if (changes.length === 0) { console.log("No local changes."); return; }
  for (const c of changes) {
    console.log(`\n--- ${c.path}\n+++ ${c.path}`);
    if (c.type === "added") console.log(buildLineDiff("", c.content));
    else if (c.type === "removed") console.log(buildLineDiff(c.before, ""));
    else console.log(buildLineDiff(c.before, c.after));
  }
}

async function commandPush({ author = "Human", summary = "Updated documents." } = {}) {
  const { root, config } = requireConfig();
  const workspaceId = config.workspaceId || config.workspaceSlug || process.env.BRANCH_WORKSPACE;
  if (!workspaceId) fail("No workspace configured.");

  const changes = getLocalChanges(root, config.pulledState);
  if (changes.length === 0) { console.log("No local changes to push."); return; }

  for (const change of changes) {
    const ep = encodeURIComponent(change.path);
    if (change.type === "removed") {
      await apiFetch(config, `/api/workspaces/${workspaceId}/documents/${ep}`, { method: "DELETE", body: JSON.stringify({ summary }) });
      continue;
    }
    if (config.pulledState?.[change.path]) {
      await apiFetch(config, `/api/workspaces/${workspaceId}/documents/${ep}`, { method: "PUT", body: JSON.stringify({ content: change.after || change.content, summary, authorType: author.toLowerCase() === "human" ? "Human" : "AI" }) });
    } else {
      await apiFetch(config, `/api/workspaces/${workspaceId}/documents`, { method: "POST", body: JSON.stringify({ path: change.path, content: change.content, summary }) });
    }
  }
  console.log(`Pushed ${changes.length} change${changes.length === 1 ? "" : "s"}.`);
  console.log(`Author: ${author}`);
  console.log(`Summary: ${summary}`);
  console.log("Run `branch pull` to update local state.");
}

async function commandHistory({ json = false } = {}) {
  const { root, config } = requireConfig();
  const workspaceId = config.workspaceId || config.workspaceSlug || process.env.BRANCH_WORKSPACE;
  if (!workspaceId) fail("No workspace configured.");

  const allPaths = Object.keys(config.pulledState || {});
  const versions = [];
  for (const path of allPaths) {
    try {
      const res = await fetch(`${DEFAULT_API_URL}/api/workspaces/${workspaceId}/documents/${encodeURIComponent(path)}/versions`, { headers: { Authorization: getAuth(config) } });
      if (!res.ok) continue;
      const data = await res.json();
      for (const v of data) versions.push({ path, ...v });
    } catch { continue; }
  }
  versions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  if (json) { console.log(JSON.stringify({ versions }, null, 2)); return; }
  if (versions.length === 0) { console.log("No versions yet."); return; }
  for (const v of versions) {
    console.log(`v${v.versionNumber} ${v.path}\n  ${v.summary}\n  Author: ${v.authorName} | ${new Date(v.createdAt).toLocaleString()}\n`);
  }
}

async function commandHelp() {
  console.log(`Branch CLI\n\nCommands:\n  branch auth               Sign in via browser\n  branch init               Initialize workspace\n  branch pull               Download documents\n  branch status [--json]    Show local changes\n  branch diff [--json]      Show detailed diffs\n  branch push [--author X] [--summary "msg"]  Upload changes\n  branch history [--json]   View version history\n\nSetup:\n  BRANCH_WORKSPACE=r        Workspace slug\n  BRANCH_API_URL=...         Custom API URL (default: deployed app)\n`);
}

async function main() {
  const [, , command = "help", ...args] = process.argv;
  const flags = parseFlags(args);
  switch (command) {
    case "auth": await commandAuth(); break;
    case "init": await commandInit(); break;
    case "pull": await commandPull(); break;
    case "status": await commandStatus({ json: Boolean(flags.json) }); break;
    case "diff": await commandDiff({ json: Boolean(flags.json) }); break;
    case "push": await commandPush({ author: typeof flags.author === "string" ? flags.author : "Human", summary: typeof flags.summary === "string" ? flags.summary : "Updated documents." }); break;
    case "history": await commandHistory({ json: Boolean(flags.json) }); break;
    case "help": case "--help": case "-h": await commandHelp(); break;
    default: fail(`Unknown command: ${command}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => fail(error.message));
}
