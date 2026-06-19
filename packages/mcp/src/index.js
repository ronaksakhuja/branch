#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API = process.env.BRANCH_API_URL || "https://web-iota-ruby-62.vercel.app";
const USER_ID = process.env.BRANCH_USER_ID || "";
const WORKSPACE = process.env.BRANCH_WORKSPACE || "";

if (!USER_ID) { console.error("BRANCH_USER_ID is required."); process.exit(1); }
if (!WORKSPACE) { console.error("BRANCH_WORKSPACE is required."); process.exit(1); }

function headers() {
  return { Authorization: `Bearer ${USER_ID}.cli`, "Content-Type": "application/json" };
}

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, { ...opts, headers: { ...headers(), ...opts.headers } });
  if (!res.ok) { const body = await res.text(); throw new Error(`${res.status}: ${body}`); }
  return res.json();
}

const server = new McpServer({ name: "branch", version: "0.1.0" }, { capabilities: { tools: {} } });

server.tool("list_documents", "List all documents in the Branch workspace",
  {},
  async () => {
    const docs = await api(`/api/workspaces/${WORKSPACE}/documents`);
    return { content: [{ type: "text", text: JSON.stringify(docs, null, 2) }] };
  },
);

server.tool("get_document", "Read the full content of a document",
  { path: z.string().describe("Document path, e.g. startup/plan.md") },
  async ({ path }) => {
    const doc = await api(`/api/workspaces/${WORKSPACE}/documents/${encodeURIComponent(path)}`);
    return { content: [{ type: "text", text: doc.content || "" }] };
  },
);

server.tool("view_history", "View version history of a document",
  { path: z.string().describe("Document path") },
  async ({ path }) => {
    const versions = await api(`/api/workspaces/${WORKSPACE}/documents/${encodeURIComponent(path)}/versions`);
    const summary = versions.map((v) => ({ version: v.versionNumber, summary: v.summary, author: v.authorName, date: v.createdAt }));
    return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
  },
);

server.tool("create_document", "Create a new document in the workspace",
  {
    path: z.string().describe("Document path, e.g. notes/ideas.md"),
    content: z.string().describe("Full markdown content"),
    summary: z.string().describe("Description of this change"),
  },
  async ({ path, content, summary }) => {
    await api(`/api/workspaces/${WORKSPACE}/documents`, { method: "POST", body: JSON.stringify({ path, content, summary }) });
    return { content: [{ type: "text", text: `Created ${path}` }] };
  },
);

server.tool("update_document", "Update an existing document",
  {
    path: z.string().describe("Document path"),
    content: z.string().describe("New full markdown content"),
    summary: z.string().describe("Description of what changed"),
  },
  async ({ path, content, summary }) => {
    await api(`/api/workspaces/${WORKSPACE}/documents/${encodeURIComponent(path)}`, {
      method: "PUT", body: JSON.stringify({ content, summary, authorType: "AI" }),
    });
    return { content: [{ type: "text", text: `Updated ${path}\nSummary: ${summary}` }] };
  },
);

server.tool("propose_document_update", "Read current content of a document to propose changes",
  { path: z.string().describe("Document path") },
  async ({ path }) => {
    const doc = await api(`/api/workspaces/${WORKSPACE}/documents/${encodeURIComponent(path)}`);
    return { content: [{ type: "text", text: `Current content of ${path}:\n\n${doc.content}` }] };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`Branch MCP server ready — workspace: ${WORKSPACE}`);
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
