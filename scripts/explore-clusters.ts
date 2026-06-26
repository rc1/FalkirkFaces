import * as lancedb from "@lancedb/lancedb";
import { paths } from "../lib/paths";
import { embedText } from "../lib/embeddings";

// Research: cluster the face embeddings to discover the natural expression
// groupings in THIS dataset, then label each cluster with the nearest nuanced
// expression phrases (text embeds into the same space as the faces). The point
// is to learn where the data actually splits, so the play-cycle playlist hits
// genuinely distinct groups — not football, just feeling.

const K = Number(process.argv[2] || 20);
const ITERS = 30;

// Candidate labels — nuanced, emotion-only, deliberately no football terms.
const CANDIDATES = [
  "radiant joy", "quiet contentment", "soft smile", "gentle smile",
  "beaming grin", "stifled laughter", "helpless laughter", "warm amusement",
  "mischievous grin", "smug satisfaction", "sly smirk", "wry half-smile",
  "tender affection", "wistful longing", "dreamy distraction", "lost in thought",
  "pensive stare", "vacant detachment", "glazed boredom", "weary resignation",
  "heavy exhaustion", "numb emptiness", "quiet melancholy", "welling tears",
  "on the verge of tears", "crushed disappointment", "stoic grief",
  "silent despair", "anxious worry", "nervous anticipation", "tense unease",
  "wide-eyed alarm", "open-mouthed shock", "frozen disbelief", "startled fright",
  "rapt attention", "intense concentration", "narrow-eyed focus",
  "steely determination", "quiet defiance", "burning anger", "seething fury",
  "open-mouthed shout", "gritted-teeth strain", "contempt", "cold disdain",
  "curled-lip sneer", "disgust", "wary suspicion", "sidelong distrust",
  "guarded watchfulness", "hard glare", "proud confidence", "puffed-up bravado",
  "awe", "quiet wonder", "hopeful expectation", "relief", "breathless elation",
  "ecstatic abandon", "deadpan blankness", "thousand-yard stare",
  "squinting against the light", "head-in-hands despair", "knowing glance",
  "bashful shyness", "embarrassed flush", "tight-lipped restraint",
  "trembling emotion", "fierce intensity", "gentle calm", "serene stillness",
  "bored indifference", "mild irritation", "simmering frustration",
  "tearful joy", "bittersweet smile", "nostalgic faraway look",
];

function normalize(v: number[]): number[] {
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n) || 1;
  return v.map((x) => x / n);
}
function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

async function main() {
  const db = await lancedb.connect(paths.lancedb);
  const tbl = await db.openTable("faces");
  const rows = (await tbl.query().limit(100000).toArray()) as Array<{
    id: string;
    vector: number[] | Float32Array;
  }>;
  const ids = rows.map((r) => r.id);
  const pts = rows.map((r) => normalize(Array.from(r.vector)));
  console.log(`Loaded ${pts.length} face vectors (dim ${pts[0].length})`);

  // k-means++ init.
  const centroids: number[][] = [pts[0]];
  while (centroids.length < K) {
    const d2 = pts.map((p) => {
      const best = Math.max(...centroids.map((c) => dot(p, c)));
      return 1 - best; // cosine distance
    });
    // pick the farthest point (deterministic, no RNG available)
    let bi = 0;
    for (let i = 1; i < d2.length; i++) if (d2[i] > d2[bi]) bi = i;
    centroids.push(pts[bi]);
  }

  const assign = new Array(pts.length).fill(0);
  for (let it = 0; it < ITERS; it++) {
    for (let i = 0; i < pts.length; i++) {
      let bj = 0;
      let bs = -Infinity;
      for (let j = 0; j < K; j++) {
        const s = dot(pts[i], centroids[j]);
        if (s > bs) {
          bs = s;
          bj = j;
        }
      }
      assign[i] = bj;
    }
    const sums = Array.from({ length: K }, () => new Array(pts[0].length).fill(0));
    const counts = new Array(K).fill(0);
    for (let i = 0; i < pts.length; i++) {
      counts[assign[i]]++;
      const s = sums[assign[i]];
      const p = pts[i];
      for (let d = 0; d < p.length; d++) s[d] += p[d];
    }
    for (let j = 0; j < K; j++) {
      if (counts[j] > 0) centroids[j] = normalize(sums[j]);
    }
  }

  // Embed candidate labels (same space as faces).
  console.log(`Embedding ${CANDIDATES.length} candidate labels…`);
  const labelVecs: { label: string; vec: number[] }[] = [];
  const CONC = 6;
  const buckets: string[][] = Array.from({ length: CONC }, () => []);
  CANDIDATES.forEach((c, i) => buckets[i % CONC].push(c));
  await Promise.all(
    buckets.map(async (b) => {
      for (const label of b) {
        const vec = normalize(await embedText(label));
        labelVecs.push({ label, vec });
      }
    }),
  );

  // Report clusters by size, each labelled by nearest candidates.
  const order = Array.from({ length: K }, (_, j) => j).sort(
    (a, b) =>
      assign.filter((x) => x === b).length -
      assign.filter((x) => x === a).length,
  );
  console.log(`\n=== ${K} clusters (by size) ===`);
  for (const j of order) {
    const size = assign.filter((x) => x === j).length;
    if (!size) continue;
    const ranked = labelVecs
      .map((l) => ({ label: l.label, s: dot(centroids[j], l.vec) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 4);
    // sample face ids closest to this centroid
    const members = ids
      .map((id, i) => ({ id, i }))
      .filter((m) => assign[m.i] === j)
      .map((m) => ({ id: m.id, s: dot(pts[m.i], centroids[j]) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 5)
      .map((m) => m.id);
    console.log(
      `\n[${size}]  ${ranked.map((r) => `${r.label} (${r.s.toFixed(2)})`).join("  ·  ")}`,
    );
    console.log(`      e.g. ${members.join(" ")}`);
  }
}

main();
