import fs from "node:fs";
import path from "node:path";
import { paths } from "../lib/paths";
import { config } from "../lib/config";
import {
  clampBox,
  cropFace,
  faceId,
  makeThumb,
  sourceId,
} from "../lib/images";
import { writeManifest } from "../lib/manifest";
import type { ExcludeReason, Face } from "../lib/types";

// Step 3: turn raw detections into faces. Apply thresholds, crop included
// faces, generate thumbnails, and write the manifest. Excluded faces are kept
// (with a reason) so thresholds can be re-tuned later without re-detecting.

interface DetFace {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}
interface DetImage {
  filename: string;
  width: number;
  height: number;
  faces: DetFace[];
}

async function main() {
  if (!fs.existsSync(paths.detections)) {
    console.error(
      `No detections.json — run face detection first (npm run detect).`,
    );
    process.exit(1);
  }
  const { detector, images } = JSON.parse(
    fs.readFileSync(paths.detections, "utf8"),
  ) as { detector: string; images: DetImage[] };

  for (const dir of [paths.crops, paths.thumbs, paths.fullThumbs]) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const now = new Date().toISOString();
  const faces: Face[] = [];
  let included = 0;
  const fullDone = new Set<string>();

  for (const img of images) {
    const source = path.join(paths.source, img.filename);
    if (!fs.existsSync(source)) continue;

    // One shared full-image thumbnail per source image (for the zoom-out view).
    const sid = sourceId(img.filename);
    const fullRel = path.join("full-thumbs", `${sid}.jpg`);
    if (!fullDone.has(sid)) {
      try {
        await makeThumb(
          source,
          path.join(paths.data, fullRel),
          config.fullThumbMax,
        );
      } catch {
        /* leave it; detail view falls back to the crop */
      }
      fullDone.add(sid);
    }

    for (const d of img.faces) {
      const rawBox = { x: d.x, y: d.y, width: d.width, height: d.height };
      const id = faceId(img.filename, rawBox);

      // Decide inclusion before doing expensive work.
      let reason: ExcludeReason = null;
      if (d.confidence < config.minDetectorConfidence) reason = "low_confidence";
      else if (d.width < config.minFaceWidth || d.height < config.minFaceHeight)
        reason = "too_small";

      const face: Face = {
        id,
        sourceImagePath: img.filename,
        sourceImageFilename: img.filename,
        sourceImageWidth: img.width,
        sourceImageHeight: img.height,
        bbox: rawBox,
        cropPath: null,
        thumbPath: null,
        fullThumbPath: fullRel,
        cropWidth: null,
        cropHeight: null,
        included: false,
        excludeReason: reason,
        detector,
        detectorConfidence: d.confidence,
        caption: null,
        expressionLabel: null,
        embedding: null,
        createdAt: now,
      };

      if (!reason) {
        const box = clampBox(rawBox, img.width, img.height);
        const cropRel = path.join("crops", `${id}.jpg`);
        const thumbRel = path.join("thumbs", `${id}.jpg`);
        try {
          const { width, height } = await cropFace(
            source,
            box,
            path.join(paths.data, cropRel),
          );
          await makeThumb(
            path.join(paths.data, cropRel),
            path.join(paths.data, thumbRel),
            config.thumbSize,
          );
          face.cropPath = cropRel;
          face.thumbPath = thumbRel;
          face.cropWidth = width;
          face.cropHeight = height;
          face.included = true;
          included++;
        } catch {
          face.excludeReason = "crop_failed";
        }
      }

      faces.push(face);
    }
  }

  writeManifest(faces);
  console.log(
    `Cropped ${included} included faces (${faces.length} total) -> ${paths.manifest}`,
  );
}

main();
