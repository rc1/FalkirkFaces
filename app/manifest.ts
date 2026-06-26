import type { MetadataRoute } from "next";

// Web app manifest — served by Next at /manifest.webmanifest. Makes the app
// installable on Android (Chrome) and iOS (Add to Home Screen).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Falkirk Faces",
    short_name: "Falkirk Faces",
    description: "Search a crowd by expression.",
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
