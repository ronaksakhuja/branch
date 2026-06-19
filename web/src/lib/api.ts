async function handleResponse(res: Response) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(body.error || `Request failed`);
  }
  return res.json();
}

export async function fetchWorkspaces(includeShared = true) {
  const res = await fetch(`/api/workspaces?shared=${includeShared}`);
  return handleResponse(res);
}

export async function createWorkspace(name: string, slug: string) {
  const res = await fetch("/api/workspaces", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, slug }),
  });
  return handleResponse(res);
}

export async function fetchDocuments(workspaceId: string) {
  const res = await fetch(`/api/workspaces/${workspaceId}/documents`);
  return handleResponse(res);
}

export async function getDocument(workspaceId: string, path: string) {
  const res = await fetch(`/api/workspaces/${workspaceId}/documents/${encodeURIComponent(path)}`);
  return handleResponse(res);
}

export async function createDocumentApi(workspaceId: string, path: string, content: string, summary: string) {
  const res = await fetch(`/api/workspaces/${workspaceId}/documents`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, content, summary }),
  });
  return handleResponse(res);
}

export async function updateDocument(workspaceId: string, path: string, content: string, summary: string, authorType: "Human" | "AI" = "Human") {
  const res = await fetch(`/api/workspaces/${workspaceId}/documents/${encodeURIComponent(path)}`, {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, summary, authorType }),
  });
  return handleResponse(res);
}

export async function deleteDocument(workspaceId: string, path: string, summary: string) {
  const res = await fetch(`/api/workspaces/${workspaceId}/documents/${encodeURIComponent(path)}`, {
    method: "DELETE", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ summary }),
  });
  return handleResponse(res);
}

export async function pullWorkspace(workspaceId: string) {
  const res = await fetch(`/api/workspaces/${workspaceId}/pull`);
  return handleResponse(res);
}

export async function getVersions(workspaceId: string, path: string) {
  const res = await fetch(`/api/workspaces/${workspaceId}/documents/${encodeURIComponent(path)}/versions`);
  return handleResponse(res);
}

export async function getDiff(workspaceId: string, path: string, from: string, to: string) {
  const res = await fetch(`/api/workspaces/${workspaceId}/documents/${encodeURIComponent(path)}/diff?from=${from}&to=${to}`);
  return handleResponse(res);
}

export async function fetchShareLinks(workspaceId: string) {
  const res = await fetch(`/api/workspaces/${workspaceId}/share`);
  return handleResponse(res);
}

export async function createShareLink(workspaceId: string, documentPath?: string) {
  const res = await fetch(`/api/workspaces/${workspaceId}/share`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documentPath: documentPath || null }),
  });
  return handleResponse(res);
}

export async function revokeShareLink(workspaceId: string, token: string) {
  const res = await fetch(`/api/workspaces/${workspaceId}/share?token=${token}`, { method: "DELETE" });
  return handleResponse(res);
}

export async function fetchMembers(workspaceId: string) {
  const res = await fetch(`/api/workspaces/${workspaceId}/members`);
  return handleResponse(res);
}

export async function inviteMember(workspaceId: string, email: string, role: string) {
  const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, role }),
  });
  return handleResponse(res);
}

export async function removeMember(workspaceId: string, userId: string) {
  const res = await fetch(`/api/workspaces/${workspaceId}/members?userId=${userId}`, { method: "DELETE" });
  return handleResponse(res);
}

export async function createInvite(workspaceId: string, email: string, role: string) {
  const res = await fetch(`/api/workspaces/${workspaceId}/invites`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, role }),
  });
  return handleResponse(res);
}

export async function fetchInvites(workspaceId: string) {
  const res = await fetch(`/api/workspaces/${workspaceId}/invites`);
  return handleResponse(res);
}

export async function cancelInvite(workspaceId: string, inviteId: string) {
  const res = await fetch(`/api/workspaces/${workspaceId}/invites/${inviteId}`, { method: "DELETE" });
  return handleResponse(res);
}
