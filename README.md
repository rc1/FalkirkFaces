# Art Face Explorer

A lean sketchbook for exploring faces found inside a folder of images. Detect
faces → crop them → embed each crop with **Gemini Embedding 2** (natively
multimodal) → type a feeling like _"quiet sadness"_ and the closest-looking
faces surface. Click one and it expands back into the artwork it came from, with
its bounding box drawn in context.

This is a creative prototype, not production. Optimised for hacking on, not for
scale. Wipe and rebuild freely.

---

## How it works

```
photos/                      source images (already here: 307 from the Falkirk PDF)
   │
   ▼  python/detect_faces.py  (InsightFace / RetinaFace)
volumes/detections.json      raw boxes + confidence
   │
   ▼  scripts/crop-faces.ts   (sharp: threshold, crop, thumbnail)
volumes/crops, thumbs, full-thumbs, manifest.json
   │
   ▼  scripts/embed-faces.ts  (Gemini Embedding 2 → vectors)
volumes/lancedb/             one local vector table
   │
   ▼  Next.js app             grid · search · click-to-context
```

Gemini Embedding 2 maps **both** face crops and text queries into one shared
vector space, so a text query can be compared directly against face images — no
captioning step. All embedding code is isolated in
[`lib/embeddings.ts`](lib/embeddings.ts) so the provider can be swapped.

---

## Setup

### 1. Prereqs

- An image folder. The repo already ships `./photos` (307 crowd shots).
- A Gemini API key: <https://aistudio.google.com/apikey>
- Either **Docker** (recommended — bundles the Python detector) or local
  Node 22 + Python 3.11.

### 2. Env

```bash
cp .env.example .env
# edit .env and set GEMINI_API_KEY
```

### 3. Build the index

**With Docker (recommended):**

```bash
docker compose run --rm detect                 # faces  -> volumes/detections.json
docker compose run --rm web npm run rebuild    # crop + embed + index
docker compose up web                          # http://localhost:3000
```

**Locally (Node + Python on your machine):**

```bash
npm install
pip install -r python/requirements.txt   # for the detector
npm run rebuild -- --detect              # detect + scan + crop + embed
npm run dev                              # http://localhost:3000
```

---

## Pipeline commands

| Command                       | What it does                                            |
| ----------------------------- | ------------------------------------------------------- |
| `npm run scan`                | List source images + dimensions → `volumes/images.json` |
| `npm run detect`              | Python face detection → `volumes/detections.json`       |
| `npm run crop`                | Threshold + crop + thumbnail → `manifest.json`          |
| `npm run embed`               | Embed crops with Gemini → LanceDB                        |
| `npm run rebuild`             | Wipe generated data, then scan → crop → embed           |
| `npm run rebuild -- --detect` | Same, but run Python detection first too                |

Order matters only the first time: **detect → crop → embed**. `rebuild` assumes
`detections.json` already exists unless you pass `--detect`.

---

## Wipe & rebuild

Everything under `volumes/` (except `detections.json`) is generated and safe to
delete:

```bash
npm run rebuild           # wipes crops/thumbs/full-thumbs/lancedb/manifest, rebuilds
# or nuke detections too and start fully fresh:
rm -rf volumes/* && docker compose run --rm detect && docker compose run --rm web npm run rebuild
```

Change a threshold in [`lib/config.ts`](lib/config.ts) (or via `.env`) and rerun
`npm run crop && npm run embed` — no need to re-detect.

---

## Tuning

[`lib/config.ts`](lib/config.ts) / `.env`:

- `MIN_FACE_WIDTH` / `MIN_FACE_HEIGHT` — default 96px. Smaller faces are kept in
  the manifest but marked `too_small`.
- `MIN_DETECTOR_CONFIDENCE` — default 0.6.
- `EMBED_MODEL` / `EMBED_DIM` — default `gemini-embedding-2`, 768 dims.

Excluded faces are **never deleted** — they stay in `manifest.json` with an
`excludeReason`, so you can lower a threshold and recover them.

---

## Project layout

```
app/            Next.js App Router — page + API routes (faces / search / image)
components/     FaceGrid, FaceTile, SearchBox, FaceDetail
lib/            paths, config, types, images (sharp), embeddings (Gemini), db (LanceDB), manifest
scripts/        scan / crop / embed / rebuild (TypeScript)
python/         detect_faces.py + its Dockerfile (InsightFace)
volumes/        all generated data (crops, thumbs, full-thumbs, lancedb, manifest.json)
photos/         source images
```

---

## Creative branches left open

The code is deliberately easy to extend. Hooks are noted in comments. Natural
next moves: _same expression / different face_, _cluster by tone_, _serendipity
mode_, _outliers_, _moodboard from a query_, _latent walk between two emotions_.
The `caption` and `expressionLabel` fields already exist on every face for a
future vision-captioning pass.

---

## Known limitations

- **Needs a Gemini API key** and network to embed. Without it, detection +
  crops + the grid still work; only search is disabled.
- **InsightFace downloads ~300MB** (`buffalo_l`) on first run; cached in
  `volumes/insightface-cache`.
- Search quality depends on the embedding model's read of expression — it's
  expressive/associative, not a trained emotion classifier.
- No auth, no accounts, single user, single machine. By design.
- The whole `volumes/` folder is disposable. Don't put anything precious there.
```
