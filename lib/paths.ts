import path from "node:path";

// Single source of truth for every local path. Change a folder here and the
// whole pipeline + app follow.

const ROOT = process.cwd();

export const SOURCE_DIR = path.resolve(
  ROOT,
  process.env.SOURCE_DIR || "photos",
);

export const DATA_DIR = path.resolve(ROOT, process.env.DATA_DIR || "volumes");

export const paths = {
  source: SOURCE_DIR,
  data: DATA_DIR,
  crops: path.join(DATA_DIR, "crops"),
  thumbs: path.join(DATA_DIR, "thumbs"),
  fullThumbs: path.join(DATA_DIR, "full-thumbs"),
  lancedb: path.join(DATA_DIR, "lancedb"),
  manifest: path.join(DATA_DIR, "manifest.json"),
  detections: path.join(DATA_DIR, "detections.json"),
  images: path.join(DATA_DIR, "images.json"),
};

// Map a logical data subfolder to its absolute root. Used by /api/image to
// resolve a relative path safely (never trust a raw client path).
export function resolveDataFile(relPath: string): string | null {
  const safe = path
    .normalize(relPath)
    .replace(/^(\.\.(\/|\\|$))+/, ""); // strip leading ../
  if (path.isAbsolute(safe)) return null;
  const abs = path.join(DATA_DIR, safe);
  if (!abs.startsWith(DATA_DIR + path.sep)) return null; // escaped the sandbox
  return abs;
}

export function resolveSourceFile(filename: string): string | null {
  const base = path.basename(filename); // basename only — no traversal
  const abs = path.join(SOURCE_DIR, base);
  if (!abs.startsWith(SOURCE_DIR + path.sep)) return null;
  return abs;
}
