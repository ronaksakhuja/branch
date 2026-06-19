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

  useEffect(() => {
    if (data) {
      const docName = data.documentPath?.split("/").pop()?.replace(".md", "") || data.workspace;
      document.title = `${docName} — Branch`;
    }
  }, [data]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f5f7]">
        <div className="text-center">
          <h1 className="text-lg font-semibold text-[#1d1d1f]">Link not available</h1>
          <p className="mt-2 text-sm text-[#86868b]">{error}</p>
          <Link href="/" className="mt-6 inline-block rounded-full bg-[#0071e3] px-6 py-2 text-sm font-medium text-white transition hover:bg-[#0077ed]">Go to Branch</Link>
        </div>
      </div>
    );
  }

  if (!data) return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f5f7]">
      <div className="h-1.5 w-32 rounded-full bg-[#e5e5ea] animate-pulse" />
    </div>
  );

  const docName = data.documentPath?.split("/").pop()?.replace(".md", "") || data.workspace;

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <header className="border-b border-[#e5e5ea] bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[720px] items-center justify-between px-6 py-3">
          <div className="min-w-0 flex items-center gap-2">
            <span className="text-[15px] font-semibold text-[#1d1d1f]">Branch</span>
            <span className="text-[#c5c5ca]">/</span>
            <span className="text-[14px] text-[#86868b]">{data.workspace}</span>
            {data.documentPath && <><span className="text-[#c5c5ca]">/</span><span className="text-[14px] font-medium text-[#1d1d1f] truncate">{docName}</span></>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => { navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className="rounded-full border border-[#e5e5ea] bg-white px-4 py-1.5 text-[13px] font-medium text-[#1d1d1f] transition hover:bg-[#f5f5f7]"
            >
              {copied ? "Copied" : "Copy link"}
            </button>
            <Link href="/" className="rounded-full bg-[#0071e3] px-4 py-1.5 text-[13px] font-medium text-white transition hover:bg-[#0077ed]">
              Open in Branch
            </Link>
          </div>
        </div>
      </header>

      <div className="flex justify-center">
        <article className="branch-markdown w-full max-w-[720px] px-8 py-12">
          {data.content ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.content}</ReactMarkdown>
          ) : (
            <p className="text-[#86868b] italic">This document is empty.</p>
          )}
        </article>
      </div>
    </div>
  );
}
