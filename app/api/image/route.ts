import fs from "node:fs";
import { NextResponse } from "next/server";
import { resolveDataFile, resolveSourceFile } from "@/lib/paths";

export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

// GET /api/image?path=thumbs/<id>.jpg   -> generated file under DATA_DIR
// GET /api/image?src=<filename>         -> original source image
// Only ever resolves inside the two known roots; anything else 400s.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const rel = url.searchParams.get("path");
  const src = url.searchParams.get("src");

  const abs = rel
    ? resolveDataFile(rel)
    : src
      ? resolveSourceFile(src)
      : null;

  if (!abs) return NextResponse.json({ error: "bad path" }, { status: 400 });
  if (!fs.existsSync(abs))
    return NextResponse.json({ error: "not found" }, { status: 404 });

  const ext = abs.slice(abs.lastIndexOf(".")).toLowerCase();
  const data = fs.readFileSync(abs);
  return new NextResponse(data, {
    headers: {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
