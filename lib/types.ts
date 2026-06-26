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
  score?: number; // similarity (1 - distance), present on search results
}
