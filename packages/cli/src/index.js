#!/usr/bin/env node

import { createServer } from "node:http";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { realpathSync } from "node:fs";
import { randomBytes } from "node:crypto";

const B = "\u001b[1m";
const D = "\u001b[2m";
const R = "\u001b[0m";
const GREEN = "\u001b[32m";
const RED = "\u001b[31m";
const YELLOW = "\u001b[33m";
const CYAN = "\u001b[36m";
const GRAY = "\u001b[90m";

const branchDir = ".branch";
const configFile = "config.json";
const API = process.env.BRANCH_API_URL || "https://branchcli.vercel.app";

let spinnerTimer = null;
function spin(msg) { process.stdout.write(`\r${GRAY}  ${msg}${R}`); spinnerTimer = setInterval(() => {}, 100); }
function spinDone() { if (spinnerTimer) { clearInterval(spinnerTimer); process.stdout.write(`\r${" ".repeat(60)}\r`); } }

function die(msg) { console.error(`${RED}${B}✗${R} ${msg}`); process.exit(1); }
function ok(msg) { console.log(`${GREEN}${B}✓${R} ${msg}`); }
function info(msg) { console.log(`${GRAY}  ${msg}${R}`); }
function warn(msg) { console.log(`${YELLOW}${B}!${R} ${msg}`); }
function key(k, v) { console.log(`  ${GRAY}${k.padEnd(12)}${R} ${v}`); }

function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith("-")) continue;
    const k = a.replace(/^--?/, "");
    const n = args[i + 1];
    if (!n || n.startsWith("-")) { flags[k] = true; continue; }
    flags[k] = n; i++;
  }
  return flags;
}

function ensureDir(p) { mkdirSync(p, { recursive: true }); }

function findRoot(start = process.cwd()) {
  let c = resolve(start);
  while (c !== dirname(c)) {
    if (existsSync(join(c, branchDir, configFile))) return c;
    c = dirname(c);
  }
  return null;
}

function readCfg(root) { return JSON.parse(readFileSync(join(root, branchDir, configFile), "utf8")); }
function writeCfg(root, cfg) { writeFileSync(join(root, branchDir, configFile), JSON.stringify(cfg, null, 2) + "\n"); }

function reqCfg() {
  const root = findRoot();
  if (!root) die("No workspace found. Run ${B}branch init${R} first.");
  return { root, cfg: readCfg(root) };
}

function authHeader(cfg) {
  const uid = process.env.BRANCH_USER_ID || cfg.userId;
  if (!uid) die("Not logged in. Run ${B}branch login${R} first.");
  return `Bearer ${uid}.cli`;
}

async function api(cfg, path, opts = {}) {
  const url = `${API}${path}`;
  const h = { Authorization: authHeader(cfg), "Content-Type": "application/json", ...opts.headers };
  const res = await fetch(url, { ...opts, headers: h });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) die(`API ${res.status}: ${body.error || "Unknown error"}`);
  return body;
}

function readLocalMarkdown(root) {
  const files = [];
  function walk(d) {
    for (const e of readdirSync(d)) {
      if (e === branchDir || e === "node_modules" || e === ".git" || e === ".next") continue;
      const fp = join(d, e); const st = statSync(fp);
      if (st.isDirectory()) { walk(fp); continue; }
      if (st.isFile() && e.endsWith(".md")) files.push({ path: relative(root, fp).split("\\").join("/"), content: readFileSync(fp, "utf8") });
    }
  }
  walk(root);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function localChanges(root, pulled) {
  const local = readLocalMarkdown(root);
  const pulledMap = pulled || {};
  const changes = [];
  const localMap = new Map(local.map(f => [f.path, f]));
  for (const f of local) {
    const p = pulledMap[f.path];
    if (!p) changes.push({ type: "added", path: f.path, content: f.content });
    else if (f.content !== p.content) changes.push({ type: "changed", path: f.path, before: p.content, after: f.content });
  }
  for (const [path, p] of Object.entries(pulledMap)) {
    if (!localMap.has(path)) changes.push({ type: "removed", path, before: p.content });
  }
  return changes;
}

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString("en", { month: "short", day: "numeric" });
}

