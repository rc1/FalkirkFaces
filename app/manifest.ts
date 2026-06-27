import type { MetadataRoute } from "next";
import { config } from "@/lib/config";

// Web app manifest — served by Next at /manifest.webmanifest. Makes the app
// installable on Android (Chrome) and iOS (Add to Home Screen).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: config.app.name,
    short_name: config.app.shortName,
    description: config.app.tagline,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#08080a",
    theme_color: "#08080a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
