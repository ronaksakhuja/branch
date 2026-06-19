import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "https://branchcli.vercel.app"}/api/share/${token}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Not found");
    const data = await res.json();

    const docName = data.documentPath?.split("/").pop()?.replace(".md", "") || data.workspace;
    return {
      title: `${docName} — Branch`,
      description: `Read "${docName}" from the ${data.workspace} workspace on Branch.`,
      openGraph: {
        title: `${docName} — Branch`,
        description: `Read "${docName}" from the ${data.workspace} workspace on Branch.`,
        type: "article",
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
