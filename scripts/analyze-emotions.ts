import * as lancedb from "@lancedb/lancedb";
import { paths } from "../lib/paths";
import { embedText } from "../lib/embeddings";

// Investigate the EMOTION structure of the corpus (not content). Probe the
// face-embedding space with a rich feeling lexicon, then DOUBLE-CENTRE the
// face×emotion similarity matrix (subtract each face's overall evocativeness AND
// each emotion's overall prevalence). What's left is the interaction: which
// faces are *distinctively* a given feeling, beyond "it's an old sepia photo".
// From that we find: which feelings actually discriminate, which feelings are
// synonymous in this data (islands), and a maximally-spread feelings playlist.

// A broad feeling lexicon (single, nuanced affect words/phrases).
const FEELINGS = [
  "joy", "elation", "delight", "contentment", "serenity", "calm", "peace",
  "bliss", "ecstasy", "cheerfulness", "amusement", "mirth", "playfulness",
  "tenderness", "affection", "warmth", "love", "adoration", "compassion",
  "gratitude", "hope", "optimism", "pride", "confidence", "satisfaction",
  "triumph", "relief", "awe", "wonder", "reverence", "curiosity", "fascination",
  "interest", "anticipation", "eagerness", "excitement", "longing", "yearning",
  "wistfulness", "nostalgia", "melancholy", "sadness", "sorrow", "grief",
  "despair", "anguish", "heartbreak", "loneliness", "isolation", "emptiness",
  "numbness", "resignation", "weariness", "exhaustion", "boredom", "apathy",
  "indifference", "detachment", "vacancy", "disappointment", "regret",
  "remorse", "guilt", "shame", "embarrassment", "humiliation", "shyness",
  "bashfulness", "vulnerability", "insecurity", "doubt", "uncertainty",
  "hesitation", "confusion", "bewilderment", "disbelief", "shock", "surprise",
  "astonishment", "alarm", "fear", "dread", "anxiety", "worry", "unease",
  "nervousness", "tension", "panic", "terror", "horror", "suspicion",
  "distrust", "wariness", "vigilance", "guardedness", "defensiveness", "anger",
  "rage", "fury", "irritation", "annoyance", "frustration", "exasperation",
  "bitterness", "resentment", "indignation", "contempt", "scorn", "disdain",
  "disgust", "revulsion", "hostility", "menace", "defiance", "determination",
  "resolve", "stubbornness", "grit", "stoicism", "solemnity", "gravity",
  "seriousness", "severity", "sternness", "austerity", "pensiveness",
  "thoughtfulness", "contemplation", "concentration", "focus", "absorption",
  "distraction", "dreaminess", "wonderment", "mischief", "slyness", "smugness",
  "arrogance", "haughtiness", "dignity", "composure", "self-possession",
  "gentleness", "kindness", "patience", "humility", "meekness", "innocence",
  "tenderness toward another", "quiet sorrow", "weariness of life",
  "haunted look", "faraway gaze", "suppressed grief", "barely-held composure",
];

const FILL = (n: number) => new Array(n).fill(0);
function normalize(v: number[]): number[] {
  let s = 0;
  for (const x of v) s += x * x;
  s = Math.sqrt(s) || 1;
  return v.map((x) => x / s);
}
const dot = (a: number[], b: number[]) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
};
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
const std = (a: number[]) => {
  const m = mean(a);
  return Math.sqrt(mean(a.map((x) => (x - m) ** 2))) || 1e-9;
};
// cosine of two zero-ish-mean vectors ≈ correlation.
function corr(a: number[], b: number[]) {
  let s = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    s += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return s / (Math.sqrt(na * nb) || 1e-9);
}

