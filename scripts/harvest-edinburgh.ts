import fs from "node:fs";
import path from "node:path";
import { paths } from "../lib/paths";

// Harvest CC-BY portrait photography from the University of Edinburgh's LUNA
// image system (images.is.ed.ac.uk). Dedicated portrait collections — the
// pioneering Hill & Adamson calotypes and the Thomson-Walker portraits — are
// all CC BY 3.0 and served as direct IIIF JPEGs. Licence is checked per object.
// Appends to the same corpus + attribution sidecar as the NLS harvest.

const UA = "FeelingScotland/0.1 (heritage face-expression art project)";
const DELAY_MS = 150;
const IMG_SIZE = process.env.NLS_IMG_SIZE || "!1280,1280";
const BASE = "https://images.is.ed.ac.uk/luna/servlet";

// Face-rich, CC-BY collections (LUNA `lc` namespace → label). The first two are
// dedicated portraits; the big mixed one is portrait-filtered via a query.
const COLLECTIONS = [
  { lc: "UoEcar~4~4", q: "", name: "Hill & Adamson" },
  { lc: "UoEsha~2~2", q: "", name: "Thomson-Walker portraits" },
  { lc: "UoEgal~4~4", q: "portrait", name: "People, Places and Events" },
];
const PER_COLLECTION_CAP = Number(process.env.EDI_CAP || 1500);

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
    await sleep(400 * (i + 1));
  }
  return null;
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// fieldValues is [{Licence:[...]}, {Title:[...]}, {Creator:[...]}, ...]
function fields(r: any): Record<string, string> {
  const out: Record<string, string> = {};
  for (const obj of r.fieldValues || []) {
    const k = Object.keys(obj)[0];
    if (k) out[k] = stripHtml([].concat(obj[k]).join(" "));
  }
  // Licence raw (keep HTML to read the href)
  for (const obj of r.fieldValues || []) {
    if (obj.Licence) out._licenceRaw = [].concat(obj.Licence).join(" ");
  }
  return out;
}

async function main() {
  fs.mkdirSync(paths.source, { recursive: true });
  fs.mkdirSync(paths.data, { recursive: true });
  const sourcesPath = path.join(paths.data, "sources.json");
  const sources: Record<string, unknown> = fs.existsSync(sourcesPath)
    ? JSON.parse(fs.readFileSync(sourcesPath, "utf8"))
    : {};

  let kept = 0;
  for (const col of COLLECTIONS) {
    const qp = col.q ? `&q=${encodeURIComponent(col.q)}` : "&q=";
    const first = await getJson(`${BASE}/as/search?bs=1&os=0&lc=${col.lc}&fullData=true${qp}`);
    const total = Math.min(first?.totalResults || 0, PER_COLLECTION_CAP);
    console.log(`${col.name} (${col.lc}): ${first?.totalResults || 0} items, taking up to ${total}`);

    for (let os = 0; os < total; os += 100) {
      const page = await getJson(`${BASE}/as/search?bs=100&os=${os}&lc=${col.lc}&fullData=true${qp}`);
      for (const r of page?.results || []) {
        if (os >= total) break;
        const f = fields(r);
        const lic = f._licenceRaw || "";
        const m = lic.match(/creativecommons\.org\/licenses\/by\/[\d.]+/);
        if (!m) continue; // CC BY only
        const id = r.id;
        if (!id) continue;
        const fname = "edi-" + String(id).replace(/[^\w.\-]+/g, "_") + ".jpg";
        const dest = path.join(paths.source, fname);
        sources[fname] = {
          institution: "University of Edinburgh",
          label: f.Title || col.name,
          rights: "CC BY 3.0",
          rightsUrl: "https://creativecommons.org/licenses/by/3.0/",
          attribution: `${f.Creator ? f.Creator + " — " : ""}University of Edinburgh (CC BY 3.0)`,
          sourceUrl: r.iiifManifest || `${BASE}/detail/${id}`,
        };
        if (fs.existsSync(dest)) {
          kept++;
          continue;
        }
        try {
          await sleep(DELAY_MS);
          const res = await fetch(`${BASE}/iiif/${id}/full/${IMG_SIZE}/0/default.jpg`, {
            headers: { "User-Agent": UA },
          });
          if (!res.ok) continue;
          const buf = Buffer.from(await res.arrayBuffer());
          if (buf.length < 3000) continue;
          fs.writeFileSync(dest, buf);
          kept++;
          if (kept % 50 === 0) {
            fs.writeFileSync(sourcesPath, JSON.stringify(sources, null, 2));
            console.log(`  downloaded ${kept}…`);
          }
        } catch {
          /* skip */
        }
      }
    }
  }
  fs.writeFileSync(sourcesPath, JSON.stringify(sources, null, 2));
  console.log(`\nEdinburgh: downloaded ${kept} CC-BY images -> ${paths.source}`);
}

main();
