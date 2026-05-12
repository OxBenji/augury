import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "murmur — adversarial swarm intelligence",
  description: "a swarm of specialist AI agents reading chaotic systems in adversarial consensus.",
  openGraph: {
    title: "murmur",
    description: "the murmur reads.",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "murmur",
    description: "the murmur reads.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-mono antialiased">{children}</body>
    </html>
  );
}
