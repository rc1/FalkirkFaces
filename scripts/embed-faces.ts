import path from "node:path";
import { paths } from "../lib/paths";
import { config } from "../lib/config";
import { embedImageFile } from "../lib/embeddings";
import { readManifest, writeManifest, includedFaces } from "../lib/manifest";
import { rebuildTable, type VectorRow } from "../lib/db";

// Step 4: embed every included face crop with Gemini Embedding 2 and rebuild the
// LanceDB index. Faces that fail to embed get marked excluded in the manifest.
// Small concurrency so we don't hammer the API.

const CONCURRENCY = 6;

async function main() {
  const all = readManifest();
  const todo = includedFaces(all);
  if (todo.length === 0) {
    console.error("No included faces in manifest — run npm run crop first.");
    process.exit(1);
  }
  console.log(
    `Embedding ${todo.length} face crops with ${config.embedModel} (dim ${config.embedDim})`,
  );

  const rows: VectorRow[] = [];
  const failed = new Set<string>();
  let done = 0;

  async function worker(slice: typeof todo) {
    for (const f of slice) {
      try {
        const vector = await embedImageFile(
          path.join(paths.data, f.cropPath!),
        );
        rows.push({ id: f.id, vector });
      } catch (err) {
        failed.add(f.id);
        console.error(`  ! embed failed for ${f.id}: ${(err as Error).message}`);
      }
      if (++done % 25 === 0 || done === todo.length) {
        console.log(`  ${done}/${todo.length} embedded`);
      }
    }
  }

  // Round-robin the work across N workers.
  const buckets: (typeof todo)[] = Array.from({ length: CONCURRENCY }, () => []);
  todo.forEach((f, i) => buckets[i % CONCURRENCY].push(f));
  await Promise.all(buckets.map(worker));

  await rebuildTable(rows);

  // Reflect embedding failures back into the manifest.
  if (failed.size) {
    for (const f of all) {
      if (failed.has(f.id)) {
        f.included = false;
        f.excludeReason = "embedding_failed";
      }
    }
    writeManifest(all);
  }

  console.log(
    `Indexed ${rows.length} vectors into LanceDB (${failed.size} failed) -> ${paths.lancedb}`,
  );
}

main();