async function cmdInit() {
  const root = process.cwd();
  const cfgPath = join(root, branchDir, configFile);

  if (existsSync(cfgPath)) {
    console.log(`${GRAY}Workspace already initialized.${R}`);
    return;
  }

  ensureDir(join(root, branchDir));
  writeCfg(root, { userId: null, workspaceSlug: process.env.BRANCH_WORKSPACE || null, workspaceId: null, pulledState: {} });
  ok("Workspace initialized.");
  console.log(`  ${GRAY}Run ${B}branch login${R}${GRAY} to authenticate.${R}`);
}

async function cmdLogin() {
  const root = findRoot() || process.cwd();
  const cfgPath = join(root, branchDir, configFile);

  if (!existsSync(cfgPath)) {
    ensureDir(join(root, branchDir));
    writeCfg(root, { userId: null, workspaceSlug: process.env.BRANCH_WORKSPACE || null, workspaceId: null, pulledState: {} });
  }

  const cfg = readCfg(root);
  const port = 1024 + (Math.abs(randomBytes(2).readUInt16BE(0)) % 64000);

  console.log(`${CYAN}${B}Opening browser to authenticate...${R}`);
  console.log(`${GRAY}  ${API}/auth/cli?port=${port}${R}\n`);

  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url || "/", `http://localhost:${port}`);
      const userId = url.searchParams.get("userId");

      if (userId) {
        cfg.userId = userId;
        writeCfg(root, cfg);
        ok(`Logged in as ${userId}`);
        if (!cfg.workspaceSlug && !process.env.BRANCH_WORKSPACE) {
          console.log(`  ${GRAY}Set workspace: ${B}branch workspace <slug>${R}`);
        }
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<!DOCTYPE html><html><body style=\"font-family:system-ui;text-align:center;padding:40px\"><h2>Branch CLI</h2><p>Authenticated. You can close this window.</p></body></html>");
        server.close();
        setTimeout(() => process.exit(0), 100);
        return;
      }

      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok");
    });

    server.on("error", (e) => die(`Port ${port} in use: ${e.message}`));

    server.listen(port, () => {
      try { execSync(`open "${API}/auth/cli?port=${port}"`); }
      catch { console.log(`  ${GRAY}Open: ${API}/auth/cli?port=${port}${R}`); }
    });
  });
}

async function cmdWhoami() {
  const { cfg } = reqCfg();
  const uid = cfg.userId;
  if (!uid) die("Not logged in. Run ${B}branch login${R}.");

  try {
    const data = await api(cfg, "/api/me");
    console.log(`${CYAN}${B}Branch CLI${R}`);
    key("User ID", uid);
    key("Workspace", cfg.workspaceSlug || cfg.workspaceId || "(not set)");
    key("API", API);
  } catch {
    warn("Could not reach server. Token may be valid.");
    key("User ID", uid);
  }
}

