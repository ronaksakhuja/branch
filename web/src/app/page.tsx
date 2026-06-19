"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useUser, SignInButton, SignOutButton } from "@clerk/nextjs";
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

const docLabel = (s: string) => s.split("/").at(-1)?.replace(/\.md$/, "") || s;
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

export default function Home() {
  const { user, isLoaded } = useUser();
  if (!isLoaded) return <Shell><p className="text-sm text-zinc-400 m-16">Loading...</p></Shell>;
  if (!user) return (
    <Shell>
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <h1 className="text-[2rem] font-bold tracking-tight text-zinc-800">Branch</h1>
          <p className="mt-1 text-sm text-zinc-500">Markdown workspace with version history</p>
          <SignInButton mode="modal">
            <button className="mt-6 rounded-xl bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700">Sign in</button>
          </SignInButton>
        </div>
      </div>
    </Shell>
  );
  return <WorkspaceView userId={user.id} userName={user.fullName || user.id} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="flex h-screen flex-col bg-[#f9f8f6]">{children}</div>;
}

function TopBar({ children, right }: { children?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-2">
      <div className="flex items-center gap-4">{children}</div>
      <div className="flex items-center gap-3">{right}</div>
    </div>
  );
}

function WorkspaceView({ userId }: { userId: string; userName: string }) {
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string; slug: string; ownerId?: string; role?: string }[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");

  useEffect(() => { fetchWorkspaces(true).then((d) => { setWorkspaces(d); if (d.length) setWorkspaceId(d[0].id); }).catch(console.error).finally(() => setLoading(false)); }, []);

  if (loading) return <Shell><p className="text-sm text-zinc-400 m-16">Loading...</p></Shell>;

  const yours = workspaces.filter((w) => !w.ownerId || w.ownerId === userId || w.role === "owner");
  const shared = workspaces.filter((w) => w.ownerId && w.ownerId !== userId && w.role !== "owner");

  if (workspaces.length === 0) {
    const create = async () => { const n = name.trim(); if (!n) return; const r = await createWorkspace(n, slugify(n)); setWorkspaces([{ id: r.id, name: n, slug: slugify(n), ownerId: userId }]); setWorkspaceId(r.id); };
    return (
      <Shell>
        <TopBar />
        <div className="flex flex-1 items-center justify-center">
          <div className="w-80 text-center">
            <h2 className="text-lg font-semibold text-zinc-800">Create a workspace</h2>
            <p className="mt-1 text-sm text-zinc-500">Workspaces hold your documents</p>
            <input className="mt-4 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} />
            <button className="mt-2 w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-700" onClick={create}>Create workspace</button>
          </div>
        </div>
      </Shell>
    );
  }

  return <DocumentView workspaceId={workspaceId!} userId={userId} workspaces={workspaces} yours={yours} shared={shared} setWorkspaceId={setWorkspaceId} />;
}

