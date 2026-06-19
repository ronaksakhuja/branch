"use client";

import { useEffect, useState } from "react";
import { useUser, SignInButton } from "@clerk/nextjs";
import Link from "next/link";

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { user, isLoaded } = useUser();
  const [invite, setInvite] = useState<{ email: string; role: string; workspaceName: string; token: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => { params.then((p) => setToken(p.token)); }, [params]);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/invites/${token}`).then((r) => r.ok ? r.json() : Promise.reject()).then(setInvite).catch(() => setError("This invite link is invalid or has expired."));
  }, [token]);

  useEffect(() => {
    if (!user || !invite || accepted) return;
    fetch(`/api/invites/${invite.token}/accept`, { method: "POST" })
      .then((r) => { if (r.ok) setAccepted(true); })
      .catch(() => setError("Failed to accept invite."));
  }, [user, invite, accepted]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f9f8f6]">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        {error && (
          <>
            <h1 className="text-lg font-semibold text-zinc-800">Invite not available</h1>
            <p className="mt-2 text-sm text-zinc-500">{error}</p>
            <Link href="/" className="mt-4 inline-block rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-zinc-700">Go to Branch</Link>
          </>
        )}

        {!invite && !error && (
          <p className="text-sm text-zinc-400">Loading invite...</p>
        )}

        {invite && !user && (
          <>
            <h1 className="text-lg font-semibold text-zinc-800">You&apos;ve been invited</h1>
            <p className="mt-2 text-sm text-zinc-500">
              to join <strong>{invite.workspaceName}</strong> as a <strong>{invite.role}</strong>.
            </p>
            <p className="mt-1 text-xs text-zinc-400">{invite.email}</p>
            <div className="mt-6">
              <SignInButton mode="modal">
                <button className="rounded-lg bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700">Sign in to accept</button>
              </SignInButton>
            </div>
            <p className="mt-3 text-xs text-zinc-400">Sign in with {invite.email} to accept this invite.</p>
          </>
        )}

        {invite && user && !accepted && (
          <>
            <h1 className="text-lg font-semibold text-zinc-800">Accepting invite...</h1>
            <p className="mt-2 text-sm text-zinc-500">Adding you to {invite.workspaceName}</p>
          </>
        )}

        {accepted && (
          <>
            <h1 className="text-lg font-semibold text-green-700">Invite accepted!</h1>
            <p className="mt-2 text-sm text-zinc-500">You now have access to <strong>{invite?.workspaceName}</strong></p>
            <Link href="/" className="mt-6 inline-block rounded-lg bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700">Open workspace</Link>
          </>
        )}
      </div>
    </div>
  );
}
