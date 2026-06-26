"use client";

import { useEffect, useMemo, useState } from "react";
import type { FaceView } from "@/lib/types";

// Seamless zoom: the clicked face (already framed inside its tile) expands until
// the whole source image fits the screen. The full image is positioned so its
// face region overlays the tile at the start, then the transform animates to
// identity. The image also fades in as it grows and fades out as it returns, so
// the hand-off with the grid is a soft cross-fade rather than a snap.

const FADE_DELAY = 380; // let the grid clear a little before we expand
const ZOOM_MS = 700;

export default function Reveal({
  face,
  rect,
  onClosingStart,
  onClose,
}: {
  face: FaceView;
  rect: DOMRect;
  onClosingStart: () => void; // tell the grid to start coming back
  onClose: () => void; // unmount once the return animation finishes
}) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  const geo = useMemo(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const sw = face.sourceImageWidth;
    const sh = face.sourceImageHeight;
    const scale = Math.min(vw / sw, vh / sh);
    const dispW = sw * scale;
    const dispH = sh * scale;
    const finalLeft = (vw - dispW) / 2;
    const finalTop = (vh - dispH) / 2;

    const b = face.bbox;
    const S = rect.width / (b.width * scale);
    const TX = rect.left - finalLeft - S * (b.x * scale);
    const TY = rect.top - finalTop - S * (b.y * scale);

    return {
      style: { left: finalLeft, top: finalTop, width: dispW, height: dispH } as React.CSSProperties,
      initial: `translate(${TX}px, ${TY}px) scale(${S})`,
    };
  }, [face, rect]);

  useEffect(() => {
    const t = setTimeout(() => setOpen(true), FADE_DELAY);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function close() {
    if (closing) return;
    setClosing(true);
    setOpen(false);
    onClosingStart(); // grid fades back in while the image fades out + shrinks
    setTimeout(onClose, ZOOM_MS);
  }

  const expanded = open && !closing;

  return (
    <div
      className="reveal"
      onClick={close}
      style={{ background: expanded ? "rgba(6,6,8,1)" : "rgba(6,6,8,0)" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="reveal-img"
        src={face.fullUrl}
        alt=""
        style={{
          ...geo.style,
          transform: expanded ? "none" : geo.initial,
          opacity: expanded ? 1 : 0,
          transition: `transform ${ZOOM_MS}ms cubic-bezier(0.22,0.61,0.36,1), opacity ${Math.round(ZOOM_MS * 0.7)}ms ease`,
        }}
      />
    </div>
  );
}
