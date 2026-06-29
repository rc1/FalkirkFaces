"use client";

import { useEffect, useMemo, useState } from "react";
import type { FaceView } from "@/lib/types";

// Click a face → the source photo appears EXACTLY where the tile was (a clipped
// window showing the same crop), fades in, lingers a beat so the eye connects
// it to the tile, then the window grows + the image un-zooms until the whole
// photo fits the screen. Reverse on close. The clip means nothing spills around
// the tile during the "it came from here" moment.

const APPEAR_MS = 200; // opacity fade-in at the tile

export default function Reveal({
  face,
  rect,
  onClosingStart,
  onClose,
  fadeDelay = 520, // time held at the tile before expanding
  zoomMs = 700,
}: {
  face: FaceView;
  rect: DOMRect;
  onClosingStart: () => void;
  onClose: () => void;
  fadeDelay?: number;
  zoomMs?: number;
}) {
  const [vis, setVis] = useState(false); // opacity
  const [expanded, setExpanded] = useState(false); // grown to full
  const [closing, setClosing] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false); // context panel
  const [blurb, setBlurb] = useState<string | null>(null);
  const [blurbLoading, setBlurbLoading] = useState(false);

  // Generate the grounded blurb only when the viewer asks for context.
  useEffect(() => {
    if (!infoOpen || blurb !== null || blurbLoading || !face.source) return;
    setBlurbLoading(true);
    fetch(`/api/blurb?id=${encodeURIComponent(face.id)}`)
      .then((r) => r.json())
      .then((d) => setBlurb(d.blurb || ""))
      .catch(() => setBlurb(""))
      .finally(() => setBlurbLoading(false));
  }, [infoOpen, blurb, blurbLoading, face.id, face.source]);

  const geo = useMemo(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const sw = face.sourceImageWidth;
    const sh = face.sourceImageHeight;
    const scale = Math.min(vw / sw, vh / sh);
    const dispW = sw * scale;
    const dispH = sh * scale;

    const b = face.bbox; // square padded crop region == what the tile shows
    const fx = b.x * scale;
    const fy = b.y * scale;
    const fw = b.width * scale;
    const s = rect.width / fw; // scale so the crop fills the tile-sized window

    return {
      // the clipping window: tile rect → fitted-image rect
      cellClip: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      fullClip: { left: (vw - dispW) / 2, top: (vh - dispH) / 2, width: dispW, height: dispH },
      imgSize: { width: dispW, height: dispH },
      // image transform inside the window: crop-fills-tile → image-fills-window
      imgInitial: `translate(${-s * fx}px, ${-s * fy}px) scale(${s})`,
    };
  }, [face, rect]);

  useEffect(() => {
    const r = requestAnimationFrame(() => setVis(true)); // fade in at the tile
    const t = setTimeout(() => setExpanded(true), fadeDelay); // then expand
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(r);
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function close() {
    if (closing) return;
    setClosing(true);
    setExpanded(false); // window + image return to the tile
    onClosingStart(); // grid fades back in meanwhile
    setTimeout(onClose, zoomMs);
  }

  const big = expanded && !closing;
  const clip = big ? geo.fullClip : geo.cellClip;
  const ease = "cubic-bezier(0.22,0.61,0.36,1)";
  const opacityMs = closing ? Math.round(zoomMs * 0.6) : APPEAR_MS;

  return (
    <div
      className="reveal"
      onClick={close}
      style={{ background: big ? "rgba(6,6,8,1)" : "rgba(6,6,8,0)" }}
    >
      <div
        className="reveal-clip"
        style={{
          left: clip.left,
          top: clip.top,
          width: clip.width,
          height: clip.height,
          opacity: closing ? 0 : vis ? 1 : 0,
          transition: `left ${zoomMs}ms ${ease}, top ${zoomMs}ms ${ease}, width ${zoomMs}ms ${ease}, height ${zoomMs}ms ${ease}, opacity ${opacityMs}ms ease`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="reveal-img"
          src={face.fullUrl}
          alt=""
          style={{
            width: geo.imgSize.width,
            height: geo.imgSize.height,
            transform: big ? "none" : geo.imgInitial,
            transition: `transform ${zoomMs}ms ${ease}`,
          }}
        />
      </div>

      {/* Provenance + grounded context — subtle by default, expandable. */}
      {big && face.source && (
        <div className="reveal-credit" onClick={(e) => e.stopPropagation()}>
          {!infoOpen ? (
            <button className="credit-collapsed" onClick={() => setInfoOpen(true)}>
              <span className="credit-titleline">
                {face.source.label || face.source.institution}
              </span>
              <span className="credit-i">ⓘ</span>
            </button>
          ) : (
            <div className="credit-panel">
              <button
                className="credit-close"
                onClick={() => setInfoOpen(false)}
                aria-label="close context"
              >
                ✕
              </button>
              {face.source.label && (
                <div className="credit-title">{face.source.label}</div>
              )}
              {(face.source.creator || face.source.date || face.source.medium) && (
                <div className="credit-meta">
                  {[face.source.creator, face.source.date, face.source.medium]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              )}
              {(blurbLoading || blurb) && (
                <div className="credit-blurb">{blurb || "…"}</div>
              )}
              {face.source.description && (
                <div className="credit-desc">{face.source.description}</div>
              )}
              {face.source.creditLine && (
                <div className="credit-sub">{face.source.creditLine}</div>
              )}
              <div className="credit-foot">
                {face.source.rights && <span>{face.source.rights}</span>}
                {face.source.sourceUrl && (
                  <a href={face.source.sourceUrl} target="_blank" rel="noreferrer">
                    View at {face.source.institution} ↗
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
