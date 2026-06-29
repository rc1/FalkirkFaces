// One detected face = one row. Keep this flat and JSON-friendly so the manifest
// stays readable and easy to hand-edit while sketching.

export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ExcludeReason =
  | "too_small"
  | "low_confidence"
  | "crop_failed"
  | "embedding_failed"
  | null;

// Provenance / rights / context for a source work (heritage corpora). Optional —
// the Falkirk corpus has none. A flexible shape that any disparate collection can
// map into: a normalized core for consistent display, a free-form `extra` map so
// nothing collection-specific is lost, `references` for links to longer prose,
// and `blurb` for an evocative line grounded ONLY in the facts above it. Carried
// through so faces are never shown stripped of provenance.
export interface SourceRef {
  label: string;
  url: string;
}
export interface Source {
  institution: string | null; // e.g. "National Library of Scotland"
  label: string | null; // title of the source work
  rights: string | null; // e.g. "CC BY 4.0", "Public Domain"
  rightsUrl: string | null;
  attribution: string | null; // full attribution string to display
  sourceUrl: string | null; // link to the (human) catalogue page where possible
  // --- enriched (all optional; filled by scripts/enrich-context.ts) ---
  creator?: string | null; // artist / photographer
  date?: string | null; // display date, e.g. "ca. 1820"
  medium?: string | null; // "oil on canvas", "calotype"
  classification?: string | null; // "painting", "photograph"
  creditLine?: string | null; // "Paul Mellon Collection"
  description?: string | null; // the institution's own caption / note
  subjects?: string[]; // subject terms
  depicts?: string[]; // named sitters / people
  references?: SourceRef[]; // bibliography / related essays
  extra?: Record<string, string>; // collection-specific fields, lossless
  blurb?: string | null; // evocative line grounded only in the facts
}

export interface Face {
  id: string;
  sourceImagePath: string; // relative to SOURCE_DIR
  sourceImageFilename: string;
  sourceImageWidth: number;
  sourceImageHeight: number;
  bbox: BBox; // in source-image pixels
  cropPath: string | null; // relative to DATA_DIR
  thumbPath: string | null;
  fullThumbPath: string | null;
  cropWidth: number | null;
  cropHeight: number | null;
  included: boolean;
  excludeReason: ExcludeReason;
  detector: string;
  detectorConfidence: number;
  caption: string | null; // reserved: expressive caption (creative branch)
  expressionLabel: string | null; // reserved: single-word tone tag
  source: Source | null; // provenance/rights (heritage corpora)
  embedding: number[] | null; // kept out of manifest; lives in LanceDB
  createdAt: string;
}

// What the client actually needs to render a tile — no absolute paths, no vector.
export interface FaceView {
  id: string;
  sourceImageFilename: string;
  sourceImageWidth: number;
  sourceImageHeight: number;
  bbox: BBox;
  thumbUrl: string;
  cropUrl: string;
  fullUrl: string;
  cropWidth: number | null;
  cropHeight: number | null;
  caption: string | null;
  expressionLabel: string | null;
  source: Source | null; // provenance/rights for display
  score?: number; // similarity (1 - distance), present on search results
}
