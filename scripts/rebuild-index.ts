import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { paths } from "../lib/paths";

// Full wipe-and-rebuild. This is the "start fresh" button.
//
//   npm run rebuild              -> wipe generated data, then scan/crop/embed
//                                   (assumes detections.json already exists)
//   npm run rebuild -- --detect  -> also run Python detection first (needs the
//                                   insightface deps available locally)
//
// In Docker the usual flow is: `docker compose run --rm detect` to produce
// detections.json, then `npm run rebuild` for the TypeScript half.

const runDetect = process.argv.includes("--detect");

function wipe() {
  for (const p of [
    paths.crops,
    paths.thumbs,
    paths.fullThumbs,
    paths.lancedb,
  ]) {
    fs.rmSync(p, { recursive: true, force: true });
    fs.mkdirSync(p, { recursive: true });
  }
  fs.rmSync(paths.manifest, { force: true });
  console.log("Wiped generated crops, thumbs, full-thumbs, lancedb, manifest.");
}

function step(name: string, cmd: string, args: string[]) {
  console.log(`\n=== ${name} ===`);
  const r = spawnSync(cmd, args, { stdio: "inherit", env: process.env });
  if (r.status !== 0) {
    console.error(`Step "${name}" failed (exit ${r.status}).`);
    process.exit(r.status ?? 1);
  }
}

wipe();
step("scan", "tsx", ["scripts/scan-images.ts"]);
if (runDetect) step("detect", "python3", ["python/detect_faces.py"]);
if (!fs.existsSync(paths.detections)) {
  console.error(
    `\nNo detections.json found. Run detection first:\n` +
      `  docker compose run --rm detect   (or: npm run rebuild -- --detect)`,
  );
  process.exit(1);
}
step("crop", "tsx", ["scripts/crop-faces.ts"]);
step("embed", "tsx", ["scripts/embed-faces.ts"]);
console.log("\nRebuild complete.");
