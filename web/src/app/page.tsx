"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useUser, SignInButton, SignOutButton } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import {
  fetchWorkspaces, createWorkspace, fetchDocuments, getDocument,
  createDocumentApi, updateDocument,
  fetchShareLinks, createShareLink, revokeShareLink,
  fetchMembers, createInvite, fetchInvites, cancelInvite, removeMember, deleteDocument,
} from "@/lib/api";

type AuthorType = "Human" | "AI";
type DocMeta = { id: string; path: string; title: string };
type VersionRecord = { id: string; versionNumber: number; content: string; summary: string; authorType: string; authorName: string; createdAt: string };
type DocumentRecord = { id: string; path: string; title: string; content: string; updatedAt: string; versions: VersionRecord[] };
type WorkspaceRecord = { id: string; name: string; slug: string; ownerId?: string; role?: string };

function slugify(t: string) { return t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function computeDiff(c: string, p: string) {
  if (c === p) return "";
  const cl = c.split("\n"), pl = p.split("\n"), o: string[] = [];
  let pi = 0, ci = 0;
  while (pi < pl.length && ci < cl.length) {
    if (pl[pi] === cl[ci]) { if (pl[pi]) o.push(` ${pl[pi]}`); pi++; ci++; continue; }
    const np = pl.slice(pi + 1).indexOf(cl[ci]), nc = cl.slice(ci + 1).indexOf(pl[pi]);
    if (np !== -1 && (nc === -1 || np <= nc)) { for (let i = 0; i <= np; i++) if (pl[pi + i]) o.push(`-${pl[pi + i]}`); pi += np + 1; if (pl[pi]) o.push(` ${pl[pi]}`); pi++; ci++; }
    else if (nc !== -1) { for (let i = 0; i <= nc; i++) if (cl[ci + i]) o.push(`+${cl[ci + i]}`); ci += nc + 1; if (cl[ci]) o.push(` ${cl[ci]}`); ci++; pi++; }
    else { if (pl[pi]) o.push(`-${pl[pi]}`); if (cl[ci]) o.push(`+${cl[ci]}`); pi++; ci++; }
  }
  while (pi < pl.length) { if (pl[pi]) o.push(`-${pl[pi]}`); pi++; }
  while (ci < cl.length) { if (cl[ci]) o.push(`+${cl[ci]}`); ci++; }
  return o.join("\n");
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now"; if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString("en", { month: "short", day: "numeric" });
}

const colors = ["#0071e3", "#30d158", "#ff9f0a", "#ff375f", "#5e5ce6", "#64d2ff", "#ac8e68"];
function wsColor(i: number) { return colors[i % colors.length]; }

function LandingPage() {
  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
      <header className="flex h-14 items-center justify-between px-6 border-b border-[#e5e5ea] bg-white/80 backdrop-blur-xl fixed top-0 inset-x-0 z-50">
        <span className="text-[17px] font-semibold tracking-tight">Branch</span>
        <div className="flex items-center gap-4">
          <a href="https://github.com/ronaksakhuja/branch" className="text-[14px] text-[#86868b] transition hover:text-[#1d1d1f]">GitHub</a>
          <a href="https://www.npmjs.com/package/getbranch" className="text-[14px] text-[#86868b] transition hover:text-[#1d1d1f]">CLI</a>
          <SignInButton mode="modal">
            <button className="rounded-full bg-[#0071e3] px-5 py-2 text-[14px] font-medium text-white transition hover:bg-[#0077ed] active:scale-[0.98]">Sign In</button>
          </SignInButton>
        </div>
      </header>

      <section className="pt-32 pb-20 px-6 text-center">
        <h1 className="text-[56px] font-bold tracking-[-0.04em] leading-[1.05] max-w-[700px] mx-auto">
          Git for documents.<br />Built for humans and AI.
        </h1>
        <p className="mt-6 text-[19px] text-[#86868b] max-w-[500px] mx-auto leading-relaxed">
          A markdown workspace where every change is tracked, every version is reviewable, and humans and AI edit the same source of truth.
        </p>
        <div className="mt-10 flex items-center justify-center gap-3">
          <SignInButton mode="modal">
            <button className="rounded-full bg-[#0071e3] px-8 py-3 text-[16px] font-medium text-white transition hover:bg-[#0077ed] active:scale-[0.98]">Get Started</button>
          </SignInButton>
          <a href="https://www.npmjs.com/package/getbranch" className="rounded-full border border-[#e5e5ea] bg-white px-8 py-3 text-[16px] font-medium text-[#1d1d1f] transition hover:bg-[#f5f5f7] active:scale-[0.98]">CLI →</a>
        </div>
      </section>

      <section className="py-20 px-6 bg-white">
        <div className="max-w-[900px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-10">
          {[
            { title: "Version History", desc: "Every edit creates a version. See what changed, when, and by whom — human or AI.", icon: "⟳" },
            { title: "AI Collaboration", desc: "Claude and ChatGPT read and edit documents through CLI, API, or MCP. You review before commit.", icon: "⚡" },
            { title: "Real Git", desc: "Every workspace is a private GitHub repo. Real commits, real diffs, real rollbacks. Export anytime.", icon: "⎇" },
          ].map((f) => (
            <div key={f.title} className="text-center">
              <div className="w-12 h-12 rounded-xl bg-[#f5f5f7] mx-auto mb-4 flex items-center justify-center text-2xl">{f.icon}</div>
              <h3 className="text-[17px] font-semibold">{f.title}</h3>
              <p className="mt-2 text-[14px] text-[#86868b] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-20 px-6">
        <div className="max-w-[900px] mx-auto text-center">
          <h2 className="text-[32px] font-semibold tracking-[-0.02em]">How it works</h2>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            {[
              { step: "01", title: "Create a workspace", desc: "A workspace holds your markdown documents. Each one gets a private GitHub repo." },
              { step: "02", title: "Write and edit", desc: "Use the web editor, local CLI, or let Claude propose changes. Everything is tracked." },
              { step: "03", title: "Review and share", desc: "See diffs, restore old versions, share read-only links with anyone." },
            ].map((s) => (
              <div key={s.step} className="rounded-2xl border border-[#e5e5ea] bg-white p-6">
                <span className="text-[11px] font-semibold text-[#0071e3] uppercase tracking-wider">{s.step}</span>
                <h3 className="mt-3 text-[17px] font-semibold">{s.title}</h3>
                <p className="mt-2 text-[14px] text-[#86868b] leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-[#1d1d1f] text-white">
        <div className="max-w-[700px] mx-auto text-center">
          <h2 className="text-[28px] font-semibold tracking-[-0.02em]">Built for the terminal, too</h2>
          <p className="mt-3 text-[15px] text-[#86868b]">One command to install. Zero dependencies. Works with Claude Code, Cursor, and any AI agent.</p>
          <div className="mt-8 bg-[#2d2d2f] rounded-2xl p-6 text-left font-mono text-[14px] leading-relaxed text-[#30d158] overflow-x-auto mx-auto max-w-[500px]">
            <span className="text-[#86868b]">$</span> npm i -g getbranch<br />
            <span className="text-[#86868b]">$</span> branch login<br />
            <span className="text-[#86868b]">$</span> branch workspace personal-finance<br />
            <span className="text-[#86868b]">$</span> branch pull<br />
            <span className="text-[#86868b]">$</span> branch push -m &quot;Updated budget&quot; -a Claude<br />
            <span className="text-[#86868b]">$</span> branch diff --json
          </div>
        </div>
      </section>

      <footer className="py-10 px-6 text-center border-t border-[#e5e5ea]">
        <p className="text-[13px] text-[#86868b]">
          Branch is open source.{" "}
          <a href="https://github.com/ronaksakhuja/branch" className="text-[#0071e3] hover:underline">github.com/ronaksakhuja/branch</a>
        </p>
      </footer>
    </div>
  );
}

export default function Home() {
  const { user, isLoaded } = useUser();
  if (!isLoaded) return <div className="flex h-screen items-center justify-center bg-[#f5f5f7]"><div className="h-1.5 w-32 rounded-full bg-[#e5e5ea] animate-pulse" /></div>;
  if (!user) return <LandingPage />;
  return <AppShell userId={user.id} />;
}

function AppShell({ userId }: { userId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlW = searchParams.get("w");
  const urlD = searchParams.get("d");

  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [newWsName, setNewWsName] = useState("");

  const refreshWorkspaces = useCallback(async () => {
    const data = await fetchWorkspaces(true);
    setWorkspaces(data);
  }, []);

  useEffect(() => { refreshWorkspaces().finally(() => setLoading(false)); }, [refreshWorkspaces]);

  if (loading) return <div className="flex h-screen items-center justify-center bg-[#f5f5f7]"><div className="h-1.5 w-32 rounded-full bg-[#e5e5ea] animate-pulse" /></div>;

  const currentWs = urlW ? workspaces.find((w) => w.slug === urlW || w.id === urlW) : null;

  if (urlW && currentWs) {
    return urlD
      ? <DocumentView key={`${urlW}-${urlD}`} workspaceId={currentWs.id} workspace={currentWs} userId={userId} workspaces={workspaces} />
      : <WorkspaceView key={urlW + (searchParams.get("_t") || "")} workspace={currentWs} userId={userId} workspaces={workspaces} refreshWorkspaces={refreshWorkspaces} />;
  }

  return <HomeView workspaces={workspaces} userId={userId} newWsName={newWsName} setNewWsName={setNewWsName} refreshWorkspaces={refreshWorkspaces} />;
}

function HomeView({ workspaces, userId, newWsName, setNewWsName, refreshWorkspaces }: { workspaces: WorkspaceRecord[]; userId: string; newWsName: string; setNewWsName: (v: string) => void; refreshWorkspaces: () => void }) {
  const router = useRouter();

  const yours = workspaces.filter((w) => !w.ownerId || w.ownerId === userId || w.role === "owner");
  const shared = workspaces.filter((w) => w.ownerId && w.ownerId !== userId && w.role !== "owner");

  async function create() {
    const n = newWsName.trim(); if (!n) return;
    const r = await createWorkspace(n, slugify(n));
    await refreshWorkspaces();
    router.replace(`/?w=${slugify(n)}`);
    setNewWsName("");
  }

  return (
    <div className="flex h-screen flex-col bg-[#f5f5f7]">
      <header className="flex h-12 items-center justify-between border-b border-[#e5e5ea] bg-white/80 backdrop-blur-xl px-5 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <button onClick={() => router.replace("/")} className="text-[15px] font-semibold text-[#1d1d1f] transition hover:opacity-70">Branch</button>
          <span className="text-[#c5c5ca] text-[13px]">—</span>
          <span className="text-[13px] text-[#86868b]">Workspaces</span>
        </div>
        <SignOutButton><button className="rounded-full border border-[#e5e5ea] bg-white px-3 py-1 text-[13px] text-[#86868b] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f]">Sign Out</button></SignOutButton>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[900px] px-6 py-10">
          {workspaces.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-14 h-14 rounded-2xl bg-[#e5e5ea] mb-4 flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="3" y="3" width="16" height="16" rx="3" stroke="#86868b" strokeWidth="1.5"/><line x1="7" y1="11" x2="15" y2="11" stroke="#86868b" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </div>
              <h2 className="text-xl font-semibold text-[#1d1d1f]">No workspaces yet</h2>
              <p className="mt-1 text-[15px] text-[#86868b]">Create one to get started.</p>
              <div className="mt-6 flex gap-2">
                <input className="rounded-lg border border-[#e5e5ea] bg-white px-3 py-2 text-[14px] w-48 outline-none focus:border-[#0071e3] focus:ring-1 focus:ring-[#0071e3]/20" placeholder="Workspace name" value={newWsName} onChange={(e) => setNewWsName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} />
                <button onClick={create} className="rounded-full bg-[#0071e3] px-5 py-2 text-[14px] font-medium text-white transition hover:bg-[#0077ed] active:scale-[0.98]">Create</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-[13px] font-semibold text-[#86868b] uppercase tracking-wider">Workspaces</h2>
                <div className="flex gap-2">
                  <input className="rounded-lg border border-[#e5e5ea] bg-white px-3 py-1.5 text-[13px] w-44 outline-none focus:border-[#0071e3]" placeholder="New workspace..." value={newWsName} onChange={(e) => setNewWsName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} />
                  <button onClick={create} className="rounded-full bg-[#0071e3] px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-[#0077ed] active:scale-[0.98]">+ New</button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {yours.map((w, i) => (
                  <button key={w.id} onClick={() => router.replace(`/?w=${w.slug}`)}
                    className="group relative rounded-2xl border border-[#e5e5ea] bg-white p-5 text-left transition hover:border-[#d0d0d5] hover:shadow-sm active:scale-[0.99]">
                    <div className="w-8 h-8 rounded-lg mb-3 flex items-center justify-center" style={{ backgroundColor: `${wsColor(i)}15`, color: wsColor(i) }}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="1.5" width="12" height="13" rx="2" stroke="currentColor" strokeWidth="1.3"/><line x1="5" y1="5" x2="11" y2="5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><line x1="5" y1="8" x2="11" y2="8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><line x1="5" y1="11" x2="9" y2="11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                    </div>
                    <h3 className="text-[15px] font-semibold text-[#1d1d1f]">{w.name}</h3>
                    <p className="mt-0.5 text-[13px] text-[#86868b]">{w.slug}</p>
                    {w.role && <span className="mt-2 inline-block rounded-md bg-[#f5f5f7] px-2 py-0.5 text-[11px] text-[#86868b]">{w.role}</span>}
                  </button>
                ))}
              </div>

              {shared.length > 0 && (
                <>
                  <h2 className="mt-10 mb-4 text-[13px] font-semibold text-[#86868b] uppercase tracking-wider">Shared with you</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {shared.map((w, i) => (
                      <button key={w.id} onClick={() => router.replace(`/?w=${w.slug}`)}
                        className="group relative rounded-2xl border border-[#e5e5ea] bg-white p-5 text-left transition hover:border-[#d0d0d5] hover:shadow-sm active:scale-[0.99]">
                        <div className="w-8 h-8 rounded-lg bg-[#f5f5f7] mb-3 flex items-center justify-center text-[#86868b]">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3"/><path d="M3 13c0-2.8 2.2-5 5-5s5 2.2 5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                        </div>
                        <h3 className="text-[15px] font-semibold text-[#1d1d1f]">{w.name}</h3>
                        <span className="mt-2 inline-block rounded-md bg-blue-50 px-2 py-0.5 text-[11px] text-[#0071e3]">Shared</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function WorkspaceView({ workspace, userId, workspaces, refreshWorkspaces }: { workspace: WorkspaceRecord; userId: string; workspaces: WorkspaceRecord[]; refreshWorkspaces: () => void }) {
  const router = useRouter();
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [newDocName, setNewDocName] = useState("");

  const refreshDocs = useCallback(async () => {
    const data = await fetchDocuments(workspace.id);
    setDocs(data);
  }, [workspace.id]);

  useEffect(() => { refreshDocs(); }, [refreshDocs]);

  async function createDoc() { const n = newDocName.trim() || "untitled"; const p = `notes/${n}.md`;
    try { await createDocumentApi(workspace.id, p, `# ${n}\n\n`, "Created"); setNewDocName(""); await refreshDocs(); router.replace(`/?w=${workspace.slug}&d=${encodeURIComponent(p)}`); } catch {}
  }

  return (
    <div className="flex h-screen flex-col bg-[#f5f5f7]">
      <header className="flex h-12 items-center border-b border-[#e5e5ea] bg-white/80 backdrop-blur-xl px-4 flex-shrink-0 gap-2">
        <button onClick={() => router.replace("/")} className="flex items-center gap-1 text-[13px] text-[#0071e3] font-medium transition hover:opacity-70">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Branch
        </button>
        <span className="text-[#c5c5ca]">/</span>
        <span className="text-[15px] font-semibold text-[#1d1d1f]">{workspace.name}</span>
        <span className="text-[12px] text-[#86868b] ml-1">— Documents</span>
        <div className="flex-1" />
        <SignOutButton><button className="rounded-full border border-[#e5e5ea] bg-white px-3 py-1 text-[13px] text-[#86868b] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f]">Sign Out</button></SignOutButton>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[900px] px-6 py-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[15px] font-semibold text-[#1d1d1f]">Documents</h2>
            <div className="flex gap-2">
              <input className="rounded-lg border border-[#e5e5ea] bg-white px-3 py-1.5 text-[13px] w-44 outline-none focus:border-[#0071e3]" placeholder="New document..." value={newDocName} onChange={(e) => setNewDocName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createDoc()} />
              <button onClick={createDoc} className="rounded-full bg-[#0071e3] px-4 py-1.5 text-[13px] font-medium text-white transition hover:bg-[#0077ed] active:scale-[0.98]">+ New</button>
            </div>
          </div>

          {docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 rounded-2xl border border-dashed border-[#e5e5ea]">
              <div className="w-12 h-12 rounded-xl bg-[#f5f5f7] mb-3 flex items-center justify-center text-[#86868b]">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/><line x1="10" y1="7" x2="10" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="7" y1="10" x2="13" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </div>
              <p className="text-[14px] text-[#86868b]">No documents yet</p>
              <p className="text-[12px] text-[#86868b] mt-0.5">Create your first document to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {docs.map((d) => (
                <button key={d.id} onClick={() => router.replace(`/?w=${workspace.slug}&d=${encodeURIComponent(d.path)}`)}
                  className="group relative rounded-2xl border border-[#e5e5ea] bg-white p-5 text-left transition hover:border-[#d0d0d5] hover:shadow-sm active:scale-[0.99]">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-md bg-[#f5f5f7] flex items-center justify-center text-[#86868b]">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="1" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><line x1="5" y1="5" x2="9" y2="5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><line x1="5" y1="8" x2="9" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                    </div>
                    <span className="text-[11px] text-[#86868b] truncate">{d.path}</span>
                  </div>
                  <h3 className="text-[15px] font-semibold text-[#1d1d1f] leading-snug">{d.title}</h3>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DocumentView({ workspaceId, workspace, userId, workspaces }: { workspaceId: string; workspace: WorkspaceRecord; userId: string; workspaces: WorkspaceRecord[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlD = searchParams.get("d");

  const [doc, setDoc] = useState<DocumentRecord | null>(null);
  const [draft, setDraft] = useState("");
  const [summary, setSummary] = useState("");
  const [author, setAuthor] = useState<AuthorType>("Human");
  const [mode, setMode] = useState<"view" | "edit" | "diff">("view");
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [shareLinks, setShareLinks] = useState<{ token: string; documentPath: string | null }[]>([]);
  const [members, setMembers] = useState<{ userId: string; role: string; name: string | null; email: string | null }[]>([]);
  const [invites, setInvites] = useState<{ id: string; email: string; role: string; token: string }[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const docCache = useRef<Map<string, DocumentRecord>>(new Map());

  const loadDoc = useCallback(async (path: string) => {
    const cached = docCache.current.get(path);
    if (cached) { setDoc(cached); setDraft(cached.content); setMode("view"); setSelectedVersionId(cached.versions.at(-1)?.id || null); return; }
    const d = await getDocument(workspaceId, path);
    docCache.current.set(path, d); setDoc(d); setDraft(d.content); setMode("view"); setSelectedVersionId(d.versions.at(-1)?.id || null);
  }, [workspaceId]);

  useEffect(() => { if (urlD) loadDoc(urlD); }, [urlD, loadDoc]);

  const selectedVersion = useMemo(() => doc ? doc.versions.find((v) => v.id === selectedVersionId) || doc.versions.at(-1) || null : null, [doc, selectedVersionId]);
  const changed = doc ? draft !== doc.content : false;

  async function save() { if (!doc || !changed || saving) return; setSaving(true);
    try { await updateDocument(workspaceId, doc.path, draft, summary.trim() || "Updated", author === "AI" ? "AI" : "Human"); const d = await getDocument(workspaceId, doc.path); docCache.current.set(doc.path, d); setDoc(d); setSummary(""); setMode("view"); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } finally { setSaving(false); }
  }

  async function loadShareData() {
    try { const [l, m, i] = await Promise.all([fetchShareLinks(workspaceId), fetchMembers(workspaceId), fetchInvites(workspaceId)]); setShareLinks(l); setMembers(m); setInvites(i); } catch {}
  }
  async function createLink() { try { const d = await createShareLink(workspaceId, doc?.path); setShareLinks((l) => [...l, { token: d.token, documentPath: doc?.path || null }]); } catch {} }
  async function revokeLink(t: string) { await revokeShareLink(workspaceId, t); setShareLinks((l) => l.filter((s) => s.token !== t)); }
  async function invitePerson() { if (!inviteEmail.trim()) return; try { const d = await createInvite(workspaceId, inviteEmail.trim(), "viewer"); setInvites((i) => [...i, { id: d.token, email: inviteEmail.trim(), role: "viewer", token: d.token }]); setInviteEmail(""); } catch {} }
  async function cancelInv(id: string) { await cancelInvite(workspaceId, id); setInvites((i) => i.filter((inv) => inv.id !== id)); }
  async function removePerson(uid: string) { await removeMember(workspaceId, uid); loadShareData(); }

  async function deleteDoc() {
    if (!doc || !confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;
    try { await deleteDocument(workspaceId, doc.path, "Deleted"); docCache.current.delete(doc.path); setDoc(null); router.replace(`/?w=${workspace.slug}&_t=${Date.now()}`); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }

  if (!doc) return <div className="flex h-screen items-center justify-center bg-[#f5f5f7]"><div className="h-1.5 w-32 rounded-full bg-[#e5e5ea] animate-pulse" /></div>;

  return (
    <div className="flex h-screen flex-col bg-[#f5f5f7]">
      <header className="flex h-12 items-center border-b border-[#e5e5ea] bg-white/80 backdrop-blur-xl px-4 flex-shrink-0 gap-2">
        <button onClick={() => router.replace(`/?w=${workspace.slug}`)} className="flex items-center gap-1 text-[13px] text-[#0071e3] font-medium transition hover:opacity-70">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {workspace.name}
        </button>
        <span className="text-[#c5c5ca]">/</span>
        <span className="text-[15px] font-semibold text-[#1d1d1f] truncate">{doc.title}</span>
        <span className="text-[12px] text-[#86868b] ml-1">v{doc.versions.length}</span>
        <div className="flex-1" />
        <SignOutButton><button className="rounded-full border border-[#e5e5ea] bg-white px-3 py-1 text-[12px] text-[#86868b] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f]">Sign Out</button></SignOutButton>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <main className="flex flex-1 flex-col overflow-hidden">
          {mode === "view" && (
            <div className="flex flex-1 flex-col items-center overflow-y-auto">
              <article className="branch-markdown w-full max-w-[680px] px-10 py-12">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.content}</ReactMarkdown>
              </article>
            </div>
          )}

          {mode === "edit" && (
            <div className="flex flex-1 flex-col">
              {error && <div className="mx-4 mt-2 rounded-lg bg-red-50 border border-red-200 px-3 py-1.5 text-xs text-red-600">{error}</div>}
              <textarea className="flex-1 resize-none bg-white px-10 py-8 font-mono text-[14px] leading-7 text-[#1d1d1f] outline-none" value={draft} onChange={(e) => setDraft(e.target.value)} spellCheck={false} />
              <div className="flex items-center gap-3 border-t border-[#e5e5ea] bg-[#f5f5f7] px-4 py-2.5">
                <input className="flex-1 rounded-lg border border-[#e5e5ea] bg-white px-3 py-1.5 text-[13px] outline-none focus:border-[#0071e3]" placeholder="What changed?" value={summary} onChange={(e) => setSummary(e.target.value)} />
                <select className="rounded-lg border border-[#e5e5ea] bg-white px-2.5 py-1.5 text-[13px] outline-none" value={author} onChange={(e) => setAuthor(e.target.value as AuthorType)}><option>Human</option><option>AI</option></select>
                <button onClick={save} disabled={!changed || saving} className="rounded-full bg-[#0071e3] px-4 py-1.5 text-[13px] font-medium text-white transition disabled:opacity-30 hover:bg-[#0077ed] active:scale-[0.98]">{saving ? "Saving..." : "Save"}</button>
                <button onClick={() => { setDraft(doc.content); setMode("view"); }} className="rounded-full border border-[#e5e5ea] px-4 py-1.5 text-[13px] text-[#1d1d1f] transition hover:bg-white active:scale-[0.98]">Cancel</button>
              </div>
            </div>
          )}

          {mode === "diff" && (
            <div className="flex flex-1 flex-col bg-[#1d1d1f]">
              <div className="flex items-center justify-between px-4 py-2 text-[#86868b]">
                <p className="text-[12px]">Changes from v{selectedVersion?.versionNumber}</p>
                {selectedVersion && <button onClick={() => { setDraft(selectedVersion.content); setSummary(`Restored v${selectedVersion.versionNumber}`); setMode("edit"); }} className="rounded-md px-3 py-1 text-[12px] font-medium text-[#f5f5f7] transition hover:bg-white/10">Restore</button>}
              </div>
              <pre className="flex-1 overflow-auto p-4 font-mono text-[13px] leading-6">
                {selectedVersion ? computeDiff(doc.content, selectedVersion.content).split("\n").map((line, i) => (
                  <span key={i} className={line.startsWith("+") ? "block bg-[#30d158]/10 text-[#30d158]" : line.startsWith("-") ? "block bg-[#ff453a]/10 text-[#ff453a]" : "block text-[#86868b]"}>{line}</span>
                )) : <span className="text-[#86868b]">Select a version</span>}
              </pre>
            </div>
          )}
        </main>

        <aside className="w-[240px] flex-shrink-0 border-l border-[#e5e5ea] bg-white flex flex-col">
          <div className="border-b border-[#e5e5ea] px-3 py-2.5">
            <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-2">Mode</p>
            <div className="flex rounded-lg bg-[#f5f5f7] p-0.5">
              {(["view", "edit", "diff"] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)}
                  className={`flex-1 rounded-md py-1 text-[12px] font-medium capitalize transition ${mode === m ? "bg-white text-[#1d1d1f] shadow-sm" : "text-[#86868b] hover:text-[#1d1d1f]"}`}>{m}</button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="px-3 py-2.5"><p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider">Versions</p></div>
            <div className="px-1.5 space-y-0.5">
              {[...doc.versions].reverse().map((v) => (
                <button key={v.id} onClick={() => { setSelectedVersionId(v.id); setMode("diff"); }}
                  className={`w-full rounded-md px-2.5 py-2 text-left transition ${selectedVersion?.id === v.id ? "bg-[#0071e3]/10" : "hover:bg-[#f5f5f7]"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-medium">v{v.versionNumber}</span>
                    <span className="text-[11px] text-[#86868b]">{new Date(v.createdAt).toLocaleDateString("en", { month: "short", day: "numeric" })}</span>
                  </div>
                  <p className="mt-0.5 text-[12px] text-[#86868b] line-clamp-2">{v.summary}</p>
                  <p className="mt-0.5 text-[10px] text-[#c5c5ca]">{v.authorName}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-[#e5e5ea] p-3 space-y-2">
            <button onClick={() => { setMode("edit"); setDraft(doc.content); }} className="w-full rounded-full bg-[#0071e3] py-1.5 text-[13px] font-medium text-white transition hover:bg-[#0077ed] active:scale-[0.98]">Edit</button>
            <button onClick={() => { loadShareData(); setShowShare(true); }} className="w-full rounded-full border border-[#e5e5ea] bg-white py-1.5 text-[13px] text-[#1d1d1f] transition hover:bg-[#f5f5f7]">Share</button>
            <button onClick={deleteDoc} className="w-full rounded-full border border-[#e5e5ea] bg-white py-1.5 text-[13px] text-[#ff3b30] transition hover:bg-red-50">Delete</button>
          </div>
        </aside>
      </div>

      {showShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={() => setShowShare(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-[#e5e5ea] bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#e5e5ea]">
              <h3 className="text-[15px] font-semibold">Share &ldquo;{doc.title}&rdquo;</h3>
              <button onClick={() => setShowShare(false)} className="rounded-full p-1 text-[#86868b] transition hover:bg-[#f5f5f7]"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-2">Share Link</p>
                {shareLinks.length === 0 ? (
                  <button onClick={createLink} className="w-full rounded-lg border border-dashed border-[#e5e5ea] px-3 py-2.5 text-[13px] text-[#86868b] transition hover:border-[#0071e3] hover:text-[#0071e3]">Create a read-only link</button>
                ) : (
                  <div className="space-y-2">
                    {shareLinks.map((l) => (
                      <div key={l.token} className="flex items-center gap-2 rounded-lg border border-[#e5e5ea] bg-[#f5f5f7] px-3 py-2">
                        <span className="flex-1 truncate text-[12px] font-mono">/share/{l.token}</span>
                        <button onClick={() => { navigator.clipboard.writeText(`${location.origin}/share/${l.token}`); }} className="rounded-md px-2 py-1 text-[12px] font-medium text-[#0071e3] transition hover:bg-[#0071e3]/10">Copy</button>
                        <button onClick={() => revokeLink(l.token)} className="rounded-md px-2 py-1 text-[12px] font-medium text-[#ff3b30] transition hover:bg-[#ff3b30]/10">Revoke</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="border-t border-[#e5e5ea] pt-4">
                <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-2">Invite</p>
                <div className="flex gap-2 mb-2">
                  <input className="flex-1 rounded-lg border border-[#e5e5ea] bg-[#f5f5f7] px-3 py-1.5 text-[13px] outline-none focus:border-[#0071e3] focus:bg-white" placeholder="Email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && invitePerson()} />
                  <button onClick={invitePerson} className="rounded-full bg-[#0071e3] px-4 py-1.5 text-[13px] font-medium text-white transition hover:bg-[#0077ed] active:scale-[0.98]">Invite</button>
                </div>
                {members.map((m) => (
                  <div key={m.userId} className="flex items-center justify-between px-3 py-1.5"><span className="text-[13px]">{m.name || m.email} <span className="text-[11px] text-[#86868b]">{m.role}</span></span>{m.role !== "owner" && <button onClick={() => removePerson(m.userId)} className="text-[12px] text-[#ff3b30] hover:underline">Remove</button>}</div>
                ))}
                {invites.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between bg-amber-50/60 rounded-lg px-3 py-1.5"><span className="text-[13px]">{inv.email}</span><button onClick={() => cancelInv(inv.id)} className="text-[12px] text-[#ff3b30] hover:underline">Cancel</button></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
