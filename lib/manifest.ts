import fs from "node:fs";
import path from "node:path";
import { paths } from "./paths";
import type { Face, FaceView, Source } from "./types";

// The manifest is the human-readable record of every face we know about
// (included and excluded). LanceDB only holds vectors; this holds meaning.

export function readManifest(): Face[] {
  if (!fs.existsSync(paths.manifest)) return [];
  return JSON.parse(fs.readFileSync(paths.manifest, "utf8"));
}

// Provenance/context is looked up LIVE from sources.json (keyed by source
// filename), not from the manifest's crop-time snapshot — so re-enriching the
// catalogue context takes effect without re-cropping. Cached per process.
let _src: Record<string, Source> | null = null;
export function sourceFor(filename: string): Source | null {
  if (!_src) {
    try {
      _src = JSON.parse(
        fs.readFileSync(path.join(paths.data, "sources.json"), "utf8"),
      );
    } catch {
      _src = {};
    }
  }
  return _src![filename] ?? null;
}

export function writeManifest(faces: Face[]): void {
  // Strip embeddings — those belong in LanceDB, not in a file we want to read.
  const lean = faces.map((f) => ({ ...f, embedding: null }));
  fs.writeFileSync(paths.manifest, JSON.stringify(lean, null, 2));
}

export function includedFaces(faces: Face[] = readManifest()): Face[] {
  return faces.filter((f) => f.included);
}

// Cache-busting token derived from the manifest's mtime — changes whenever the
// pipeline regenerates crops/thumbs, so browsers fetch the new images instead of
// serving stale cached ones. Cached for the process lifetime.
let _ver: string | null = null;
function dataVersion(): string {
  if (_ver) return _ver;
  try {
    _ver = String(Math.floor(fs.statSync(paths.manifest).mtimeMs));
  } catch {
    _ver = "0";
  }
  return _ver;
}

// Shape a stored Face into something safe + minimal for the client.
export function toView(f: Face, score?: number): FaceView {
  const v = dataVersion();
  return {
    id: f.id,
    sourceImageFilename: f.sourceImageFilename,
    sourceImageWidth: f.sourceImageWidth,
    sourceImageHeight: f.sourceImageHeight,
    bbox: f.bbox,
    thumbUrl: `/api/image?path=${encodeURIComponent(f.thumbPath || "")}&v=${v}`,
    cropUrl: `/api/image?path=${encodeURIComponent(f.cropPath || "")}&v=${v}`,
    fullUrl: `/api/image?path=${encodeURIComponent(f.fullThumbPath || "")}&v=${v}`,
    cropWidth: f.cropWidth,
    cropHeight: f.cropHeight,
    caption: f.caption,
    expressionLabel: f.expressionLabel,
    source: sourceFor(f.sourceImageFilename) ?? f.source ?? null,
    ...(score !== undefined ? { score } : {}),
  };
}
