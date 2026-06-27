import { config } from "./config";

// Play-cycle playlists, per corpus. Each is ordered to traverse the expression
// groupings that actually exist in that data (found by clustering the
// embeddings — see scripts/explore-clusters.ts).

// Falkirk crowd: the emotional rollercoaster of being a fan. Grounded in the
// discriminating feelings the analysis found here (joy, triumph, disbelief,
// terror, indignation, relief, shock…) but phrased the way a supporter feels
// them — flattering and relatable, not clinical.
const FALKIRK: string[] = [
  "pure joy",
  "ecstasy",
  "disbelief",
  "agony",
  "elation",
  "heartbreak",
  "outrage",
  "triumph",
  "anticipation",
  "delight",
  "despair",
  "relief",
  "pride",
  "awe",
  "tension",
  "determination",
  "shock",
  "lost in the moment",
];

// Feeling Scotland: derived by probing the embedding space with a 155-word
// feeling lexicon and DOUBLE-CENTRING out the content baseline (medium/era), so
// these are the feelings that genuinely *discriminate* faces here — one per
// synonym-island, chosen to span the emotional range (scripts/analyze-emotions.ts).
const SCOTLAND: string[] = [
  "wistfulness",
  "wide-eyed alarm",
  "stoicism",
  "suppressed grief",
  "defiance",
  "gentleness",
  "contempt",
  "dreaminess",
  "dread",
  "fascination",
  "sternness",
  "a haunted look",
  "mischief",
  "austerity",
  "vigilance",
  "quiet delight",
  "indignation",
  "detachment",
  "patience",
  "deep absorption",
];

export const PLAYLISTS: Record<string, string[]> = {
  falkirk: FALKIRK,
  scotland: SCOTLAND,
};

export function getPlaylist(): string[] {
  return PLAYLISTS[config.app.corpus] || FALKIRK;
}
