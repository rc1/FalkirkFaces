import crypto from "node:crypto";
import sharp from "sharp";
import type { BBox } from "./types";

// Stable id from source filename + bbox, so re-running the pipeline keeps the
// same ids (and the same crop/thumb filenames) for unchanged faces.
export function faceId(filename: string, bbox: BBox): string {
  const key = `${filename}:${bbox.x},${bbox.y},${bbox.width},${bbox.height}`;
  return crypto.createHash("sha1").update(key).digest("hex").slice(0, 16);
}

// Stable id per source image — used to share one full-image thumbnail across
// all the faces found in that image.
export function sourceId(filename: string): string {
  return crypto.createHash("sha1").update(filename).digest("hex").slice(0, 16);
}

export async function imageSize(file: string) {
  const m = await sharp(file).metadata();
  return { width: m.width ?? 0, height: m.height ?? 0 };
}

// Clamp a bbox to the image so sharp.extract never throws on edge faces.
export function clampBox(b: BBox, w: number, h: number): BBox {
  const x = Math.max(0, Math.round(b.x));
  const y = Math.max(0, Math.round(b.y));
  return {
    x,
    y,
    width: Math.min(Math.round(b.width), w - x),
    height: Math.min(Math.round(b.height), h - y),
  };
}

export async function cropFace(
  source: string,
  box: BBox,
  outPath: string,
): Promise<{ width: number; height: number }> {
  await sharp(source)
    .extract({ left: box.x, top: box.y, width: box.width, height: box.height })
    .jpeg({ quality: 90 })
    .toFile(outPath);
  return { width: box.width, height: box.height };
}

export async function makeThumb(source: string, outPath: string, size: number) {
  await sharp(source)
    .resize(size, size, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toFile(outPath);
}