async function cmdWorkspace(args) {
  const { root, cfg } = reqCfg();

  if (args[0] === "list") {
    spin("Fetching workspaces...");
    try {
      const data = await api(cfg, "/api/workspaces");
      spinDone();
      if (data.length === 0) {
        warn("No workspaces found. Create one in the web app.");
        return;
      }
      for (const ws of data) {
        const active = ws.slug === cfg.workspaceSlug || ws.id === cfg.workspaceId;
        const marker = active ? `${GREEN}●${R}` : " ";
        console.log(`  ${marker} ${B}${ws.name}${R}  ${GRAY}${ws.slug}${R}`);
      }
      console.log(`\n  ${GRAY}${B}branch workspace <slug>${R}${GRAY} to select one.${R}`);
    } catch (e) {
      spinDone();
      warn(`Could not fetch workspaces: ${e.message}`);
    }
    return;
  }

  const slug = args[0];

  if (!slug) {
    key("Workspace", cfg.workspaceSlug || cfg.workspaceId || "(not set)");
    console.log(`  ${GRAY}${B}branch workspace list${R}${GRAY}  — see all workspaces${R}`);
    console.log(`  ${GRAY}${B}branch workspace <slug>${R}  — select one${R}`);
    return;
  }

  cfg.workspaceSlug = slug;
  cfg.workspaceId = null;
  cfg.pulledState = {};
  writeCfg(root, cfg);
  ok(`Workspace set to "${slug}"`);
  console.log(`  ${GRAY}Run ${B}branch pull${R}${GRAY} to download documents.${R}`);
}

async function cmdPull() {
  const { root, cfg } = reqCfg();
  const wsId = cfg.workspaceId || cfg.workspaceSlug || process.env.BRANCH_WORKSPACE;
  if (!wsId) die("No workspace. Run ${B}branch workspace <slug>${R}");

  spin(`Pulling from ${wsId}...`);
  const data = await api(cfg, `/api/workspaces/${wsId}/pull`);
  spinDone();

  const pulled = {};
  const pulledPaths = new Set();

  for (const doc of data.documents) {
    const fp = join(root, doc.path);
    ensureDir(dirname(fp));
    writeFileSync(fp, doc.content);
    pulled[doc.path] = { versionId: doc.currentVersionId, versionNumber: doc.versionNumber, content: doc.content };
    pulledPaths.add(doc.path);
  }

  for (const oldPath of Object.keys(cfg.pulledState || {})) {
    if (!pulledPaths.has(oldPath)) {
      const fp = join(root, oldPath);
      if (existsSync(fp)) {
        const { unlinkSync } = await import("node:fs");
        try { unlinkSync(fp); } catch {}
      }
    }
  }

  cfg.pulledState = pulled;
  cfg.workspaceId = data.workspaceId;
  writeCfg(root, cfg);

  const n = data.documents.length;
  ok(n === 0 ? "Workspace is empty." : `Pulled ${n} document${n !== 1 ? "s" : ""}.`);
}

async function cmdStatus({ json } = {}) {
  const { root, cfg } = reqCfg();
  const changes = localChanges(root, cfg.pulledState);

  if (json) { console.log(JSON.stringify({ workspace: cfg.workspaceSlug, changes }, null, 2)); return; }
  if (changes.length === 0) { ok("No local changes."); return; }

  for (const c of changes) {
    const icon = c.type === "added" ? `${GREEN}A${R}` : c.type === "removed" ? `${RED}D${R}` : `${YELLOW}M${R}`;
    console.log(`  ${icon}  ${c.path}`);
  }
  console.log(`\n${GRAY}  ${changes.length} change${changes.length !== 1 ? "s" : ""}. ${B}branch diff${R}${GRAY} to review, ${B}branch push${R}${GRAY} to save.${R}`);
}