function DocumentView({ workspaceId, userId, workspaces, yours, shared, setWorkspaceId }: { workspaceId: string; userId: string; workspaces: { id: string; name: string; slug: string; ownerId?: string; role?: string }[]; yours: typeof workspaces; shared: typeof workspaces; setWorkspaceId: (id: string) => void }) {
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [doc, setDoc] = useState<DocumentRecord | null>(null);
  const [draft, setDraft] = useState("");
  const [summary, setSummary] = useState("");
  const [author, setAuthor] = useState<AuthorType>("Human");
  const [mode, setMode] = useState<"view" | "edit" | "diff">("view");
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [shareLinks, setShareLinks] = useState<{ token: string; documentPath: string | null; createdAt: string }[]>([]);
  const [members, setMembers] = useState<{ userId: string; role: string; name: string | null; email: string | null }[]>([]);
  const [invites, setInvites] = useState<{ id: string; email: string; role: string; token: string }[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const loaded = useRef(false);
  const docCache = useRef<Map<string, DocumentRecord>>(new Map());

  async function load(path: string) {
    const cached = docCache.current.get(path);
    if (cached) {
      setDoc(cached); setDraft(cached.content); setSummary(""); setError(null);
      setMode("view"); setSelectedVersionId(cached.versions.at(-1)?.id || null); setShowDocs(false);
      return;
    }
    const d = await getDocument(workspaceId, path);
    docCache.current.set(path, d);
    setDoc(d); setDraft(d.content); setSummary(""); setError(null); setMode("view"); setSelectedVersionId(d.versions.at(-1)?.id || null); setShowDocs(false);
  }

  useEffect(() => {
    fetchDocuments(workspaceId).then((d) => { setDocs(d); if (d.length && !loaded.current) { loaded.current = true; load(d[0].path); } }).catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const selectedVersion = useMemo(() => doc ? doc.versions.find((v) => v.id === selectedVersionId) || doc.versions.at(-1) || null : null, [doc, selectedVersionId]);
  const changed = doc ? draft !== doc.content : false;

  async function save() { if (!doc || !changed || saving) return; setSaving(true); setError(null);
    try { await updateDocument(workspaceId, doc.path, draft, summary.trim() || "Updated", author === "AI" ? "AI" : "Human"); const d = await getDocument(workspaceId, doc.path); docCache.current.set(doc.path, d); setDoc(d); setSummary(""); setSelectedVersionId(d.versions.at(-1)?.id || null); setMode("view"); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } finally { setSaving(false); }
  }

  async function createDoc() { const name = newName.trim() || "untitled"; const path = `notes/${name}.md`;
    try { await createDocumentApi(workspaceId, path, `# ${name}\n\n`, "Created"); const metas = await fetchDocuments(workspaceId); setDocs(metas); setNewName(""); load(path); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }

  async function loadShareData() {
    try {
      const [linksRes, membersRes, invitesRes] = await Promise.all([
        fetchShareLinks(workspaceId),
        fetchMembers(workspaceId),
        fetchInvites(workspaceId),
      ]);
      setShareLinks(linksRes);
      setMembers(membersRes);
      setInvites(invitesRes);
    } catch {}
  }

  async function createLink() {
    try {
      const data = await createShareLink(workspaceId, doc?.path);
      setShareLinks((l) => [...l, { token: data.token, documentPath: doc?.path || null, createdAt: new Date().toISOString() }]);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }

  async function revokeLink(token: string) {
    await revokeShareLink(workspaceId, token);
    setShareLinks((l) => l.filter((s) => s.token !== token));
  }

  async function invitePerson() {
    if (!inviteEmail.trim()) return;
    try {
      const data = await createInvite(workspaceId, inviteEmail.trim(), "viewer");
      setInvites((i) => [...i, { id: data.token, email: inviteEmail.trim(), role: "viewer", token: data.token }]);
      setInviteEmail("");
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }

  async function cancelPersonInvite(inviteId: string) {
    await cancelInvite(workspaceId, inviteId);
    setInvites((i) => i.filter((inv) => inv.id !== inviteId));
  }

  async function removePerson(targetUserId: string) {
    await removeMember(workspaceId, targetUserId);
    loadShareData();
  }

  return (
    <Shell>
      <TopBar
        right={
          <div className="flex items-center gap-3">
            <select className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-600 outline-none max-w-[200px]" value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)}>
              {yours.length > 0 && <optgroup label="Your workspaces">{yours.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</optgroup>}
              {shared.length > 0 && <optgroup label="Shared with you">{shared.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</optgroup>}
            </select>
            <SignOutButton><button className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-500 transition hover:bg-zinc-100">Sign out</button></SignOutButton>
          </div>
        }
      >
        <button onClick={() => { setShowDocs(!showDocs); setShowVersions(false); }} className={`rounded-md px-2 py-1 text-xs font-medium transition ${showDocs ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"}`}>Documents</button>
        {doc && (
          <>
            <span className="text-zinc-300">/</span>
            <span className="text-sm font-medium text-zinc-800">{doc.title}</span>
            <span className="text-xs text-zinc-400">v{doc.versions.length}</span>
            <button onClick={() => { loadShareData(); setShowShare(true); }} className="rounded border border-zinc-300 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 transition hover:bg-zinc-100">Share</button>
          </>
        )}
      </TopBar>

      <div className="flex flex-1 overflow-hidden">
        {showDocs && (
          <div className="w-56 flex-shrink-0 overflow-y-auto border-r border-zinc-200 bg-white p-3 space-y-1">
            <div className="mb-3">
              <input className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-zinc-500" placeholder="New document name" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createDoc()} />
              <button onClick={createDoc} className="mt-1 w-full rounded-md bg-zinc-900 px-2 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-700">Create</button>
            </div>
            {docs.map((m) => (
              <button key={m.id} onClick={() => load(m.path)} className={`w-full truncate rounded-md px-3 py-1.5 text-left text-xs font-medium transition ${doc?.id === m.id ? "bg-zinc-100 text-zinc-900" : "text-zinc-600 hover:bg-zinc-50"}`}>
                {docLabel(m.path)}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-1 flex-col overflow-hidden">
          {!doc ? (
            <div className="flex flex-1 items-center justify-center text-sm text-zinc-400">Select a document or create one</div>
          ) : (
            <>
              {mode === "view" && (
                <div className="flex flex-1 flex-col items-center overflow-y-auto">
                  <article className="branch-markdown w-full max-w-[720px] px-8 py-10 md:px-12 md:py-14">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.content}</ReactMarkdown>
                  </article>
                </div>
              )}

              {mode === "edit" && (
                <div className="flex flex-1 flex-col">
                  {error && <div className="mx-4 mt-2 rounded-md bg-red-50 border border-red-200 px-3 py-1.5 text-xs text-red-700">{error}</div>}
                  <textarea className="flex-1 resize-none bg-white p-8 font-mono text-sm leading-7 text-zinc-800 outline-none md:px-12" value={draft} onChange={(e) => setDraft(e.target.value)} spellCheck={false} placeholder="Write markdown..." />
                  <div className="flex items-center gap-3 border-t border-zinc-200 bg-zinc-50 px-4 py-2">
                    <input className="flex-1 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-zinc-500" placeholder="Describe what changed" value={summary} onChange={(e) => setSummary(e.target.value)} />
                    <select className="rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm outline-none" value={author} onChange={(e) => setAuthor(e.target.value as AuthorType)}><option>Human</option><option>AI</option></select>
                    <button onClick={save} disabled={!changed || saving} className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white transition disabled:opacity-30 hover:bg-zinc-700">{saving ? "Saving..." : "Save"}</button>
                    <button onClick={() => { setDraft(doc.content); setError(null); setMode("view"); }} className="rounded-md border border-zinc-300 px-4 py-1.5 text-sm text-zinc-600 transition hover:bg-zinc-100">Cancel</button>
                  </div>
                </div>
              )}

              {mode === "diff" && (
                <div className="flex flex-1 flex-col bg-zinc-950">
                  <div className="flex items-center justify-between px-4 py-2 text-zinc-300">
                    <p className="text-xs">Changes from v{selectedVersion?.versionNumber}</p>
                    {selectedVersion && <button onClick={() => { setDraft(selectedVersion.content); setSummary(`Restored v${selectedVersion.versionNumber}`); setMode("edit"); }}
                      className="rounded-md border border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800">Restore this version</button>}
                  </div>
                  <pre className="flex-1 overflow-auto p-4 text-sm leading-6">
                    {selectedVersion ? computeDiff(doc.content, selectedVersion.content).split("\n").map((line, i) => (
                      <span key={i} className={line.startsWith("+") ? "block bg-emerald-950/60 text-emerald-300" : line.startsWith("-") ? "block bg-red-950/60 text-red-300" : "block text-zinc-500"}>{line}</span>
                    )) : <span className="text-zinc-500">Select a version</span>}
                  </pre>
                </div>
              )}
            </>
          )}
        </div>

        {doc && (
          <div className={`w-64 flex-shrink-0 border-l border-zinc-200 bg-white overflow-y-auto transition-transform ${showVersions ? "translate-x-0" : "translate-x-full"} lg:translate-x-0 lg:relative absolute right-0 top-0 bottom-0`}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100">
              <span className="text-xs font-semibold text-zinc-500">Versions</span>
              <button className="text-xs text-zinc-400 hover:text-zinc-600" onClick={() => { setMode("edit"); setShowVersions(false); }}>Edit</button>
            </div>
            <div className="p-2 space-y-1">
              {[...doc.versions].reverse().map((v) => (
                <button key={v.id} onClick={() => { setSelectedVersionId(v.id); setMode("diff"); }}
                  className={`w-full rounded-md px-3 py-2 text-left transition ${selectedVersion?.id === v.id ? "bg-zinc-100" : "hover:bg-zinc-50"}`}>
                  <div className="flex items-center justify-between">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${selectedVersion?.id === v.id ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-600"}`}>v{v.versionNumber}</span>
                    <span className="text-[10px] text-zinc-400">{new Date(v.createdAt).toLocaleDateString("en", { month:"short", day:"numeric" })}</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-700 leading-tight line-clamp-2">{v.summary}</p>
                  <p className="mt-0.5 text-[10px] text-zinc-400">{v.authorName}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {doc && (
        <div className="flex items-center justify-between border-t border-zinc-200 bg-white px-4 py-1.5">
          <div className="flex items-center gap-2">
            {(["view", "edit", "diff"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition ${mode === m ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100"}`}>{m}</button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowVersions(!showVersions)} className={`rounded-md px-3 py-1 text-xs font-medium transition ${showVersions ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100"}`}>Versions</button>
            <button onClick={() => { setMode("edit"); setDraft(doc.content); }} className="rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white transition hover:bg-zinc-700">Edit</button>
          </div>
        </div>
      )}

      {showShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={() => setShowShare(false)}>
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-zinc-800">Share {doc?.title || "workspace"}</h3>
              <button onClick={() => setShowShare(false)} className="text-zinc-400 hover:text-zinc-600">✕</button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <p className="text-xs font-medium text-zinc-500 mb-2">Share link</p>
                {shareLinks.length === 0 ? (
                  <button onClick={createLink} className="w-full rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-xs text-zinc-500 transition hover:border-zinc-400 hover:text-zinc-700">
                    + Create a read-only link
                  </button>
                ) : (
                  <div className="space-y-2">
                    {shareLinks.map((link) => (
                      <div key={link.token} className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs text-zinc-700">{link.documentPath || "Entire workspace"}</p>
                          <p className="font-mono text-[10px] text-zinc-400 truncate">{`${window.location.origin}/share/${link.token}`}</p>
                        </div>
                        <div className="ml-2 flex items-center gap-1">
                          <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/share/${link.token}`); }} className="rounded px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-700">Copy</button>
                          <button onClick={() => revokeLink(link.token)} className="rounded px-1.5 py-0.5 text-[10px] font-medium text-red-500 transition hover:bg-red-50 hover:text-red-700">Revoke</button>
                        </div>
                      </div>
                    ))}
                    <button onClick={createLink} className="w-full rounded-lg border border-dashed border-zinc-300 px-3 py-1.5 text-[10px] text-zinc-500 transition hover:border-zinc-400">+ New link</button>
                  </div>
                )}
              </div>

              <div className="border-t border-zinc-100 pt-4">
                <p className="text-xs font-medium text-zinc-500 mb-2">Invite people</p>
                <div className="flex gap-2 mb-3">
                  <input className="flex-1 rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-zinc-500" placeholder="Email address" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && invitePerson()} />
                  <button onClick={invitePerson} className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-700">Invite</button>
                </div>

                {members.length > 0 && (
                  <div className="space-y-1 mb-2">
                    {members.map((m) => (
                      <div key={m.userId} className="flex items-center justify-between rounded-lg border border-zinc-100 px-3 py-1.5">
                        <div>
                          <p className="text-xs font-medium text-zinc-700">{m.name || m.email || m.userId}</p>
                          <p className="text-[10px] text-zinc-400 uppercase">{m.role}</p>
                        </div>
                        {m.role !== "owner" && <button onClick={() => removePerson(m.userId)} className="text-[10px] font-medium text-red-500 hover:text-red-700">Remove</button>}
                      </div>
                    ))}
                  </div>
                )}

                {invites.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-zinc-400 mb-1">Pending invites</p>
                    {invites.map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between rounded-lg border border-zinc-100 bg-amber-50/50 px-3 py-1.5">
                        <div>
                          <p className="text-xs text-zinc-600">{inv.email}</p>
                          <p className="text-[10px] text-zinc-400">Awaiting acceptance</p>
                        </div>
                        <button onClick={() => cancelPersonInvite(inv.id)} className="text-[10px] font-medium text-red-500 hover:text-red-700">Cancel</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
