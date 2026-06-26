import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { embedText } from "@/lib/embeddings";
import { searchVectors } from "@/lib/db";
import { readManifest, toView } from "@/lib/manifest";

export const dynamic = "force-dynamic";

// POST /api/search { query: string, limit?: number }
// Embeds the text query and returns the nearest face crops. Because Gemini
// Embedding 2 shares one space across images + text, the text vector lands near
// faces that *look* like the words.
export async function POST(req: Request) {
  let body: { query?: string; limit?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const query = (body.query || "").trim();
  if (!query) return NextResponse.json({ count: 0, faces: [] });

  const limit = body.limit ?? config.searchLimit;

  let vector: number[];
  try {
    vector = await embedText(query);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }

  const hits = await searchVectors(vector, limit);
  const byId = new Map(readManifest().map((f) => [f.id, f]));

  const faces = hits
    .map((h) => {
      const f = byId.get(h.id);
      if (!f || !f.included) return null;
      // Turn L2 distance into a gentle 0..1 similarity for subtle display.
      const score = 1 / (1 + h.distance);
      return toView(f, score);
    })
    .filter(Boolean);

  return NextResponse.json({ count: faces.length, query, faces });
}