async function cmdDiff({ json } = {}) {
  const { root, cfg } = reqCfg();
  const changes = localChanges(root, cfg.pulledState);

  if (json) { console.log(JSON.stringify({ changes }, null, 2)); return; }
  if (changes.length === 0) { ok("No local changes."); return; }

  for (const c of changes) {
    console.log(`\n${B}${c.path}${R}`);
    const bl = (c.before || "").split("\n");
    const al = (c.after || c.content || "").split("\n");

    let pi = 0, ci = 0;
    while (pi < bl.length || ci < al.length) {
      if (pi < bl.length && ci < al.length && bl[pi] === al[ci]) {
        console.log(` ${GRAY}${bl[pi]}${R}`);
        pi++; ci++;
        continue;
      }
      const np = ci < al.length ? bl.slice(pi + 1).indexOf(al[ci]) : -1;
      const nc = pi < bl.length ? al.slice(ci + 1).indexOf(bl[pi]) : -1;
      if (np !== -1 && (nc === -1 || np <= nc)) {
        for (let i = 0; i <= np; i++) { if (bl[pi + i]) console.log(`${RED}-${bl[pi + i]}${R}`); }
        pi += np + 1;
        if (bl[pi]) { console.log(` ${GRAY}${bl[pi]}${R}`); pi++; ci++; }
      } else if (nc !== -1) {
        for (let i = 0; i <= nc; i++) { if (al[ci + i]) console.log(`${GREEN}+${al[ci + i]}${R}`); }
        ci += nc + 1;
        if (al[ci]) { console.log(` ${GRAY}${al[ci]}${R}`); ci++; pi++; }
      } else {
        if (pi < bl.length && bl[pi]) console.log(`${RED}-${bl[pi]}${R}`);
        if (ci < al.length && al[ci]) console.log(`${GREEN}+${al[ci]}${R}`);
        pi++; ci++;
      }
    }
  }
}

async function cmdPush({ message, author } = {}) {
  const { root, cfg } = reqCfg();
  const wsId = cfg.workspaceId || cfg.workspaceSlug || process.env.BRANCH_WORKSPACE;
  if (!wsId) die("No workspace. Run ${B}branch workspace <slug>${R}");

  const changes = localChanges(root, cfg.pulledState);
  if (changes.length === 0) { ok("No local changes to push."); return; }

  const authorType = (author || "Human").toLowerCase() === "human" ? "Human" : "AI";
  const msg = message || `Updated ${changes.length} document${changes.length !== 1 ? "s" : ""}`;

  for (const c of changes) {
    const ep = encodeURIComponent(c.path);
    if (c.type === "removed") {
      await api(cfg, `/api/workspaces/${wsId}/documents/${ep}`, { method: "DELETE", body: JSON.stringify({ summary: msg }) });
      continue;
    }
    const exists = cfg.pulledState?.[c.path];
    if (exists) {
      await api(cfg, `/api/workspaces/${wsId}/documents/${ep}`, { method: "PUT", body: JSON.stringify({ content: c.after || c.content, summary: msg, authorType }) });
    } else {
      await api(cfg, `/api/workspaces/${wsId}/documents`, { method: "POST", body: JSON.stringify({ path: c.path, content: c.content, summary: msg }) });
    }
  }

  ok(`Pushed ${changes.length} change${changes.length !== 1 ? "s" : ""}.`);
  if (author) key("Author", author);
  key("Summary", msg);
  console.log(`  ${GRAY}Run ${B}branch pull${R}${GRAY} to sync local state.${R}`);
}

async function cmdLog({ file, json, oneline } = {}) {
  const { cfg } = reqCfg();
  const wsId = cfg.workspaceId || cfg.workspaceSlug || process.env.BRANCH_WORKSPACE;
  if (!wsId) die("No workspace. Run ${B}branch workspace <slug>${R}");

  spin("Loading history...");
  const allPaths = Object.keys(cfg.pulledState || {});
  const paths = file ? [file] : allPaths;

  const versions = [];
  for (const p of paths) {
    try {
      const data = await fetch(`${API}/api/workspaces/${wsId}/documents/${encodeURIComponent(p)}/versions`, { headers: { Authorization: authHeader(cfg) } });
      if (!data.ok) continue;
      const arr = await data.json();
      for (const v of arr) versions.push({ path: p, ...v });
    } catch { continue; }
  }
  spinDone();

  versions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (json) { console.log(JSON.stringify({ versions }, null, 2)); return; }
  if (versions.length === 0) { ok("No versions yet."); return; }

  if (oneline) {
    for (const v of versions.slice(0, 20)) {
      const n = `${GREEN}v${String(v.versionNumber).padEnd(3)}${R}`;
      const p = `  ${GRAY}${v.path}${R}`;
      const s = `  ${v.summary}`;
      const a = `  ${D}${v.authorName}${R}`;
      const t = `  ${GRAY}${timeAgo(v.createdAt)}${R}`;
      console.log(`${n}${s}${a}${t}`);
    }
    return;
  }

  for (const v of versions.slice(0, 20)) {
    console.log(`\n${B}${GREEN}v${v.versionNumber}${R}  ${GRAY}${v.path}${R}`);
    console.log(`  ${v.summary}`);
    key("Author", `${v.authorName} (${v.authorType})`);
    key("When", timeAgo(v.createdAt));
  }
}

