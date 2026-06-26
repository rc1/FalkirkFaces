"use client";

import { useEffect } from "react";

// Registers the service worker (no-op where unsupported). Keeps the PWA
// installable and gives an offline fallback.
export default function SWRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
