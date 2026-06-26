// Tunable knobs. Change a threshold, rerun `npm run crop` + `npm run embed`,
// and the grid changes. Nothing here is sacred.

const num = (v: string | undefined, d: number) =>
  v !== undefined && v !== "" ? Number(v) : d;

export const config = {
  // Filtering — faces below these are kept in the manifest but marked excluded.
  minFaceWidth: num(process.env.MIN_FACE_WIDTH, 96),
  minFaceHeight: num(process.env.MIN_FACE_HEIGHT, 96),
  minDetectorConfidence: num(process.env.MIN_DETECTOR_CONFIDENCE, 0.6),

  // Embeddings.
  embedModel: process.env.EMBED_MODEL || "gemini-embedding-2",
  embedDim: num(process.env.EMBED_DIM, 768),

  // Thumbnail sizes.
  thumbSize: 256, // square-ish face thumbnail (longest edge)
  fullThumbMax: 1400, // longest edge of the full-image thumbnail

  // Default number of search results.
  searchLimit: 60,
};
