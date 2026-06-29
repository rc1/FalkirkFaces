import fs from "node:fs";
import path from "node:path";
import { paths } from "../lib/paths";
import { includedFaces } from "../lib/manifest";
import type { Source, SourceRef } from "../lib/types";

// Source the REAL (non-AI) catalogue context for every work that has a face on
// screen, normalised into the flexible Source shape. Per-collection adapters
// (NLS / Edinburgh = IIIF manifest metadata; YCBA = OAI-PMH LIDO). Idempotent
// (skips already-enriched works), rate-limited. The AI blurb is generated
// separately, on demand. Run: DATA_DIR=<corpus>/volumes npm run enrich

const UA = "FeelingCollections/0.1 (heritage context enrichment)";
const DELAY = 130;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchT(url: string, ms = 25000): Promise<Response | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    await sleep(DELAY);
    return await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
async function getJson(url: string) {
  const r = await fetchT(url);
  if (!r?.ok) return null;
  try {
    return await r.json();
  } catch {
    return null;
  }
}
async function getText(url: string) {
  const r = await fetchT(url);
  return r?.ok ? await r.text() : null;
}
const clean = (s = "") =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
const first = (s: string, re: RegExp) => clean((s.match(re) || [])[1] || "") || null;
const all = (s: string, re: RegExp) => [...s.matchAll(re)].map((m) => clean(m[1])).filter(Boolean);

// Flatten a IIIF (v2/v3) metadata value to a string.
function iiifStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return clean(v);
  if (Array.isArray(v)) return v.map(iiifStr).filter(Boolean).join("; ");
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("@value" in o) return clean(String(o["@value"]));
    // language map { en: ["..."] }
    const vals = Object.values(o)[0];
    return iiifStr(vals);
  }
  return clean(String(v));
}

// --- IIIF manifest adapter (NLS, Edinburgh) ---
async function fromManifest(manifestUrl: string): Promise<Partial<Source>> {
  const m = await getJson(manifestUrl);
  if (!m) return {};
  const meta: Record<string, string> = {};
  for (const e of m.metadata || []) {
    const label = iiifStr(e.label);
    const value = iiifStr(e.value);
    if (label && value) meta[label] = value;
  }
  const pick = (...keys: string[]) => {
    for (const k of Object.keys(meta))
      if (keys.some((q) => k.toLowerCase().includes(q))) return meta[k];
    return null;
  };
  const refs: SourceRef[] = [];
  const related = m.related?.["@id"] || (Array.isArray(m.related) ? m.related[0]?.["@id"] : m.related);
  if (typeof related === "string") refs.push({ label: "Catalogue record", url: related });
  return {
    creator: pick("creator", "artist", "photographer", "maker") || null,
    date: pick("date", "created") || null,
    medium: pick("medium", "material", "technique") || null,
    classification: pick("type", "format", "genre") || null,
    description: iiifStr(m.description) || pick("description", "summary", "note") || null,
    subjects: pick("subject", "keyword") ? [pick("subject", "keyword")!] : [],
    creditLine: pick("credit", "provenance", "acknowledg") || null,
    sourceUrl: typeof related === "string" ? related : undefined,
    references: refs,
    extra: meta,
  };
}

// --- LIDO adapter (YCBA via OAI-PMH GetRecord) ---
async function fromYcba(tms: string): Promise<Partial<Source>> {
  const url = `https://harvester-bl.britishart.yale.edu/oaicatmuseum/OAIHandler?verb=GetRecord&metadataPrefix=lido&identifier=oai:tms.ycba.yale.edu:${tms}`;
  const c = await getText(url);
  if (!c) return {};
  const extra: Record<string, string> = {};
  const dims = first(c, /<lido:displayObjectMeasurements>([^<]+)</);
  if (dims) extra.dimensions = dims;
  const link =
    first(c, /<lido:recordInfoLink[^>]*>([^<]+)</) ||
    `https://collections.britishart.yale.edu/catalog/tms:${tms}`;
  return {
    creator: first(c, /<lido:actor[\s\S]*?<lido:appellationValue[^>]*>([^<]+)</),
    date: first(c, /<lido:displayDate>([^<]+)</),
    classification: first(c, /<lido:objectWorkType>[\s\S]*?<lido:term[^>]*>([^<]+)</),
    medium: first(c, /<lido:displayMaterialsTech>([^<]+)</),
    creditLine: first(c, /<lido:creditLine>([^<]+)</),
    // YCBA's descriptiveNoteValue is usually exhibition/loan text, not the work's
    // own description — omit it rather than ground a blurb on the wrong thing.
    description: null,
    subjects: [...new Set(all(c, /<lido:subjectConcept>[\s\S]*?<lido:term[^>]*>([^<]+)</g))].slice(0, 8),
    sourceUrl: link,
    references: [{ label: "Catalogue record", url: link }],
    extra,
  };
}

async function main() {
  const sourcesPath = path.join(paths.data, "sources.json");
  const sources: Record<string, Source> = JSON.parse(fs.readFileSync(sourcesPath, "utf8"));
  // Only works that actually have a face on screen.
  const works = [...new Set(includedFaces().map((f) => f.sourceImageFilename))];
  let todo = works.filter((w) => sources[w] && sources[w].creator === undefined);
  const MAX = Number(process.env.ENRICH_MAX || 0);
  if (MAX) todo = todo.slice(0, MAX);
  console.log(`Enriching ${todo.length} works (of ${works.length} shown; rest already done)`);

  let done = 0;
  for (const fname of todo) {
    const s = sources[fname];
    let patch: Partial<Source> = {};
    if (fname.startsWith("ycba-")) {
      patch = await fromYcba(fname.replace(/^ycba-|\.jpg$/g, ""));
    } else if (s.sourceUrl) {
      patch = await fromManifest(s.sourceUrl); // nls / edi manifests
    }
    // Maker we already captured lives in `attribution` as "Name — Institution".
    const fromAttr = s.attribution?.includes(" — ")
      ? s.attribution.split(" — ")[0].trim()
      : null;
    // Merge — never overwrite a non-empty existing field with null.
    sources[fname] = {
      ...s,
      creator: patch.creator ?? fromAttr ?? null,
      date: patch.date ?? null,
      medium: patch.medium ?? null,
      classification: patch.classification ?? null,
      description: patch.description ?? null,
      subjects: patch.subjects?.length ? patch.subjects : [],
      creditLine: patch.creditLine ?? null,
      references: patch.references ?? [],
      extra: patch.extra ?? {},
      sourceUrl: patch.sourceUrl ?? s.sourceUrl,
    };
    if (++done % 50 === 0) {
      fs.writeFileSync(sourcesPath, JSON.stringify(sources, null, 2));
      console.log(`  enriched ${done}/${todo.length}`);
    }
  }
  fs.writeFileSync(sourcesPath, JSON.stringify(sources, null, 2));
  console.log(`Enriched ${done} works -> ${sourcesPath}`);
}

main();
