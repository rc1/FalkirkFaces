import fs from "node:fs";
import path from "node:path";
import { paths } from "../lib/paths";

// Harvest open-access, face-bearing British art from the Yale Center for British
// Art. Two phases (kept separate so re-filtering doesn't re-harvest):
//   A. OAI-PMH (LIDO) over paintings + prints/drawings → filter to Public Domain,
//      created ≤1949, and a people/portrait subject signal. Persist the keep-list.
//   B. Resolve each kept record's IIIF manifest → download a JPEG → attribution
//      sidecar. Face detection (later, normal pipeline) is the final face filter.
// Idempotent, rate-limited, capped. Maps out of scope (this is art).

const OAI = "https://harvester-bl.britishart.yale.edu/oaicatmuseum/OAIHandler";
const SETS = ["ycba:ps", "ycba:pd"]; // paintings+sculpture, prints+drawings
const UA = "FeelingBritain/0.1 (heritage face-expression art project)";
const DELAY = 150;
const MAX_IMAGES = Number(process.env.MAX_IMAGES || 7000);
const MAX_PAGES = Number(process.env.MAX_PAGES || 0); // 0 = all (per set)
const DATE_CAP = 1949;
const IMG_SIZE = process.env.YCBA_IMG_SIZE || "!1280,1280";
const CC0 = "https://creativecommons.org/publicdomain/zero/1.0/";

// Generous people/portrait signal — face detection prunes the rest.
const PEOPLE =
  /\b(self[- ]?portrait|portrait|sitter|man|woman|men|women|child|children|boy|girl|lady|gentleman|family|figure|figures|soldier|officer|king|queen|duke|earl|countess|lord|sir|mrs|miss|nobleman|servant|peasant|head of)\b/i;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// fetch with a hard timeout — a hung connection must never stall the harvest.
