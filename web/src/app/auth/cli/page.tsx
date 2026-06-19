"use client";

import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function CliAuthPage() {
  const { user, isLoaded } = useUser();
  const [status, setStatus] = useState("Connecting...");

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const port = searchParams.get("port") || "9876";

    if (!isLoaded) return;

    if (!user) {
      queueMicrotask(() => setStatus("Not signed in. Please sign in on the Branch web app first."));
      return;
    }

    queueMicrotask(() => setStatus("Authenticated. Redirecting back to CLI..."));
    const timer = setTimeout(() => {
      window.location.href = `http://localhost:${port}?userId=${encodeURIComponent(user.id)}`;
    }, 800);

    return () => clearTimeout(timer);
  }, [user, isLoaded]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4efe5]">
      <div className="rounded-[2rem] border border-[#d9cbb5] bg-[#fffdf8] p-10 text-center shadow-sm">
        <h1 className="text-4xl font-semibold tracking-tight text-[#241f18]">Branch CLI Auth</h1>
        <p className="mt-4 text-lg text-[#6f604d]">{status}</p>
        {!isLoaded && (
          <div className="mt-6 h-2 w-48 mx-auto rounded-full bg-[#e2d5c1] overflow-hidden">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-[#241f18]" />
          </div>
        )}
        {isLoaded && !user && (
          <div className="mt-6">
            <Link
              href="/"
              className="inline-block rounded-xl bg-[#241f18] px-6 py-2 text-sm font-semibold text-white transition hover:bg-[#3f3426]"
            >
              Go to Branch
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
