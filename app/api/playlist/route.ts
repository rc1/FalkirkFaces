import { NextResponse } from "next/server";
import { getPlaylist } from "@/lib/playlist";

export const dynamic = "force-dynamic";

// GET /api/playlist -> the play-cycle phrases for this corpus (runtime-selected).
export async function GET() {
  return NextResponse.json({ playlist: getPlaylist() });
}
