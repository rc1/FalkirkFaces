"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Small rounded webcam window that replaces the search input. Runs a 5-second
// countdown shown subtly in the window, then flashes to black and captures a
// frame, handing it to `onCapture` (which searches the corpus for similar faces).
const SECONDS = 5;

export default function Webcam({
  onCapture,
}: {
  onCapture: (dataUrl: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [count, setCount] = useState(SECONDS);
  const [flash, setFlash] = useState(false);

  const capture = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    onCapture(c.toDataURL("image/jpeg", 0.8));
  }, [onCapture]);

  // Camera stream.
  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
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
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Countdown ticker: 5→1, then flash + capture, then reset.
  useEffect(() => {
    const t = setInterval(() => {
      setCount((c) => {
        if (c <= 1) {
          capture();
          setFlash(true);
          setTimeout(() => setFlash(false), 420);
          return SECONDS;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [capture]);

  return (
    <div className="webcam-wrap">
      <video ref={videoRef} className="webcam-view" muted playsInline />
      <span className="webcam-count">{count}</span>
      <div className={`webcam-flash ${flash ? "on" : ""}`} />
    </div>
  );
}
