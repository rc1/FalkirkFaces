import { config } from "./config";

// Play-cycle playlists, per corpus. Each is ordered to traverse the expression
// groupings that actually exist in that data (found by clustering the
// embeddings — see scripts/explore-clusters.ts).

// Falkirk crowd: a distinct open-mouthed/roaring pocket, laughter, the big
// neutral thousand-yard-stare mass, an intense/tearful group, squinting youth.
const FALKIRK: string[] = [
  "open-mouthed roar",
  "helpless laughter",
  "wide-eyed shock",
  "thousand-yard stare",
  "lost in thought",
  "wry half-smile",
  "deadpan blankness",
  "quiet melancholy",
  "welling tears",
  "anguished grimace",
  "gritted-teeth tension",
  "hard glare",
  "wary suspicion",
  "rapt attention",
  "open-mouthed awe",
  "tender warmth",
  "soft smile",
  "squinting into the light",
  "nostalgic faraway look",
  "weary resignation",
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
