import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Branch — Git for Documents", template: "%s — Branch" },
  description: "A markdown workspace where every change is tracked, every version is reviewable, and humans and AI edit the same source of truth.",
  openGraph: {
    title: "Branch — Git for Documents",
    description: "A markdown workspace where every change is tracked, every version is reviewable, and humans and AI edit the same source of truth.",
    type: "website",
    siteName: "Branch",
  },
  twitter: {
    card: "summary_large_image",
    title: "Branch — Git for Documents",
    description: "A markdown workspace where every change is tracked, every version is reviewable, and humans and AI edit the same source of truth.",
  },
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
        <body className="min-h-full flex flex-col">{children}</body>
      </html>
    </ClerkProvider>
  );
}
