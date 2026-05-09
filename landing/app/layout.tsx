import type { Metadata } from "next";
import { Cinzel } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-cinzel",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Augury — Read the swarm",
  description: "A multi-agent swarm reading onchain markets in adversarial consensus. Built on elizaOS.",
  openGraph: {
    title: "Augury",
    description: "Eight agents. One reading.",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Augury",
    description: "Eight agents. One reading.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${cinzel.variable} ${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-geist antialiased">{children}</body>
    </html>
  );
}
