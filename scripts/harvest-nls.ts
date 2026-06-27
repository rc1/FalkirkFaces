import fs from "node:fs";
import path from "node:path";
import { paths } from "../lib/paths";

// Harvest openly-licensed photographs (that may contain faces) from the National
// Library of Scotland via its open IIIF API. Metadata-first + licence-gated:
// crawl collections -> read each manifest's rights -> keep only PD / No-Known-
// Copyright / CC-BY -> download images at a modest size -> write an attribution
// sidecar. Face detection happens later in the normal pipeline (detect/crop).
// Maps are out of scope and not seeded. Be a good citizen: rate-limited, polite
// UA, idempotent (skips already-downloaded), global cap.

const UA =
  "FeelingScotland/0.1 (heritage face-expression art project; respectful IIIF harvest)";
const DELAY_MS = 200; // between network calls
const MAX_IMAGES = Number(process.env.MAX_IMAGES || 4000);
const IMG_SIZE = process.env.NLS_IMG_SIZE || "!1280,1280";

// Verified openly-licensed people-photography entry points (collections or
// single manifests). Collections are recursed; manifests harvested directly.
const SEEDS = [
  "https://view.nls.uk/collections/7446/74462370.json", // WWI 'Official Photographs' (CC BY)
  "https://view.nls.uk/collections/1166/7613/116676134.json", // Isabella Bird (Public Domain)
  "https://view.nls.uk/manifest/7445/74457611/manifest.json", // Edinburgh south side (CC BY)
  "https://view.nls.uk/manifest/2029/4411/202944114/manifest.json", // MacKinnon album (NKC)
];
// Also crawl the top collection for any other photography/portrait collections.
const TOP = "https://view.nls.uk/collections/top.json";
const PHOTO_LABEL = /photograph|portrait|people|album|war|life|faces?/i;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJson(url: string, tries = 3): Promise<any> {
  for (let i = 0; i < tries; i++) {
    try {
      await sleep(DELAY_MS);
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
      if (res.ok) return await res.json();
    } catch {
      /* retry */
    }
    await sleep(500 * (i + 1));
  }
  return null;
}

function asText(v: unknown): string {
  if (Array.isArray(v)) return v.map(asText).join(" ");
  if (v && typeof v === "object") return String((v as any)["@value"] ?? "");
  return v == null ? "" : String(v);
}

// Classify rights from the attribution HTML. Returns null if not clearly open.
function classifyRights(attr: string): { rights: string; rightsUrl: string } | null {
  const urls = [...attr.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  for (const u of urls) {
    if (/creativecommons\.org\/publicdomain\/(mark|zero)/i.test(u))
      return { rights: "Public Domain", rightsUrl: u };
    if (/rightsstatements\.org\/vocab\/NKC/i.test(u))
      return { rights: "No Known Copyright", rightsUrl: u };
    if (/creativecommons\.org\/licenses\/by\//i.test(u))
      return { rights: "CC BY 4.0", rightsUrl: u };
  }
  return null; // in-copyright / unknown -> skip
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// Recurse a IIIF collection, collecting manifest URLs.
async function collectManifests(url: string, out: Set<string>, seen: Set<string>, depth = 0) {
  if (seen.has(url) || depth > 4) return;
  seen.add(url);
  const j = await getJson(url);
  if (!j) return;
  const type = asText(j["@type"]);
  if (/Manifest/i.test(type)) {
    out.add(url);
    return;
  }
  for (const m of j.manifests || []) {
    const id = m["@id"];
    if (id) out.add(id);
  }
  for (const c of j.collections || []) {
    const id = c["@id"];
    if (id) await collectManifests(id, out, seen, depth + 1);
  }
}

async function main() {
  const SRC = paths.source;
  fs.mkdirSync(SRC, { recursive: true });
  fs.mkdirSync(paths.data, { recursive: true });
  const sourcesPath = path.join(paths.data, "sources.json");
  const sources: Record<string, unknown> = fs.existsSync(sourcesPath)
    ? JSON.parse(fs.readFileSync(sourcesPath, "utf8"))
    : {};

  // 1. Gather manifest URLs from seeds + photography collections in top.json.
  const manifests = new Set<string>();
  const seen = new Set<string>();
  for (const s of SEEDS) await collectManifests(s, manifests, seen);
  const top = await getJson(TOP);
  for (const c of top?.collections || []) {
    if (PHOTO_LABEL.test(asText(c.label)) && c["@id"])
      await collectManifests(c["@id"], manifests, seen);
  }
  console.log(`Found ${manifests.size} candidate manifests`);

  // 2. For each manifest: licence-gate, then download face-candidate images.
  let kept = 0;
  let skippedRights = 0;
  const skipReasons: Record<string, number> = {};
  for (const mUrl of manifests) {
    if (kept >= MAX_IMAGES) break;
    const man = await getJson(mUrl);
    if (!man) continue;
    const attr = asText(man.attribution);
    const r = classifyRights(attr);
    if (!r) {
      skippedRights++;
      continue;
    }
    const label = stripHtml(asText(man.label));
    const sourceUrl = asText(man.related?.[0]?.["@id"] || man.related?.["@id"] || man["@id"]);
    const attribution = stripHtml(attr);

    const canvases = man.sequences?.[0]?.canvases || [];
    for (const cv of canvases) {
      if (kept >= MAX_IMAGES) break;
      const svc = cv.images?.[0]?.resource?.service?.["@id"];
      if (!svc) continue;
      const imgId = svc.split("/iiif/2/")[1] || svc.split("/").pop();
      const fname = "nls-" + decodeURIComponent(imgId).replace(/[^\w.\-]+/g, "_") + ".jpg";
      const dest = path.join(SRC, fname);
      sources[fname] = { label, manifestUrl: mUrl, rights: r.rights, rightsUrl: r.rightsUrl, attribution, sourceUrl };
      if (fs.existsSync(dest)) {
        kept++;
        continue;
      }
      try {
        await sleep(DELAY_MS);
        const res = await fetch(`${svc}/full/${IMG_SIZE}/0/default.jpg`, {
          headers: { "User-Agent": UA },
        });
        if (!res.ok) {
          skipReasons[`http_${res.status}`] = (skipReasons[`http_${res.status}`] || 0) + 1;
          continue;
        }
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 3000) {
          skipReasons.tiny = (skipReasons.tiny || 0) + 1;
          continue;
        }
        fs.writeFileSync(dest, buf);
        kept++;
        if (kept % 50 === 0) {
          fs.writeFileSync(sourcesPath, JSON.stringify(sources, null, 2));
          console.log(`  downloaded ${kept} images…`);
        }
      } catch {
        skipReasons.fetch_error = (skipReasons.fetch_error || 0) + 1;
      }
    }
  }

  fs.writeFileSync(sourcesPath, JSON.stringify(sources, null, 2));
  console.log(
    `\nDownloaded ${kept} openly-licensed images to ${SRC}\n` +
      `Skipped ${skippedRights} manifests on rights. Image skips: ${JSON.stringify(skipReasons)}\n` +
      `Attribution sidecar -> ${sourcesPath}`,
  );
}

main();
