import type { Metadata, Viewport } from "next";
import "./globals.css";
import SWRegister from "@/components/SWRegister";
import { config } from "@/lib/config";

export const metadata: Metadata = {
  title: config.app.name,
  description: config.app.tagline,
  manifest: "/manifest.webmanifest",
  applicationName: config.app.name,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: config.app.name,
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
  // Explicit Apple flag for older iOS (Next emits only mobile-web-app-capable).
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: "#08080a",
  width: "device-width",
  initialScale: 1,
  // Fill the notch/safe areas so the standalone app feels full-screen.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={config.app.monochrome ? "mono" : undefined}
        style={
          config.app.gridGap
            ? ({ "--grid-gap": `${config.app.gridGap}px` } as React.CSSProperties)
            : undefined
        }
      >
        {children}
        <SWRegister />
      </body>
    </html>
  );
}
