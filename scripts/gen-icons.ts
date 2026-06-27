import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

// Generate PWA icons from one striking face crop. Output PNGs land in
// public/icons and are committed (no runtime dependency on the crop). Re-run
// with `npm run gen-icons` if you want a different source face.
const SRC = process.argv[2] || "volumes/crops/8aec2121e9709071.jpg";
const OUT = process.env.ICON_OUT || "public/icons";
const BG = { r: 8, g: 8, b: 10, alpha: 1 }; // app background #08080a

async function full(size: number, name: string) {
  await sharp(SRC)
    .resize(size, size, { fit: "cover", position: "attention" })
    .png()
    .toFile(path.join(OUT, name));
}

// Maskable: keep the face inside the central safe zone so circular/squircle
// masks don't clip it.
async function maskable(size: number, name: string) {
  const inner = Math.round(size * 0.8);
  const face = await sharp(SRC)
    .resize(inner, inner, { fit: "cover", position: "attention" })
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: face, gravity: "center" }])
    .png()
    .toFile(path.join(OUT, name));
}

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`Source crop not found: ${SRC}`);
    process.exit(1);
  }
  fs.mkdirSync(OUT, { recursive: true });
  await full(192, "icon-192.png");
  await full(512, "icon-512.png");
  await maskable(512, "icon-512-maskable.png");
  await full(180, "apple-touch-icon.png"); // iOS home screen
  await full(32, "favicon-32.png");
  console.log(`Wrote PWA icons -> ${OUT}/ (from ${SRC})`);
}

main();
