import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;

  try {
    const apiUrl = process.env.NEXT_PUBLIC_APP_URL || "https://branchcli.vercel.app";
    const res = await fetch(`${apiUrl}/api/share/${token}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Not found");
    const data = await res.json();

    const docName = data.documentPath?.split("/").pop()?.replace(".md", "") || data.workspace;
    const title = `${docName} — Shared via Branch`;
    const description = `"${docName}" from the ${data.workspace} workspace. Read-only.`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: "article",
        siteName: "Branch",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
      },
    };
  } catch {
    return {
      title: "Shared Document — Branch",
      description: "View this shared document on Branch.",
    };
  }
}

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
