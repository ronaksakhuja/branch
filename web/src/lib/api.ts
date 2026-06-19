async function handleResponse(res: Response) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(body.error || `Request failed with status ${res.status}`);
  }
  return res.json();
}

export async function fetchWorkspaces() {
  const res = await fetch("/api/workspaces");
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

export async function createDocumentApi(
  workspaceId: string,
  path: string,
  content: string,
  summary: string,
) {
  const res = await fetch(`/api/workspaces/${workspaceId}/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, content, summary }),
  });
  return handleResponse(res);
}

export async function updateDocument(
  workspaceId: string,
  path: string,
  content: string,
  summary: string,
  authorType: "Human" | "AI" = "Human",
) {
  const res = await fetch(`/api/workspaces/${workspaceId}/documents/${encodeURIComponent(path)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, summary, authorType }),
  });
  return handleResponse(res);
}

export async function deleteDocument(workspaceId: string, path: string, summary: string) {
  const res = await fetch(`/api/workspaces/${workspaceId}/documents/${encodeURIComponent(path)}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
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
  const res = await fetch(
    `/api/workspaces/${workspaceId}/documents/${encodeURIComponent(path)}/diff?from=${from}&to=${to}`,
  );
  return handleResponse(res);
}
