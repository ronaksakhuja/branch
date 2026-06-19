"use client";

import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function CliAuthPage() {
  const { user, isLoaded } = useUser();
  const [status, setStatus] = useState("Connecting to Branch...");

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const port = sp.get("port") || "9876";

    if (!isLoaded) return;

    if (!user) {
      queueMicrotask(() => setStatus("Sign in to continue"));
      return;
    }

    queueMicrotask(() => setStatus(`Signed in as ${user.fullName || user.emailAddresses[0]?.emailAddress || "you"}. Sending back to CLI...`));

    const timer = setTimeout(() => {
      window.location.href = `http://localhost:${port}?userId=${encodeURIComponent(user.id)}`;
    }, 600);

    return () => clearTimeout(timer);
  }, [user, isLoaded]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f9f8f6]">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-800">Branch CLI</h1>

        <p className="mt-4 text-sm text-zinc-600">{status}</p>

        {!isLoaded && (
          <div className="mt-5 h-1.5 w-full rounded-full bg-zinc-100 overflow-hidden">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-zinc-400" />
          </div>
        )}

        {isLoaded && !user && (
          <div className="mt-5">
            <Link href="/" className="inline-block rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-zinc-700">
              Sign in to Branch
            </Link>
            <p className="mt-3 text-xs text-zinc-400">
              Then run <code className="rounded bg-zinc-100 px-1 font-mono">branch login</code> again.
            </p>
          </div>
        )}

        {isLoaded && user && (
          <p className="mt-3 text-xs text-zinc-400">
            This page will redirect back to your terminal. You can close this tab after that.
          </p>
        )}
      </div>
    </main>
  );
}
