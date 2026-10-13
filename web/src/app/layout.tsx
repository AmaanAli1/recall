import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "@/components/shell.css";

// Fonts are self-hosted from npm (@fontsource) via next/font/local:
// no runtime request to Google, no layout shift, works in CI without network quirks.
const schibsted = localFont({
  src: [
    { path: "../../node_modules/@fontsource-variable/schibsted-grotesk/files/schibsted-grotesk-latin-wght-normal.woff2", weight: "400 900", style: "normal" },
  ],
  variable: "--font-schibsted",
  display: "swap",
});

const fragment = localFont({
  src: [
    { path: "../../node_modules/@fontsource/fragment-mono/files/fragment-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../../node_modules/@fontsource/fragment-mono/files/fragment-mono-latin-400-italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-fragment",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Recall", template: "%s · Recall" },
  description:
    "Recall reads your lecture PDFs, scores every passage against your question, and shows the exact page each answer came from.",
};

export const viewport: Viewport = { themeColor: "#F3EFE6" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${schibsted.variable} ${fragment.variable}`}>
      <body>{children}</body>
    </html>
  );
}
