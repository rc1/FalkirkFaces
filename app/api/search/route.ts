import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { embedText } from "@/lib/embeddings";
import { searchVectors, searchVectorsFull, allVectors } from "@/lib/db";
import { oppositeOf } from "@/lib/narrate";
import { readManifest, toView } from "@/lib/manifest";
import type { Face } from "@/lib/types";

export const dynamic = "force-dynamic";

const dot = (a: number[], b: number[]) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
};

// POST /api/search { query, limit?, mode? }
// mode "match"  (default): nearest faces to the query — a cluster around it.
// mode "a": the query's top matches, but RE-ORDERED along the query->opposite
//   axis (centre = query pole, radiating toward the opposite). A subtle gradient.
// mode "b": the faces lying nearest the query->opposite LINE, laid out across the
//   whole span — a genuine query -> neutral -> opposite spectrum.
// Both axis modes project onto (opposite - query), which cancels the common-mode
// content baseline both poles share, isolating the emotional dimension.
export async function POST(req: Request) {
  let body: { query?: string; limit?: number; mode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const query = (body.query || "").trim();
  if (!query) return NextResponse.json({ count: 0, faces: [] });

  const limit = body.limit ?? config.searchLimit;
  const mode = body.mode === "a" || body.mode === "b" ? body.mode : "match";

  let qv: number[];
  try {
    qv = await embedText(query);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  const byId = new Map(readManifest().map((f) => [f.id, f]));
  const included = (id: string): Face | null => {
    const f = byId.get(id);
    return f && f.included ? f : null;
  };

  // --- plain similarity (and the fallback if no opposite pole resolves) ---
  let opposite: string | null = null;
  if (mode !== "match") opposite = (await oppositeOf(query)) || null;

  if (mode === "match" || !opposite) {
    const hits = await searchVectors(qv, limit);
    const faces = hits
      .map((h) => {
        const f = included(h.id);
        return f ? toView(f, 1 / (1 + h.distance)) : null;
      })
      .filter(Boolean);
    return NextResponse.json({ count: faces.length, query, mode: "match", faces });
  }

  // --- axis modes ---
  const ov = await embedText(opposite);
  const axis = ov.map((v, i) => v - qv[i]); // query -> opposite direction
  const alen = Math.sqrt(dot(axis, axis)) || 1;
  const unit = axis.map((v) => v / alen);

  let ranked: { id: string; t: number; perp: number }[];

  if (mode === "a") {
    // Top matches to the query, re-ordered along the axis.
    const pool = await searchVectorsFull(qv, limit + 80);
    ranked = pool
      .filter((p) => included(p.id))
      .slice(0, limit)
      .map((p) => {
        const d = p.vector.map((v, i) => v - qv[i]);
        return { id: p.id, t: dot(d, unit), perp: 0 };
      });
  } else {
    // Faces nearest the line, spanning the whole axis.
    const everything = await allVectors();
    ranked = everything
      .filter((v) => included(v.id))
      .map((v) => {
        const d = v.vector.map((x, i) => x - qv[i]);
        const t = dot(d, unit);
        const perp = Math.sqrt(Math.max(0, dot(d, d) - t * t));
        return { id: v.id, t, perp };
      })
      .sort((a, b) => a.perp - b.perp)
      .slice(0, limit);
  }

  // Display order = position along the axis: query pole at the centre (rank 0),
  // radiating out toward the opposite.
  ranked.sort((a, b) => a.t - b.t);
  const span = (ranked.at(-1)?.t ?? 1) - (ranked[0]?.t ?? 0) || 1;
  const t0 = ranked[0]?.t ?? 0;
  const faces = ranked
    .map((r) => {
      const f = included(r.id);
      // score: 1 at the query pole, 0 at the opposite — for subtle display.
      return f ? toView(f, 1 - (r.t - t0) / span) : null;
    })
    .filter(Boolean);

  return NextResponse.json({ count: faces.length, query, mode, opposite, faces });
}
