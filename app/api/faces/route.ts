import { NextResponse } from "next/server";
import { includedFaces, toView } from "@/lib/manifest";

export const dynamic = "force-dynamic";

// GET /api/faces -> every included face (the default grid, empty search).
export async function GET() {
  const faces = includedFaces().map((f) => toView(f));
  return NextResponse.json({ count: faces.length, faces });
}
