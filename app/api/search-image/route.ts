import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { embedImageBytes } from "@/lib/embeddings";
import { searchVectors } from "@/lib/db";
import { readManifest, toView } from "@/lib/manifest";

export const dynamic = "force-dynamic";

// POST /api/search-image { image: "data:image/jpeg;base64,…" | "<base64>" }
// Embeds the image (e.g. a webcam frame) and returns the nearest faces — the
// faces in the corpus that most resemble what's in front of the camera.
export async function POST(req: Request) {
  let body: { image?: string; limit?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const raw = body.image || "";
  const b64 = raw.includes(",") ? raw.slice(raw.indexOf(",") + 1) : raw;
  if (!b64) return NextResponse.json({ count: 0, faces: [] });

  let vector: number[];
  try {
    vector = await embedImageBytes(b64, "image/jpeg");
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  const hits = await searchVectors(vector, body.limit ?? config.searchLimit);
  const byId = new Map(readManifest().map((f) => [f.id, f]));
  const faces = hits
    .map((h) => {
      const f = byId.get(h.id);
      if (!f || !f.included) return null;
      return toView(f, 1 / (1 + h.distance));
    })
    .filter(Boolean);

  return NextResponse.json({ count: faces.length, faces });
}
