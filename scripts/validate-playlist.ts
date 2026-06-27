import * as lancedb from "@lancedb/lancedb";
import { paths } from "../lib/paths";
import { embedText } from "../lib/embeddings";
import { PLAYLISTS } from "../lib/playlist";

// Validate a playlist against the actual embedding space: does each phrase
// (a) land strongly (discriminate faces, not flat), and (b) pull a DISTINCT set
// from the others (not redundant)? Reports per-phrase strength + the redundant
// pairs (high top-K overlap = same island).

const CORPUS = process.argv[2] || "falkirk";
const TOPK = 30;

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
  const playlist = PLAYLISTS[CORPUS];
  if (!playlist) throw new Error(`no playlist for "${CORPUS}"`);
  const db = await lancedb.connect(paths.lancedb);
  const tbl = await db.openTable("faces");
  const rows = (await tbl.query().limit(100000).toArray()) as Array<{
    id: string;
    vector: number[] | Float32Array;
  }>;
  const ids = rows.map((r) => r.id);
  const F = rows.map((r) => norm(Array.from(r.vector)));
  console.log(`Validating "${CORPUS}" playlist (${playlist.length} phrases) against ${F.length} faces\n`);

  // Embed phrases, score every face, capture strength + top-K set.
  const items: { phrase: string; strength: number; topMean: number; set: Set<string>; top2: string[] }[] = [];
  for (const phrase of playlist) {
    const e = norm(await embedText(phrase));
    const sims = F.map((f) => dot(f, e));
    const ranked = sims
      .map((s, i) => ({ s, i }))
      .sort((a, b) => b.s - a.s);
    const top = ranked.slice(0, TOPK);
    items.push({
      phrase,
      strength: std(sims), // how much it separates faces
      topMean: mean(top.map((t) => t.s)),
      set: new Set(top.map((t) => ids[t.i])),
      top2: top.slice(0, 2).map((t) => ids[t.i]),
    });
  }

  // Strength ranking (relative to the playlist).
  const byStrength = [...items].sort((a, b) => b.strength - a.strength);
  const medStrength = byStrength[Math.floor(items.length / 2)].strength;
  console.log(`=== PER-PHRASE STRENGTH (does it discriminate? — std of sims) ===`);
  byStrength.forEach((it) => {
    const flag = it.strength < medStrength * 0.8 ? "  <- WEAK/flat" : "";
    console.log(`  ${(it.strength * 1000).toFixed(2)}  ${it.phrase.padEnd(22)} e.g. ${it.top2.join(" ")}${flag}`);
  });

  // Redundancy: pairwise top-K overlap.
  console.log(`\n=== REDUNDANT PAIRS (top-${TOPK} overlap — same island) ===`);
  const pairs: { a: string; b: string; j: number }[] = [];
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++)
      pairs.push({ a: items[i].phrase, b: items[j].phrase, j: jaccard(items[i].set, items[j].set) });
  const redundant = pairs.filter((p) => p.j > 0.25).sort((a, b) => b.j - a.j);
  if (!redundant.length) console.log("  (none above 0.25 — phrases pull distinct sets)");
  redundant.forEach((p) => console.log(`  ${p.j.toFixed(2)}  ${p.a}  ~  ${p.b}`));

  const avgJ = mean(pairs.map((p) => p.j));
  console.log(`\nMean pairwise overlap: ${avgJ.toFixed(3)} (lower = more distinct spread)`);

  // Optionally score candidate replacements: strong + distinct from the playlist?
  const cands = (process.env.CANDIDATES || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (cands.length) {
    console.log(`\n=== CANDIDATES (strength + max overlap vs playlist) ===`);
    for (const phrase of cands) {
      const e = norm(await embedText(phrase));
      const sims = F.map((f) => dot(f, e));
      const top = sims.map((s, i) => ({ s, i })).sort((a, b) => b.s - a.s).slice(0, TOPK);
      const set = new Set(top.map((t) => ids[t.i]));
      const maxOv = Math.max(...items.map((it) => jaccard(set, it.set)));
      const worst = items.reduce((w, it) => (jaccard(set, it.set) > jaccard(set, w.set) ? it : w)).phrase;
      console.log(
        `  str ${(std(sims) * 1000).toFixed(1)}  maxOverlap ${maxOv.toFixed(2)} (vs "${worst}")  ${phrase}`,
      );
    }
  }
}

main();
