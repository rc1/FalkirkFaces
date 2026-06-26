"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FaceView } from "@/lib/types";

// A full-bleed mosaic of square tiles. On search (radial=true) the best match
// lands in the centre and the rest spiral outward by similarity. When a tile is
// clicked the page sets `dismissIndex`; the other tiles fade out in a wave that
// starts from the furthest cell and rolls inward toward the clicked one.

// Desired tile edge in px → column count derives from it. Smaller (denser) on
// phones, roomier on desktop.
const tileTarget = (w: number) => (w < 600 ? 72 : w < 960 ? 104 : 132);

export default function FaceGrid({
  faces,
  onReveal,
  dismissIndex,
  radial,
  gen,
  tileOverride = 0,
  dismissSpan = 360,
  bloomStep = 7,
  faceZoom = 1,
}: {
  faces: FaceView[];
  onReveal: (face: FaceView, index: number, rect: DOMRect) => void;
  dismissIndex: number | null;
  radial: boolean;
  gen: number;
  tileOverride?: number; // 0 = responsive
  dismissSpan?: number; // ms spread of the fade-out wave
  bloomStep?: number; // ms delay per tile in the radial bloom
  faceZoom?: number; // CSS scale of the face within its tile
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() =>
      setSize({ w: el.clientWidth, h: el.clientHeight }),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() => {
    const { w, h } = size;
    if (!w || !h) return null;
    const target = tileOverride > 0 ? tileOverride : tileTarget(w);
    const cols = Math.max(1, Math.round(w / target));
    const cell = w / cols;
    const rows = Math.max(1, Math.ceil(h / cell));
    const total = cols * rows;

    const cx = Math.floor(cols / 2);
    const cy = Math.floor(rows / 2);
    const cells = Array.from({ length: total }, (_, i) => ({
      i,
      d: Math.hypot((i % cols) - cx, Math.floor(i / cols) - cy),
    }));

    const order = radial
      ? [...cells].sort((a, b) => a.d - b.d || a.i - b.i)
      : cells;

    const placement = new Array<{ faceIdx: number; rank: number }>(total);
    order.forEach((c, rank) => (placement[c.i] = { faceIdx: rank, rank }));

    return { cols, rows, cell, total, placement };
  }, [size, radial, tileOverride]);

  // Distance from the clicked cell to the grid's furthest corner — used to
  // normalise the fade-out wave so the furthest tile leaves first.
  const maxDist = useMemo(() => {
    if (!layout || dismissIndex == null) return 1;
    const { cols, rows } = layout;
    const cr = Math.floor(dismissIndex / cols);
    const cc = dismissIndex % cols;
    return Math.max(
      Math.hypot(cr, cc),
      Math.hypot(cr, cols - 1 - cc),
      Math.hypot(rows - 1 - cr, cc),
      Math.hypot(rows - 1 - cr, cols - 1 - cc),
      1,
    );
  }, [layout, dismissIndex]);

  return (
    <div
      ref={ref}
      className="mosaic"
      style={
        layout
          ? {
              gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
              gridAutoRows: `${layout.cell}px`,
            }
          : undefined
      }
    >
      {layout?.placement.map((p, i) => {
        const face = faces[p.faceIdx];
        if (!face) return <div key={`${gen}-${i}`} className="cell empty" />;

        // Fade-out styling when a tile elsewhere has been clicked.
        let dismissStyle: React.CSSProperties = {};
        if (dismissIndex != null && i !== dismissIndex) {
          const { cols } = layout!;
          const dist = Math.hypot(
            Math.floor(i / cols) - Math.floor(dismissIndex / cols),
            (i % cols) - (dismissIndex % cols),
          );
          dismissStyle = {
            opacity: 0,
            transitionDelay: `${(1 - dist / maxDist) * dismissSpan}ms`,
          };
        }

        return (
          <button
            key={`${gen}-${i}`}
            className={dismissIndex == null ? "cell bloom" : "cell"}
            style={{ animationDelay: `${p.rank * bloomStep}ms`, ...dismissStyle }}
            onClick={(e) =>
              onReveal(face, i, e.currentTarget.getBoundingClientRect())
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={face.thumbUrl}
              alt="face"
              loading="lazy"
              style={faceZoom !== 1 ? { transform: `scale(${faceZoom})` } : undefined}
            />
          </button>
        );
      })}
    </div>
  );
}
