import fs from "node:fs";
import { paths } from "../lib/paths";
import { imageSize } from "../lib/images";

// Step 1: list the source images and record their dimensions. The detector
// globs the same folder itself, so this is mostly a sanity check + a record of
// what's in scope. Cheap and handy.

const EXTS = /\.(jpe?g|png|webp)$/i;

async function main() {
  if (!fs.existsSync(paths.source)) {
    console.error(`Source folder not found: ${paths.source}`);
    process.exit(1);
  }
  fs.mkdirSync(paths.data, { recursive: true });

  const files = fs
    .readdirSync(paths.source)
    .filter((f) => EXTS.test(f))
    .sort();

  const images = [];
  for (const filename of files) {
    const { width, height } = await imageSize(`${paths.source}/${filename}`);
    images.push({ filename, width, height });
  }

  fs.writeFileSync(paths.images, JSON.stringify(images, null, 2));
  console.log(`Scanned ${images.length} images -> ${paths.images}`);
}

main();
