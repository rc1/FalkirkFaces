import * as lancedb from "@lancedb/lancedb";
import fs from "node:fs";
import path from "node:path";
import { paths } from "../lib/paths";
import { embedText } from "../lib/embeddings";

// Corpus analysis: find the "islands" in the embedding space and measure where
// the VARIETY is. Unlike explore-clusters (emotion-only labels), this labels
// with a broad DESCRIPTIVE vocabulary (medium / era / age / role / pose /
// setting), reports per-cluster dispersion (tight = uniform, loose = varied),
// the corpus composition, and the most novel outliers. Dumps an assignment file
// for the 2D map (scripts/plot_map.py).

const K = Number(process.argv[2] || 22);
const ITERS = 30;

// Multi-axis descriptive probes — what each cluster is "about".
const VOCAB = [
  // medium / era
  "an 1840s calotype portrait", "a soft sepia photograph", "a pen-and-ink engraving",
  "a glass-plate negative portrait", "a modern colour photograph", "a black and white photograph",
  // age / sex
  "an elderly man", "an elderly woman", "a middle-aged man", "a young man",
  "a young woman", "a child", "a baby", "a teenage boy",
  // role / attire
  "a soldier in uniform", "a military officer", "a clergyman in a white collar",
  "a gentleman in a top hat", "a woman in a bonnet", "a fisherman", "a nurse",
  "a sailor", "a worker in a flat cap", "a bearded man", "a moustached man",
  "a clean-shaven man", "a person wearing spectacles", "a person in a headscarf",
  // pose / composition
  "a profile portrait", "a head-and-shoulders portrait", "a full-length figure",
  "a group of people", "two people together", "someone looking off to one side",
  "someone staring at the camera",
  // setting
  "a formal studio portrait", "an outdoor scene", "a battlefield or trench",
  "a street scene", "people indoors", "a landscape with figures",
  // tone
  "a stern dignified face", "a gentle kindly face", "a distant faraway gaze",
  "a weathered aged face", "a smiling face",
];

function normalize(v: number[]): number[] {
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n) || 1;
  return v.map((x) => x / n);
}
const dot = (a: number[], b: number[]) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
};

async function main() {
  const db = await lancedb.connect(paths.lancedb);
  const tbl = await db.openTable("faces");
  const rows = (await tbl.query().limit(100000).toArray()) as Array<{
    id: string;
    vector: number[] | Float32Array;
  }>;
  const ids = rows.map((r) => r.id);
  const pts = rows.map((r) => normalize(Array.from(r.vector)));
  console.log(`Loaded ${pts.length} face vectors\n`);

  // k-means++ (deterministic farthest-point init).
  const centroids: number[][] = [pts[0]];
  while (centroids.length < K) {
    let bi = 0,
      bd = -1;
    for (let i = 0; i < pts.length; i++) {
      const d = 1 - Math.max(...centroids.map((c) => dot(pts[i], c)));
      if (d > bd) {
        bd = d;
        bi = i;
      }
    }
    centroids.push(pts[bi]);
  }
  const assign = new Array(pts.length).fill(0);
  for (let it = 0; it < ITERS; it++) {
    for (let i = 0; i < pts.length; i++) {
      let bj = 0,
        bs = -Infinity;
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
    pts.forEach((p, i) => {
      counts[assign[i]]++;
      const s = sums[assign[i]];
      for (let d = 0; d < p.length; d++) s[d] += p[d];
    });
    for (let j = 0; j < K; j++) if (counts[j]) centroids[j] = normalize(sums[j]);
  }

  // Embed the descriptive vocabulary (same space as faces).
  console.log(`Embedding ${VOCAB.length} descriptive probes…`);
  const probes: { label: string; vec: number[] }[] = [];
  const CONC = 6;
  const buckets: string[][] = Array.from({ length: CONC }, () => []);
  VOCAB.forEach((c, i) => buckets[i % CONC].push(c));
  await Promise.all(
    buckets.map(async (b) => {
      for (const label of b) probes.push({ label, vec: normalize(await embedText(label)) });
    }),
  );
  const nearestProbe = (v: number[]) =>
    probes.reduce((best, p) => (dot(v, p.vec) > dot(v, best.vec) ? p : best)).label;

  // Corpus composition — nearest descriptive probe per face.
  const comp: Record<string, number> = {};
  pts.forEach((p) => (comp[nearestProbe(p)] = (comp[nearestProbe(p)] || 0) + 1));

  // Per-cluster: size, dispersion (1 - mean sim to centroid), top probes, examples.
  type C = { j: number; size: number; disp: number; labels: string[]; ex: string[] };
  const clusters: C[] = [];
  for (let j = 0; j < K; j++) {
    const members = ids.map((id, i) => i).filter((i) => assign[i] === j);
    if (!members.length) continue;
    const disp = 1 - members.reduce((s, i) => s + dot(pts[i], centroids[j]), 0) / members.length;
    const labels = probes
      .map((p) => ({ l: p.label, s: dot(centroids[j], p.vec) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 3)
      .map((x) => x.l);
    const ex = members
      .map((i) => ({ id: ids[i], s: dot(pts[i], centroids[j]) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 5)
      .map((x) => x.id);
    clusters.push({ j, size: members.length, disp, labels, ex });
  }

  // Outliers — faces farthest from every centroid (most singular images).
  const outliers = ids
    .map((id, i) => ({ id, far: 1 - Math.max(...centroids.map((c) => dot(pts[i], c))) }))
    .sort((a, b) => b.far - a.far)
    .slice(0, 12);

  // ---- Report ----
  console.log(`\n=== CORPUS COMPOSITION (nearest descriptive probe) ===`);
  Object.entries(comp)
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(`  ${String(v).padStart(4)}  ${k}`));

  console.log(`\n=== ${K} ISLANDS (sorted by size) ===`);
  clusters
    .sort((a, b) => b.size - a.size)
    .forEach((c) =>
      console.log(
        `[${String(c.size).padStart(3)}] disp ${c.disp.toFixed(3)}  ${c.labels.join(" · ")}\n      e.g. ${c.ex.join(" ")}`,
      ),
    );

  const avgDisp = clusters.reduce((s, c) => s + c.disp * c.size, 0) / pts.length;
  console.log(`\nMean within-cluster dispersion: ${avgDisp.toFixed(3)} (higher = more varied)`);
  console.log(`MOST VARIED islands (loosest):`);
  clusters
    .slice()
    .sort((a, b) => b.disp - a.disp)
    .slice(0, 5)
    .forEach((c) => console.log(`  disp ${c.disp.toFixed(3)} [${c.size}] ${c.labels.join(" · ")}`));

  console.log(`\nMOST SINGULAR faces (outliers — where novelty lives):`);
  outliers.forEach((o) => console.log(`  ${o.far.toFixed(3)}  ${o.id}`));

  // Dump assignment for the 2D map.
  const out = path.join(paths.data, "analysis.json");
  fs.writeFileSync(
    out,
    JSON.stringify({
      clusterOf: Object.fromEntries(ids.map((id, i) => [id, assign[i]])),
      clusterLabels: Object.fromEntries(clusters.map((c) => [c.j, c.labels[0]])),
    }),
  );
  fs.writeFileSync(path.join(paths.data, "vectors.json"), JSON.stringify({ ids, vecs: pts }));
  console.log(`\nWrote cluster assignment -> ${out} (+ vectors.json for the map)`);
}

main();
