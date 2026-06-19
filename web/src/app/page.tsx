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
  fetchMembers, createInvite, fetchInvites, cancelInvite, removeMember,
} from "@/lib/api";

type AuthorType = "Human" | "AI";
type DocMeta = { id: string; path: string; title: string };
type VersionRecord = { id: string; versionNumber: number; content: string; summary: string; authorType: string; authorName: string; createdAt: string };
type DocumentRecord = { id: string; path: string; title: string; content: string; updatedAt: string; versions: VersionRecord[] };

function slugify(t: string) { return t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function computeDiff(current: string, previous: string) {
  if (current === previous) return "";
  const cl = current.split("\n"), pl = previous.split("\n"), out: string[] = [];
  let pi = 0, ci = 0;
  while (pi < pl.length && ci < cl.length) {
    if (pl[pi] === cl[ci]) { if (pl[pi]) out.push(` ${pl[pi]}`); pi++; ci++; continue; }
    const np = pl.slice(pi + 1).indexOf(cl[ci]), nc = cl.slice(ci + 1).indexOf(pl[pi]);
    if (np !== -1 && (nc === -1 || np <= nc)) { for (let i = 0; i <= np; i++) if (pl[pi + i]) out.push(`-${pl[pi + i]}`); pi += np + 1; if (pl[pi]) out.push(` ${pl[pi]}`); pi++; ci++; }
    else if (nc !== -1) { for (let i = 0; i <= nc; i++) if (cl[ci + i]) out.push(`+${cl[ci + i]}`); ci += nc + 1; if (cl[ci]) out.push(` ${cl[ci]}`); ci++; pi++; }
    else { if (pl[pi]) out.push(`-${pl[pi]}`); if (cl[ci]) out.push(`+${cl[ci]}`); pi++; ci++; }
  }
  while (pi < pl.length) { if (pl[pi]) out.push(`-${pl[pi]}`); pi++; }
  while (ci < cl.length) { if (cl[ci]) out.push(`+${cl[ci]}`); ci++; }
  return out.join("\n");
}

const ChevronLeft = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const ChevronRight = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const DocIcon = () => <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="2.5" y="1.5" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><line x1="5" y1="5" x2="10" y2="5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><line x1="5" y1="8" x2="10" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><line x1="5" y1="11" x2="8" y2="11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>;
const PlusIcon = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><line x1="7" y1="2" x2="7" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="2" y1="7" x2="12" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;

export default function Home() {
  const { user, isLoaded } = useUser();
  if (!isLoaded) return <div className="flex h-screen items-center justify-center bg-[#f5f5f7]"><p className="text-sm text-[#86868b]">Loading...</p></div>;
  if (!user) return (
    <div className="flex h-screen flex-col items-center justify-center bg-[#f5f5f7] gap-6">
      <h1 className="text-[32px] font-semibold tracking-tight text-[#1d1d1f]">Branch</h1>
      <p className="text-[15px] text-[#86868b] -mt-3">Git for documents. Built for humans and AI.</p>
      <SignInButton mode="modal">
        <button className="rounded-full bg-[#0071e3] px-6 py-2 text-[14px] font-medium text-white transition hover:bg-[#0077ed] active:scale-[0.98]">Sign In</button>
      </SignInButton>
    </div>
  );
  return <WorkspaceView userId={user.id} />;
}

function WorkspaceView({ userId }: { userId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlW = searchParams.get("w");

  const [workspaces, setWorkspaces] = useState<{ id: string; name: string; slug: string; ownerId?: string; role?: string }[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(urlW || null);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    fetchWorkspaces(true).then((d) => {
      setWorkspaces(d);
      if (d.length) {
        const target = urlW ? d.find((w: typeof d[number]) => w.slug === urlW || w.id === urlW) : d[0];
        if (target) { setWorkspaceId(target.id); router.replace(`/?w=${target.slug}`); }
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex h-screen items-center justify-center bg-[#f5f5f7]"><p className="text-sm text-[#86868b]">Loading...</p></div>;

  const yours = workspaces.filter((w) => !w.ownerId || w.ownerId === userId || w.role === "owner");
  const shared = workspaces.filter((w) => w.ownerId && w.ownerId !== userId && w.role !== "owner");

  if (workspaces.length === 0) {
    const create = async () => { const n = newName.trim(); if (!n) return; const r = await createWorkspace(n, slugify(n)); setWorkspaces([{ id: r.id, name: n, slug: slugify(n), ownerId: userId }]); setWorkspaceId(r.id); router.replace(`/?w=${slugify(n)}`); };
    return (
      <div className="flex h-screen items-center justify-center bg-[#f5f5f7]">
        <div className="w-72">
          <h2 className="text-xl font-semibold text-[#1d1d1f] text-center">New Workspace</h2>
          <p className="mt-1 text-sm text-[#86868b] text-center">Workspaces hold your documents.</p>
          <input className="mt-4 w-full rounded-lg border border-[#e5e5ea] bg-white px-3 py-2 text-sm outline-none focus:border-[#0071e3] focus:ring-1 focus:ring-[#0071e3]/20" placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} />
          <button className="mt-2 w-full rounded-full bg-[#0071e3] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#0077ed] active:scale-[0.98]" onClick={create}>Create Workspace</button>
        </div>
      </div>
    );
  }

  return <DocumentView workspaceId={workspaceId!} userId={userId} workspaces={workspaces} yours={yours} shared={shared} setWorkspaceId={setWorkspaceId} />;
}

function DocumentView({ workspaceId, userId, workspaces, yours, shared, setWorkspaceId }: { workspaceId: string; userId: string; workspaces: { id: string; name: string; slug: string; ownerId?: string; role?: string }[]; yours: typeof workspaces; shared: typeof workspaces; setWorkspaceId: (id: string) => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [doc, setDoc] = useState<DocumentRecord | null>(null);
  const [draft, setDraft] = useState("");
  const [summary, setSummary] = useState("");
  const [author, setAuthor] = useState<AuthorType>("Human");
  const [mode, setMode] = useState<"view" | "edit" | "diff">("view");
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [newDocName, setNewDocName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showShare, setShowShare] = useState(false);
  const [shareLinks, setShareLinks] = useState<{ token: string; documentPath: string | null }[]>([]);
  const [members, setMembers] = useState<{ userId: string; role: string; name: string | null; email: string | null }[]>([]);
  const [invites, setInvites] = useState<{ id: string; email: string; role: string; token: string }[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const loaded = useRef(false);
  const docCache = useRef<Map<string, DocumentRecord>>(new Map());

  const currentWs = workspaces.find((w) => w.id === workspaceId);

  const updateUrl = useCallback((ws: string, docPath?: string) => {
    const p = new URLSearchParams(); p.set("w", ws);
    if (docPath) p.set("d", docPath);
    router.replace(`/?${p.toString()}`);
  }, [router]);

  const loadDoc = useCallback(async (path: string) => {
    const cached = docCache.current.get(path);
    if (cached) {
      setDoc(cached); setDraft(cached.content); setError(null);
      setMode("view"); setSelectedVersionId(cached.versions.at(-1)?.id || null);
      if (currentWs) updateUrl(currentWs.slug, path);
      return;
    }
    const d = await getDocument(workspaceId, path);
    docCache.current.set(path, d);
    setDoc(d); setDraft(d.content); setError(null);
    setMode("view"); setSelectedVersionId(d.versions.at(-1)?.id || null);
    if (currentWs) updateUrl(currentWs.slug, path);
  }, [workspaceId, currentWs, updateUrl]);

  useEffect(() => {
    fetchDocuments(workspaceId).then((d) => {
      setDocs(d);
      const urlDoc = searchParams.get("d");
      if (d.length && !loaded.current) {
        loaded.current = true;
        const target = urlDoc ? d.find((m: typeof d[number]) => m.path === urlDoc) : d[0];
        if (target) loadDoc(target.path);
      }
    }).catch(() => {});
  }, [workspaceId]);

  const selectedVersion = useMemo(() => doc ? doc.versions.find((v) => v.id === selectedVersionId) || doc.versions.at(-1) || null : null, [doc, selectedVersionId]);
  const changed = doc ? draft !== doc.content : false;

  async function save() { if (!doc || !changed || saving) return; setSaving(true); setError(null);
    try { await updateDocument(workspaceId, doc.path, draft, summary.trim() || "Updated", author === "AI" ? "AI" : "Human"); const d = await getDocument(workspaceId, doc.path); docCache.current.set(doc.path, d); setDoc(d); setSummary(""); setSelectedVersionId(d.versions.at(-1)?.id || null); setMode("view"); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } finally { setSaving(false); }
  }

  async function createDoc() { const name = newDocName.trim() || "untitled"; const path = `notes/${name}.md`;
    try { await createDocumentApi(workspaceId, path, `# ${name}\n\n`, "Created"); const metas = await fetchDocuments(workspaceId); setDocs(metas); setNewDocName(""); loadDoc(path); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }

  async function loadShareData() {
    try {
      const [linksRes, membersRes, invitesRes] = await Promise.all([fetchShareLinks(workspaceId), fetchMembers(workspaceId), fetchInvites(workspaceId)]);
      setShareLinks(linksRes); setMembers(membersRes); setInvites(invitesRes);
    } catch {}
  }

  async function createLink() { try { const data = await createShareLink(workspaceId, doc?.path); setShareLinks((l) => [...l, { token: data.token, documentPath: doc?.path || null }]); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } }
  async function revokeLink(t: string) { await revokeShareLink(workspaceId, t); setShareLinks((l) => l.filter((s) => s.token !== t)); }

  async function invitePerson() { if (!inviteEmail.trim()) return;
    try { const data = await createInvite(workspaceId, inviteEmail.trim(), "viewer"); setInvites((i) => [...i, { id: data.token, email: inviteEmail.trim(), role: "viewer", token: data.token }]); setInviteEmail(""); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }
  async function cancelPersonInvite(id: string) { await cancelInvite(workspaceId, id); setInvites((i) => i.filter((inv) => inv.id !== id)); }
  async function removePerson(uid: string) { await removeMember(workspaceId, uid); loadShareData(); }

  return (
    <div className="flex h-screen flex-col bg-[#f5f5f7]">
      <header className="flex h-11 items-center justify-between border-b border-[#e5e5ea] bg-white/80 backdrop-blur-xl px-3 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="rounded-md p-1 text-[#86868b] transition hover:bg-black/5 hover:text-[#1d1d1f]">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="1.2" rx="0.6" fill="currentColor"/><rect x="2" y="7.4" width="12" height="1.2" rx="0.6" fill="currentColor"/><rect x="2" y="11.8" width="8" height="1.2" rx="0.6" fill="currentColor"/></svg>
          </button>

          {currentWs && (
            <div className="flex items-center gap-1 min-w-0">
              <button onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)} className="text-[13px] font-medium text-[#1d1d1f] truncate transition hover:opacity-70">{currentWs.name}</button>
              {doc && <><span className="text-[#86868b] select-none mx-0.5">/</span><span className="text-[13px] text-[#1d1d1f] truncate">{doc.title}</span></>}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {doc && (
            <button onClick={() => { loadShareData(); setShowShare(true); }} className="rounded-md px-2 py-1 text-[12px] font-medium text-[#86868b] transition hover:bg-black/5 hover:text-[#1d1d1f]">Share</button>
          )}
          <SignOutButton><button className="rounded-full bg-[#f5f5f7] px-3 py-1 text-[12px] font-medium text-[#86868b] transition hover:bg-[#e5e5ea] hover:text-[#1d1d1f]">Sign Out</button></SignOutButton>
          {showWorkspaceMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowWorkspaceMenu(false)} />
              <div className="absolute top-11 left-12 z-50 w-56 rounded-xl border border-[#e5e5ea] bg-white shadow-lg py-1">
                <p className="px-3 py-1.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wider">Your Workspaces</p>
                {yours.map((w) => (
                  <button key={w.id} onClick={() => { setWorkspaceId(w.id); updateUrl(w.slug); setShowWorkspaceMenu(false); }} className={`w-full px-3 py-1.5 text-left text-[13px] transition hover:bg-[#f5f5f7] ${w.id === workspaceId ? "text-[#0071e3] font-medium" : "text-[#1d1d1f]"}`}>{w.name}</button>
                ))}
                {shared.length > 0 && <><div className="border-t border-[#e5e5ea] my-1" /><p className="px-3 py-1.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wider">Shared with you</p></>}
                {shared.map((w) => (
                  <button key={w.id} onClick={() => { setWorkspaceId(w.id); updateUrl(w.slug); setShowWorkspaceMenu(false); }} className={`w-full px-3 py-1.5 text-left text-[13px] transition hover:bg-[#f5f5f7] ${w.id === workspaceId ? "text-[#0071e3] font-medium" : "text-[#1d1d1f]"}`}>{w.name}</button>
                ))}
              </div>
            </>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className={`flex-shrink-0 border-r border-[#e5e5ea] bg-white transition-all duration-200 ${sidebarOpen ? "w-[220px]" : "w-0 overflow-hidden border-r-0"}`}>
          <div className="flex h-full flex-col">
            <div className="border-b border-[#e5e5ea] p-2">
              <div className="flex gap-1.5">
                <input className="flex-1 rounded-md border border-[#e5e5ea] bg-[#f5f5f7] px-2.5 py-1.5 text-[12px] outline-none transition focus:border-[#0071e3] focus:bg-white" placeholder="New document..." value={newDocName} onChange={(e) => setNewDocName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createDoc()} />
                <button onClick={createDoc} className="flex-shrink-0 rounded-md p-1.5 text-[#86868b] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"><PlusIcon /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-1.5 py-1">
              {docs.map((m) => (
                <button key={m.id} onClick={() => loadDoc(m.path)}
                  className={`w-full truncate rounded-md px-2.5 py-1.5 text-left text-[13px] transition ${
                    doc?.id === m.id ? "bg-[#0071e3]/10 text-[#0071e3] font-medium" : "text-[#1d1d1f] hover:bg-[#f5f5f7]"
                  }`}>
                  <span className="flex items-center gap-2">
                    <span className="text-[#86868b] flex-shrink-0"><DocIcon /></span>
                    <span className="truncate">{m.path.split("/").pop()?.replace(/\.md$/, "") || m.path}</span>
                  </span>
                </button>
              ))}
              {docs.length === 0 && <p className="py-12 text-center text-[12px] text-[#86868b]">No documents yet.<br />Create one above.</p>}
            </div>
          </div>
        </aside>

        <main className="flex flex-1 flex-col overflow-hidden">
          {!doc ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <p className="text-[13px] text-[#86868b]">{sidebarOpen ? "Select a document" : "Open the sidebar to browse documents"}</p>
                {!sidebarOpen && (
                  <button onClick={() => setSidebarOpen(true)} className="mt-2 rounded-md px-3 py-1 text-[12px] font-medium text-[#0071e3] transition hover:bg-[#0071e3]/5">Show Sidebar</button>
                )}
              </div>
            </div>
          ) : (
            <>
              {mode === "view" && (
                <div className="flex flex-1 flex-col items-center overflow-y-auto">
                  <article className="branch-markdown w-full max-w-[680px] px-10 py-12">
                    <h1 style={{fontSize:28,fontWeight:600,letterSpacing:"-0.022em",marginBottom:24}}>{doc.title}</h1>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.content.replace(/^# .*\n/, "").trimStart()}</ReactMarkdown>
                  </article>
                </div>
              )}

              {mode === "edit" && (
                <div className="flex flex-1 flex-col">
                  {error && <div className="mx-4 mt-2 rounded-lg bg-red-50 border border-red-200 px-3 py-1.5 text-xs text-red-600">{error}</div>}
                  <textarea className="flex-1 resize-none bg-white px-10 py-8 font-mono text-[14px] leading-7 text-[#1d1d1f] outline-none" value={draft} onChange={(e) => setDraft(e.target.value)} spellCheck={false} placeholder="Write markdown..." />
                  <div className="flex items-center gap-3 border-t border-[#e5e5ea] bg-[#f5f5f7] px-4 py-2.5">
                    <input className="flex-1 rounded-lg border border-[#e5e5ea] bg-white px-3 py-1.5 text-[13px] outline-none focus:border-[#0071e3]" placeholder="Describe what changed..." value={summary} onChange={(e) => setSummary(e.target.value)} />
                    <select className="rounded-lg border border-[#e5e5ea] bg-white px-2.5 py-1.5 text-[13px] outline-none" value={author} onChange={(e) => setAuthor(e.target.value as AuthorType)}><option>Human</option><option>AI</option></select>
                    <button onClick={save} disabled={!changed || saving} className="rounded-full bg-[#0071e3] px-4 py-1.5 text-[13px] font-medium text-white transition disabled:opacity-30 hover:bg-[#0077ed] active:scale-[0.98]">{saving ? "Saving..." : "Save"}</button>
                    <button onClick={() => { setDraft(doc.content); setError(null); setMode("view"); }} className="rounded-full border border-[#e5e5ea] px-4 py-1.5 text-[13px] text-[#1d1d1f] transition hover:bg-white active:scale-[0.98]">Cancel</button>
                  </div>
                </div>
              )}

              {mode === "diff" && (
                <div className="flex flex-1 flex-col bg-[#1d1d1f]">
                  <div className="flex items-center justify-between px-4 py-2 text-[#86868b]">
                    <p className="text-[12px]">Changes from version {selectedVersion?.versionNumber}</p>
                    {selectedVersion && <button onClick={() => { setDraft(selectedVersion.content); setSummary(`Restored v${selectedVersion.versionNumber}`); setMode("edit"); }} className="rounded-md px-3 py-1 text-[12px] font-medium text-[#f5f5f7] transition hover:bg-white/10">Restore</button>}
                  </div>
                  <pre className="flex-1 overflow-auto p-4 font-mono text-[13px] leading-6">
                    {selectedVersion ? computeDiff(doc.content, selectedVersion.content).split("\n").map((line, i) => (
                      <span key={i} className={line.startsWith("+") ? "block bg-[#30d158]/10 text-[#30d158]" : line.startsWith("-") ? "block bg-[#ff453a]/10 text-[#ff453a]" : "block text-[#86868b]"}>{line}</span>
                    )) : <span className="text-[#86868b]">Select a version from the sidebar to compare.</span>}
                  </pre>
                </div>
              )}
            </>
          )}
        </main>

        {doc && showVersions && (
          <aside className="w-[220px] flex-shrink-0 border-l border-[#e5e5ea] bg-white overflow-y-auto">
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#e5e5ea]">
              <span className="text-[12px] font-semibold text-[#1d1d1f]">Version History</span>
              <button onClick={() => setShowVersions(false)} className="rounded p-0.5 text-[#86868b] transition hover:text-[#1d1d1f]">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="p-2 space-y-0.5">
              {[...doc.versions].reverse().map((v) => (
                <button key={v.id} onClick={() => { setSelectedVersionId(v.id); setMode("diff"); }}
                  className={`w-full rounded-md px-2.5 py-2 text-left transition ${selectedVersion?.id === v.id ? "bg-[#0071e3]/10" : "hover:bg-[#f5f5f7]"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-medium text-[#1d1d1f]">v{v.versionNumber}</span>
                    <span className="text-[11px] text-[#86868b]">{new Date(v.createdAt).toLocaleDateString("en", { month: "short", day: "numeric" })}</span>
                  </div>
                  <p className="mt-0.5 text-[12px] text-[#86868b] line-clamp-2">{v.summary}</p>
                </button>
              ))}
            </div>
          </aside>
        )}
      </div>

      {doc && (
        <footer className="flex items-center justify-between border-t border-[#e5e5ea] bg-white/80 backdrop-blur-xl px-3 py-1.5 flex-shrink-0">
          <div className="flex items-center gap-1">
            {(["view", "edit", "diff"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className={`rounded-md px-2.5 py-1 text-[12px] font-medium capitalize transition ${
                  mode === m ? "bg-[#0071e3]/10 text-[#0071e3]" : "text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#f5f5f7]"
                }`}>{m}</button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowVersions(!showVersions)}
              className={`rounded-md px-2.5 py-1 text-[12px] font-medium transition ${showVersions ? "bg-[#1d1d1f]/5 text-[#1d1d1f]" : "text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#f5f5f7]"}`}>Versions</button>
            <button onClick={() => { setMode("edit"); setDraft(doc.content); }} className="rounded-full bg-[#0071e3] px-3 py-1 text-[12px] font-medium text-white transition hover:bg-[#0077ed] active:scale-[0.98]">Edit</button>
          </div>
        </footer>
      )}

      {showShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={() => setShowShare(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-[#e5e5ea] bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#e5e5ea]">
              <h3 className="text-[15px] font-semibold text-[#1d1d1f]">Share &ldquo;{doc?.title}&rdquo;</h3>
              <button onClick={() => setShowShare(false)} className="rounded-full p-1 text-[#86868b] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f]">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-2">Share Link</p>
                {shareLinks.length === 0 ? (
                  <button onClick={createLink} className="w-full rounded-lg border border-dashed border-[#e5e5ea] px-3 py-2.5 text-[13px] text-[#86868b] transition hover:border-[#0071e3] hover:text-[#0071e3]">Create a read‑only link</button>
                ) : (
                  <div className="space-y-2">
                    {shareLinks.map((link) => (
                      <div key={link.token} className="flex items-center gap-2 rounded-lg border border-[#e5e5ea] bg-[#f5f5f7] px-3 py-2">
                        <span className="flex-1 truncate text-[12px] font-mono text-[#1d1d1f]">/share/{link.token}</span>
                        <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/share/${link.token}`); }} className="rounded-md px-2 py-1 text-[12px] font-medium text-[#0071e3] transition hover:bg-[#0071e3]/10">Copy</button>
                        <button onClick={() => revokeLink(link.token)} className="rounded-md px-2 py-1 text-[12px] font-medium text-[#ff3b30] transition hover:bg-[#ff3b30]/10">Revoke</button>
                      </div>
                    ))}
                    <button onClick={createLink} className="w-full rounded-lg border border-dashed border-[#e5e5ea] px-3 py-1.5 text-[11px] text-[#86868b] transition hover:border-[#0071e3]">+ New link</button>
                  </div>
                )}
              </div>
              <div className="border-t border-[#e5e5ea] pt-4">
                <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-2">Invite Collaborators</p>
                <div className="flex gap-2 mb-2">
                  <input className="flex-1 rounded-lg border border-[#e5e5ea] bg-[#f5f5f7] px-3 py-1.5 text-[13px] outline-none transition focus:border-[#0071e3] focus:bg-white" placeholder="Email address" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && invitePerson()} />
                  <button onClick={invitePerson} className="rounded-full bg-[#0071e3] px-4 py-1.5 text-[13px] font-medium text-white transition hover:bg-[#0077ed] active:scale-[0.98]">Invite</button>
                </div>
                {members.length > 0 && members.map((m) => (
                  <div key={m.userId} className="flex items-center justify-between rounded-lg px-3 py-1.5">
                    <span className="text-[13px] text-[#1d1d1f]">{m.name || m.email || m.userId} <span className="text-[11px] text-[#86868b]">{m.role}</span></span>
                    {m.role !== "owner" && <button onClick={() => removePerson(m.userId)} className="text-[12px] text-[#ff3b30] transition hover:underline">Remove</button>}
                  </div>
                ))}
                {invites.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-[11px] text-[#86868b]">Pending</p>
                    {invites.map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between rounded-lg bg-amber-50/60 px-3 py-1.5">
                        <span className="text-[13px] text-[#1d1d1f]">{inv.email}</span>
                        <button onClick={() => cancelPersonInvite(inv.id)} className="text-[12px] text-[#ff3b30] transition hover:underline">Cancel</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