async function cmdOpen(args) {
  const { cfg } = reqCfg();
  const ws = cfg.workspaceSlug || cfg.workspaceId;
  if (!ws) die("No workspace configured.");

  const file = args[0] || "";
  const url = `${API}/${file ? `?doc=${encodeURIComponent(file)}` : ""}`;
  try { execSync(`open "${url}"`); }
  catch { console.log(`Open: ${url}`); }
}

async function cmdHelp() {
  console.log(`
${B}${CYAN}Branch CLI${R}  ${GRAY}— Git for documents. Built for humans and AI.${R}

${B}Commands${R}

  ${B}branch login${R}              Authenticate via browser
  ${B}branch whoami${R}             Show current user and workspace
  ${B}branch workspace [slug]${R}   Set or view workspace
  ${B}branch pull${R}               Download documents from cloud
  ${B}branch status${R}             Show local changes
  ${B}branch diff${R}               Show detailed line-by-line diffs
  ${B}branch push${R}               Upload local changes to cloud
  ${B}branch log [file]${R}         Show version history
  ${B}branch open [file]${R}        Open workspace in browser

${B}Flags${R}

  ${B}--message, -m${R}     Commit summary
  ${B}--author, -a${R}      Author name (Human, Claude, etc.)
  ${B}--json${R}            Machine-readable output
  ${B}--oneline${R}         Compact log format

${B}Examples${R}

  ${GRAY}$ ${R}branch login
  ${GRAY}$ ${R}branch workspace ronak
  ${GRAY}$ ${R}branch pull
  ${GRAY}$ ${R}branch push -m "Updated MVP spec" -a Claude
  ${GRAY}$ ${R}branch log --oneline
  ${GRAY}$ ${R}branch diff --json

${B}Setup${R}

  export BRANCH_WORKSPACE=my-workspace
  export BRANCH_API_URL=https://branchcli.vercel.app
`);
}

async function main() {
  const [, , cmd, ...args] = process.argv;
  const flags = parseFlags(args);

  switch (cmd) {
    case undefined:
    case "status":
      await cmdStatus({ json: Boolean(flags.json) });
      break;
    case "init":
      await cmdInit();
      break;
    case "login":
      await cmdLogin();
      break;
    case "whoami":
      await cmdWhoami();
      break;
    case "workspace":
      await cmdWorkspace(args.filter(a => !a.startsWith("-")));
      break;
    case "pull":
      await cmdPull();
      break;
    case "diff":
      await cmdDiff({ json: Boolean(flags.json) });
      break;
    case "push":
      await cmdPush({ message: flags.m || flags.message, author: flags.a || flags.author });
      break;
    case "log":
    case "history":
      await cmdLog({ file: flags.file || args[0], json: Boolean(flags.json), oneline: Boolean(flags.oneline) });
      break;
    case "open":
      await cmdOpen(args);
      break;
    case "help":
    case "--help":
    case "-h":
      await cmdHelp();
      break;
    default:
      console.log(`${RED}Unknown command: ${cmd}${R}`);
      console.log(`${GRAY}Run ${B}branch help${R}${GRAY} for usage.${R}`);
      process.exit(1);
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(e => die(e.message));
}
