import * as lancedb from "@lancedb/lancedb";
import { paths } from "../lib/paths";
import { embedText } from "../lib/embeddings";

// Build a maximally-DISTINCT playlist for a corpus: from a pool of
// corpus-appropriate feeling phrases, greedily pick the ones that are strong
// (discriminate faces) AND least overlapping with those already chosen. Drops
// flat phrases. Verified against the real embedding space — no guessing.
//
//   DATA_DIR=volumes        npx tsx scripts/build-playlist.ts falkirk 18
//   DATA_DIR=scotland/volumes npx tsx scripts/build-playlist.ts scotland 18

const CORPUS = process.argv[2] || "falkirk";
const N = Number(process.argv[3] || 18);
const TOPK = 30;
const OVERLAP_W = Number(process.env.OVERLAP_W || 30); // how hard to punish redundancy

// Fan-relatable feeling words for the football crowd — flattering/relatable
// only (no clinical or unflattering terms; nobody wants their face under those).
const POOL_FALKIRK = [
  "pure joy", "ecstasy", "elation", "delight", "jubilation", "euphoria", "glee",
  "triumph", "pride", "awe", "wonder", "hope", "anticipation", "eagerness",
  "excitement", "nerves", "tension", "suspense", "disbelief", "astonishment",
  "shock", "dismay", "agony", "anguish", "despair", "heartbreak", "devastation",
  "frustration", "outrage", "indignation", "fury", "defiance", "determination",
  "grit", "relief", "exhaustion", "resignation", "longing", "lost in the moment",
  "rapt attention", "gutted", "passion", "elated relief",
];

// Period-appropriate feeling words for 19th-century Scottish portraiture.
const POOL_SCOTLAND = [
  "wistfulness", "melancholy", "pensiveness", "dreaminess", "contemplation",
  "quiet sorrow", "grief", "suppressed grief", "stoicism", "composure",
  "dignity", "gravity", "solemnity", "sternness", "severity", "austerity",
  "defiance", "determination", "resolve", "pride", "contempt", "disdain",
  "distrust", "suspicion", "wariness", "vigilance", "guardedness", "weariness",
  "resignation", "exhaustion", "gentleness", "tenderness", "kindness",
  "innocence", "shyness", "fascination", "curiosity", "alarm", "dread", "fear",
  "terror", "indignation", "fury", "detachment", "vacancy", "a haunted look",
  "a faraway gaze", "deep absorption", "mischief", "slyness", "patience",
];

const norm = (v: number[]) => {
  let s = 0;
  for (const x of v) s += x * x;
  s = Math.sqrt(s) || 1;
  return v.map((x) => x / s);
};
const dot = (a: number[], b: number[]) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
};
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
const std = (a: number[]) => {
  const m = mean(a);
  return Math.sqrt(mean(a.map((x) => (x - m) ** 2)));
};
const jaccard = (a: Set<string>, b: Set<string>) => {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
};

async function main() {
  const POOL = CORPUS === "scotland" ? POOL_SCOTLAND : POOL_FALKIRK;
  const db = await lancedb.connect(paths.lancedb);
  const tbl = await db.openTable("faces");
  const rows = (await tbl.query().limit(100000).toArray()) as Array<{
    id: string;
    vector: number[] | Float32Array;
  }>;
  const ids = rows.map((r) => r.id);
  const F = rows.map((r) => norm(Array.from(r.vector)));
  console.log(`Building "${CORPUS}" playlist from ${POOL.length} candidates over ${F.length} faces\n`);

  // Score every candidate.
  type Item = { phrase: string; strength: number; set: Set<string> };
  const items: Item[] = [];
  const CONC = 6;
  const buckets = Array.from({ length: CONC }, (_, b) => POOL.filter((_, i) => i % CONC === b));
  await Promise.all(
    buckets.map(async (b) => {
      for (const phrase of b) {
        const e = norm(await embedText(phrase));
        const sims = F.map((f) => dot(f, e));
        const top = sims.map((s, i) => ({ s, i })).sort((a, b2) => b2.s - a.s).slice(0, TOPK);
        items.push({ phrase, strength: std(sims), set: new Set(top.map((t) => ids[t.i])) });
      }
    }),
  );

  // Drop flat candidates (below 0.6 × median strength).
  const med = [...items].sort((a, b) => a.strength - b.strength)[Math.floor(items.length / 2)].strength;
  const floor = med * 0.6;
  const pool = items.filter((it) => it.strength >= floor);

  // Greedy max-distinct selection.
  const picked: Item[] = [pool.reduce((a, b) => (b.strength > a.strength ? b : a))];
  while (picked.length < N && picked.length < pool.length) {
    let best: Item | null = null;
    let bestScore = -Infinity;
    for (const c of pool) {
      if (picked.includes(c)) continue;
      const maxOv = Math.max(...picked.map((p) => jaccard(c.set, p.set)));
      const score = c.strength * 1000 - OVERLAP_W * maxOv;
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    if (!best) break;
    picked.push(best);
  }

  // Report.
  console.log(`=== SELECTED (${picked.length}) — strong + distinct ===`);
  picked.forEach((p, i) => {
    const maxOv = i === 0 ? 0 : Math.max(...picked.slice(0, i).map((q) => jaccard(p.set, q.set)));
    console.log(`  ${(p.strength * 1000).toFixed(1)}  ov ${maxOv.toFixed(2)}  ${p.phrase}`);
  });
  let pairTotal = 0,
    pairN = 0;
  for (let i = 0; i < picked.length; i++)
    for (let j = i + 1; j < picked.length; j++) {
      pairTotal += jaccard(picked[i].set, picked[j].set);
      pairN++;
    }
  console.log(`\nMean pairwise overlap: ${(pairTotal / pairN).toFixed(3)}`);
  console.log(`\nArray:\n${JSON.stringify(picked.map((p) => p.phrase), null, 2)}`);
}

main();
