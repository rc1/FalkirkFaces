import { NextResponse } from "next/server";
import { readManifest, sourceFor } from "@/lib/manifest";
import { blurbFor } from "@/lib/narrate";

export const dynamic = "force-dynamic";

// GET /api/blurb?id=<faceId> -> a grounded one-line caption for the face's
// source work, generated on demand (and cached). Keyed by the source work so
// every face from the same work shares one blurb.
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ blurb: null });
  const face = readManifest().find((f) => f.id === id);
  if (!face) return NextResponse.json({ blurb: null });
  const src = sourceFor(face.sourceImageFilename) ?? face.source;
  if (!src) return NextResponse.json({ blurb: null });
  const blurb = await blurbFor(face.sourceImageFilename, src);
  return NextResponse.json({ blurb });
}