async function main() {
  const db = await lancedb.connect(paths.lancedb);
  const tbl = await db.openTable("faces");
  const rows = (await tbl.query().limit(100000).toArray()) as Array<{
    id: string;
    vector: number[] | Float32Array;
  }>;
  const ids = rows.map((r) => r.id);
  const F = rows.map((r) => normalize(Array.from(r.vector)));
  const nF = F.length;
  console.log(`Loaded ${nF} faces; probing ${FEELINGS.length} feelings\n`);

  // Embed feelings (cached).
  const CONC = 6;
  const ev: number[][] = new Array(FEELINGS.length);
  const buckets = Array.from({ length: CONC }, (_, b) =>
    FEELINGS.map((_, i) => i).filter((i) => i % CONC === b),
  );
  await Promise.all(
    buckets.map(async (idxs) => {
      for (const i of idxs) ev[i] = normalize(await embedText(FEELINGS[i]));
    }),
  );

  // Similarity matrix M[f][e].
  const nE = FEELINGS.length;
  const M = F.map((f) => ev.map((e) => dot(f, e)));

  // Double-centre: R = M - rowMean - colMean + grand.
  const rowMean = M.map(mean);
  const colMean = FILL(nE).map((_, e) => mean(M.map((r) => r[e])));
  const grand = mean(rowMean);
  const R = M.map((row, f) => row.map((v, e) => v - rowMean[f] - colMean[e] + grand));

  // Per-emotion column of residuals + discriminability (std).
  const col = (e: number) => R.map((r) => r[e]);
  const cols = FEELINGS.map((_, e) => col(e));
  const disc = cols.map(std);

  const ranked = FEELINGS.map((l, e) => ({ l, e, d: disc[e] })).sort((a, b) => b.d - a.d);

  console.log(`=== MOST DISCRIMINATING FEELINGS (separate faces the most) ===`);
  ranked.slice(0, 25).forEach((r) => {
    const c = cols[r.e];
    const top = c
      .map((v, f) => ({ f, v }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 3)
      .map((x) => ids[x.f]);
    console.log(`  ${r.d.toFixed(3)}  ${r.l.padEnd(22)} e.g. ${top.join(" ")}`);
  });

  console.log(`\n=== LEAST DISCRIMINATING (flat across the corpus) ===`);
  ranked.slice(-10).reverse().forEach((r) => console.log(`  ${r.d.toFixed(3)}  ${r.l}`));

  // Feeling islands: greedily group emotions with correlation > 0.8.
  const order = ranked.map((r) => r.e);
  const islands: number[][] = [];
  const taken = new Set<number>();
  for (const e of order) {
    if (taken.has(e)) continue;
    const group = [e];
    taken.add(e);
    for (const e2 of order) {
      if (taken.has(e2)) continue;
      if (corr(cols[e], cols[e2]) > 0.8) {
        group.push(e2);
        taken.add(e2);
      }
    }
    islands.push(group);
  }
  console.log(`\n=== FEELING ISLANDS (synonymous in this data, corr>0.8) ===`);
  islands
    .filter((g) => g.length > 1)
    .slice(0, 14)
    .forEach((g) => console.log(`  {${g.map((e) => FEELINGS[e]).join(", ")}}`));

  // Maximally-spread playlist: greedy max-min on residual columns, from the
  // discriminating pool, so each pick pulls a DISTINCT slice of the data.
  const pool = ranked.slice(0, 70).map((r) => r.e);
  const picked = [pool[0]];
  while (picked.length < 20) {
    let best = -1,
      bestScore = -Infinity;
    for (const e of pool) {
      if (picked.includes(e)) continue;
      const maxCorr = Math.max(...picked.map((p) => corr(cols[e], cols[p])));
      const score = disc[e] - 1.2 * maxCorr; // reward discriminability, punish redundancy
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }
    picked.push(best);
  }
  console.log(`\n=== SPREAD PLAYLIST (distinct feelings across the corpus) ===`);
  picked.forEach((e) => {
    const top = cols[e]
      .map((v, f) => ({ f, v }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 2)
      .map((x) => ids[x.f]);
    console.log(`  ${FEELINGS[e].padEnd(22)} e.g. ${top.join(" ")}`);
  });
}

main();
