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

// Feeling Scotland: 19th-century portraiture held still by long exposures —
// almost no smiles, a deep mass of pensive/stoic/guarded gazes, faraway looks,
// weathered age, the odd soldier's distant stare and a rare smile at the edge.
const SCOTLAND: string[] = [
  "a pensive stare",
  "stoic dignity",
  "a faraway look",
  "weary resignation",
  "guarded watchfulness",
  "quiet melancholy",
  "stern authority",
  "a wry half-smile",
  "lost in thought",
  "weathered by time",
  "solemn composure",
  "the thousand-yard stare",
  "gentle and kind",
  "proud bearing",
  "haunted eyes",
  "a knowing glance",
  "youthful uncertainty",
  "grim determination",
  "soft sorrow",
  "a rare, fleeting smile",
];

export const PLAYLISTS: Record<string, string[]> = {
  falkirk: FALKIRK,
  scotland: SCOTLAND,
};

export function getPlaylist(): string[] {
  return PLAYLISTS[config.app.corpus] || FALKIRK;
}
