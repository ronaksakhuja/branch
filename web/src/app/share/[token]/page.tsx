"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";

export default function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const [data, setData] = useState<{ workspace: string; documentPath: string; content: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { params.then((p) => setToken(p.token)); }, [params]);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/share/${token}`)
      .then((r) => r.ok ? r.json() : Promise.reject("Not found"))
      .then(setData)
      .catch(() => setError("This share link is invalid or has been revoked."));
  }, [token]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f9f8f6]">
        <div className="text-center">
          <h1 className="text-lg font-semibold text-zinc-800">Link not available</h1>
          <p className="mt-2 text-sm text-zinc-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f9f8f6]">
        <p className="text-sm text-zinc-400">Loading...</p>
      </div>
    );
  }

  const docLabel = data.documentPath || data.workspace;

  return (
    <div className="min-h-screen bg-[#f9f8f6]">
      <div className="border-b border-zinc-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-[720px] items-center justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Branch</span>
              <span className="text-zinc-300">/</span>
              <span className="text-sm text-zinc-600 truncate">{data.workspace}</span>
              {data.documentPath && (
                <>
                  <span className="text-zinc-300">/</span>
                  <span className="text-sm font-medium text-zinc-800 truncate">{data.documentPath.split("/").pop()}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100"
            >
              {copied ? "Copied" : "Copy link"}
            </button>
            <Link href="/" className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-700">
              Branch
            </Link>
          </div>
        </div>
      </div>
      <div className="flex justify-center">
        <article className="branch-markdown w-full max-w-[720px] px-8 py-10">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {data.content || "_This document is empty._"}
          </ReactMarkdown>
        </article>
      </div>
    </div>
  );
}
