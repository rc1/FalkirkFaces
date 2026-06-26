"use client";

import { useEffect, useMemo, useState } from "react";
import type { FaceView } from "@/lib/types";

// Seamless zoom: the clicked face (already framed inside its tile) expands until
// the whole source image fits the screen. We position the full image so that,
// at the start, its face region exactly overlays the tile — then animate the
// transform to identity. No bounding box, no crop swap: one continuous zoom.

const FADE_DELAY = 420; // let the grid finish clearing before we expand
const ZOOM_MS = 700;

export default function Reveal({
  face,
  rect,
  onClose,
}: {
  face: FaceView;
  rect: DOMRect;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  // Geometry: final fit-to-screen rect, and the initial transform that maps the
  // image's face region onto the clicked tile.
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
    const S = rect.width / (b.width * scale); // zoom so the face fills the tile
    const TX = rect.left - finalLeft - S * (b.x * scale);
    const TY = rect.top - finalTop - S * (b.y * scale);

    return {
      style: {
        left: finalLeft,
        top: finalTop,
        width: dispW,
        height: dispH,
      } as React.CSSProperties,
      initial: `translate(${TX}px, ${TY}px) scale(${S})`,
    };
  }, [face, rect]);

  // Kick off the expansion once the fade-out wave has had time to clear.
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
    setClosing(true);
    setOpen(false);
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
        alt={face.sourceImageFilename}
        style={{
          ...geo.style,
          transform: expanded ? "none" : geo.initial,
          transition: `transform ${ZOOM_MS}ms cubic-bezier(0.22,0.61,0.36,1)`,
        }}
      />
    </div>
  );
}
