import type { Metadata } from "next";
import "./globals.css";

// Deliberately no next/font/google. That helper fetches font files at build
// time, so an offline `pnpm build` fails — which would break non-negotiable 6.
// The system stack costs nothing and works with no network at all.

export const metadata: Metadata = {
  title: "Data Product Factory",
  description:
    "Design, build, certify and operate data products with a human approval gate at every stage.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
