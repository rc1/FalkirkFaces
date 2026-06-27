"use client";

import { useEffect, useRef } from "react";

// Small rounded webcam window that replaces the search input. Captures a frame
// every `intervalMs` and hands it to `onCapture` (which searches the corpus for
// the most similar faces). First capture happens shortly after warm-up.
export default function Webcam({
  onCapture,
  intervalMs = 10000,
}: {
  onCapture: (dataUrl: string) => void;
  intervalMs?: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let first: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const capture = () => {
      const v = videoRef.current;
      if (!v || !v.videoWidth) return;
      const c = document.createElement("canvas");
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      c.getContext("2d")?.drawImage(v, 0, 0);
      onCapture(c.toDataURL("image/jpeg", 0.8));
    };

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => {});
        }
        first = setTimeout(capture, 1500); // first shot once warmed up
        timer = setInterval(capture, intervalMs);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      if (first) clearTimeout(first);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onCapture, intervalMs]);

  return <video ref={videoRef} className="webcam-view" muted playsInline />;
}
