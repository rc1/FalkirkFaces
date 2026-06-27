// Tunable knobs. Change a threshold, rerun `npm run crop` + `npm run embed`,
// and the grid changes. Nothing here is sacred.

const num = (v: string | undefined, d: number) =>
  v !== undefined && v !== "" ? Number(v) : d;

export const config = {
  // Corpus / branding — the "switch for different data". Same code, different
  // env per deployment (Falkirk Faces, Feeling Scotland, …).
  app: {
    name: process.env.APP_NAME || "Falkirk Faces",
    shortName:
      process.env.APP_SHORT_NAME || process.env.APP_NAME || "Falkirk Faces",
    tagline: process.env.APP_TAGLINE || "Search a crowd by expression.",
    // Render the imagery in black & white (CSS filter) — for mixed sepia/tone
    // heritage corpora. Build-time flag (baked into the server-rendered body).
    monochrome: /^(1|true|yes)$/i.test(process.env.APP_MONOCHROME || ""),
    // Which play-cycle playlist to use (see lib/playlist.ts). Runtime env.
    corpus: (process.env.APP_CORPUS || "falkirk").toLowerCase(),
  },

  // Filtering — faces below these are kept in the manifest but marked excluded.
  minFaceWidth: num(process.env.MIN_FACE_WIDTH, 96),
  minFaceHeight: num(process.env.MIN_FACE_HEIGHT, 96),
  minDetectorConfidence: num(process.env.MIN_DETECTOR_CONFIDENCE, 0.6),

  // Embeddings.
  embedModel: process.env.EMBED_MODEL || "gemini-embedding-2",
  embedDim: num(process.env.EMBED_DIM, 768),

  // How much breathing room to leave around each detected face when cropping —
  // fraction of the face box added on every side (0.15 = 15% margin all round).
  cropMargin: num(process.env.CROP_MARGIN, 0.15),

  // Thumbnail sizes.
  thumbSize: 256, // square-ish face thumbnail (longest edge)
  fullThumbMax: 1400, // longest edge of the full-image thumbnail

  // Default number of search results.
  searchLimit: 60,
};