async function fetchT(url: string, ms = 30000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function getText(url: string, tries = 3): Promise<string | null> {
  for (let i = 0; i < tries; i++) {
    try {
      await sleep(DELAY);
      const res = await fetchT(url);
      if (res.ok) return await res.text();
    } catch {
      /* retry */
    }
    await sleep(600 * (i + 1));
  }
  return null;
}
const first = (s: string, re: RegExp) => (s.match(re) || [])[1]?.trim();
const decode = (s = "") =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

interface Keep {
  tms: string;
  title: string;
  artist: string;
  date: string;
  manifestUrl: string;
}

function parseRecords(xml: string): { keep: Keep[]; review: string[] } {
  const keep: Keep[] = [];
  const review: string[] = [];
  for (const m of xml.matchAll(/<record>([\s\S]*?)<\/record>/g)) {
    const c = m[1];
    if (/status="deleted"/.test(c)) continue;
    const tms = first(c, /:(\d+)<\/identifier>/);
    if (!tms) continue;
    const isPD = /Public Domain/i.test(c) || /publicdomain\/zero/i.test(c);
    if (!isPD) continue;
    const years = [...c.matchAll(/<lido:latestDate>(\d{1,4})/g)].map((x) => Number(x[1]));
    const created = years.length ? Math.min(...years) : null;
    const title = decode(first(c, /<lido:titleSet[^>]*>[\s\S]*?<lido:appellationValue[^>]*>([^<]+)</) || "");
    const terms = [...c.matchAll(/<lido:term[^>]*>([^<]+)<\/lido:term>/g)].map((x) => x[1]).join(" ");
    if (!PEOPLE.test(title + " " + terms)) continue; // not a people subject
    if (created === null) {
      review.push(`${tms} no-date ${title}`);
      continue;
    }
    if (created > DATE_CAP) {
      review.push(`${tms} ${created} ${title}`);
      continue;
    }
    keep.push({
      tms,
      title,
      artist: decode(first(c, /<lido:actor[\s\S]*?<lido:appellationValue[^>]*>([^<]+)</) || ""),
      date: decode(first(c, /<lido:displayDate>([^<]+)</) || String(created)),
      manifestUrl: `https://manifests.collections.yale.edu/ycba/obj/${tms}`,
    });
  }
  return { keep, review };
}

async function discover(): Promise<Keep[]> {
  const keepPath = path.join(paths.data, "ycba-keep.json");
  if (fs.existsSync(keepPath)) {
    const k = JSON.parse(fs.readFileSync(keepPath, "utf8"));
    console.log(`Loaded ${k.length} kept records from cache`);
    return k;
  }
  const keep: Keep[] = [];
  const review: string[] = [];
  let scanned = 0;
  for (const set of SETS) {
    let url: string | null = `${OAI}?verb=ListRecords&metadataPrefix=lido&set=${set}`;
    let page = 0;
    while (url) {
      const xml = await getText(url);
      if (!xml) break;
      const r = parseRecords(xml);
      keep.push(...r.keep);
      review.push(...r.review);
      scanned += (xml.match(/<record>/g) || []).length;
      page++;
      if (page % 10 === 0)
        console.log(`  ${set}: ${page} pages, scanned ${scanned}, kept ${keep.length}`);
      if (MAX_PAGES && page >= MAX_PAGES) break;
      // Stop early once we have more than enough to fill the download cap.
      if (MAX_IMAGES && keep.length >= MAX_IMAGES * 1.15) break;
      // The token is already URL-encoded (contains %3A) — pass it through as-is.
      const tok = first(xml, /<resumptionToken[^>]*>([^<]+)<\/resumptionToken>/);
      url = tok ? `${OAI}?verb=ListRecords&resumptionToken=${tok}` : null;
    }
    console.log(`Finished ${set}: kept ${keep.length} so far`);
    if (MAX_IMAGES && keep.length >= MAX_IMAGES * 1.15) break;
  }
  fs.writeFileSync(keepPath, JSON.stringify(keep, null, 2));
  fs.writeFileSync(path.join(paths.data, "ycba-manual-review.txt"), review.join("\n"));
  console.log(`Discovery: ${keep.length} kept, ${review.length} to manual-review (scanned ${scanned})`);
  return keep;
}

async function main() {
  fs.mkdirSync(paths.source, { recursive: true });
  fs.mkdirSync(paths.data, { recursive: true });
  const keep = await discover();

  const sourcesPath = path.join(paths.data, "sources.json");
  const sources: Record<string, unknown> = fs.existsSync(sourcesPath)
    ? JSON.parse(fs.readFileSync(sourcesPath, "utf8"))
    : {};

  let got = 0;
  for (const k of keep) {
    if (got >= MAX_IMAGES) break;
    const fname = `ycba-${k.tms}.jpg`;
    const dest = path.join(paths.source, fname);
    sources[fname] = {
      institution: "Yale Center for British Art",
      label: k.title,
      rights: "Public Domain",
      rightsUrl: CC0,
      attribution: `${k.artist ? k.artist + " — " : ""}Yale Center for British Art (Public Domain)`,
      sourceUrl: k.manifestUrl,
    };
    if (fs.existsSync(dest)) {
      got++;
      continue;
    }
    const man = await getText(k.manifestUrl);
    const imgId = man && first(man, /images\.collections\.yale\.edu\/iiif\/2\/(ycba:[a-f0-9-]+)/);
    if (!imgId) continue;
    try {
      await sleep(DELAY);
      const res = await fetchT(
        `https://images.collections.yale.edu/iiif/2/${imgId}/full/${IMG_SIZE}/0/default.jpg`,
      );
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 3000) continue;
      fs.writeFileSync(dest, buf);
      got++;
      if (got % 50 === 0) {
        fs.writeFileSync(sourcesPath, JSON.stringify(sources, null, 2));
        console.log(`  downloaded ${got}/${Math.min(keep.length, MAX_IMAGES)}…`);
      }
    } catch {
      /* skip */
    }
  }
  fs.writeFileSync(sourcesPath, JSON.stringify(sources, null, 2));
  console.log(`\nYCBA: downloaded ${got} open-access images -> ${paths.source}`);
}

main();
