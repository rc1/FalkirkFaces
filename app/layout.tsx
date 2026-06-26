import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Art Face Explorer",
  description: "Expressive, art-based exploration of faces found in a folder.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
