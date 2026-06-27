# Work Journal

A running log of what was built, decided, and deployed. Newest entries appended
at the bottom. Maintained by Claude at Ross's request.

---

## 2026-06-26 — Extracting the source photos

- Extracted images from `FALKIRK MOCK UP.pdf` (a friend's photo collection laid
  out as a mockup), excluding page 1.
- First pass recomposited each image with its soft-mask into PNGs; Ross asked for
  the originals instead ("File Juicer" style), so switched to carving the raw
  embedded JPEGs straight out of the PDF — **307 images** into `photos/`, named by
  page with pixel dimensions (e.g. `page-002-2062x2062.jpeg`). No re-encoding.

## 2026-06-26 — Building "Art Face Explorer" (Falkirk Faces)

- Built a lean Next.js (App Router, TS) prototype per a detailed handoff spec:
  scan a folder → detect faces → crop → embed → search faces by **expression**.
- Stack: Next.js, LanceDB (local vectors), Sharp, InsightFace (Python) for
  detection, **Gemini Embedding 2** for embeddings, Docker Compose.
- Key research finding: **Gemini Embedding 2 is natively multimodal** — embeds
  images AND text into one shared space, so a text query ("quiet sadness")
  compares directly against face crops. No captioning step. (768-dim.)
- No Docker locally → ran detection in a Python 3.13 `.venv` (InsightFace).
  Pipeline result: 5,991 faces detected → **945** kept (96px / 0.6-confidence
  thresholds) → embedded into LanceDB.
- Verified search quality: "furious" → a screaming child, "soft smile" → a grin.

## 2026-06-26 — UI iterations (Falkirk)

- Full-bleed **square mosaic**; floating search pill; **radial bloom** so the best
  match lands dead-centre and results spiral outward by similarity.
- Removed input placeholder; removed borders; tighter/larger input over several
  passes; auto-sizing input (text-measuring, not `ch`).
- **Click-to-zoom**: clicking a tile fades the others out (furthest-first wave),
  then the photo zooms seamlessly from the tile to the full source image (no
  bbox). Later reworked as a **clipped window** so it sits exactly in the tile's
  spot and lingers there (`hold @ cell`) before expanding — fixes the "doesn't
  connect" feel. Image fades in/out as part of the zoom; grid cross-fades back.
- **Local autocomplete** over 800 generated expression phrases.
- **Fullscreen** + **play** buttons. Play-cycle types an expression, searches,
  holds, advances. Clicking an image stops play.
- **Hidden debug panel** (backtick / `?debug` / 4 corner-taps) to live-tweak grid
  density, face zoom, zoom/fade/dismiss timings, bloom step, play hold, vignette.
- **Center vignette** — edges fade to draw the eye inward.
- Roomier crops: switched to a **square, face-centred crop** with `CROP_MARGIN`
  (the square tiles were cropping the margin back off). Tuned 0.3 → 0.15.
- Cache-bust image URLs with the manifest mtime so regenerated crops show at once.
- **Embedding cache** (in-memory + `volumes/embed-cache.json`) for text queries.

## 2026-06-26 — Deploy (Falkirk)

- Discovered the deploy pattern: Hetzner box (`ssh hetzner`, IP 128.140.73.211),
  apps as `docker-<name>` stacks under `/home/ross/datadrive/`, shared Traefik v2
  on the external `web` network, `lets-encrypt` certresolver, wildcard
  `*.electricglen.com` DNS.
- Deployed **https://falkirkfaces.electricglen.com**, basic-auth gated
  (`cellardyke`/`cellardyke`). Pushed to `git@github.com:rc1/FalkirkFaces.git`.
- Data (photos + generated index) rsync'd, not committed; app bind-mounts them.
- Made it an installable **PWA** (manifest, service worker, icons, Apple meta).
- Tweaks: fullscreen moved left of input; domain `falkirkface` → `falkirkfaces`;
  monochrome handled later. Removed the filename hover tooltip.

## 2026-06-27 — Multi-corpus switch

- Asked for "a switch for different data" — clarified as a **code/project switch**
  (env per deployment), not a runtime UI toggle.
- `APP_NAME`/`APP_TAGLINE` drive branding, **baked at build time** (Next evaluates
  metadata during build → passed as docker build args). `docker-compose.prod.yml`
  parameterised (`PROJECT_NAME`/`APP_DOMAIN`/`APP_NAME`), one file serves both
  stacks; Falkirk defaults preserved.

## 2026-06-27 — Sourcing "Feeling Scotland" (NLS)

- Ross wanted a second corpus of openly-licensed Scottish heritage faces.
- Research: NLS open IIIF API (`view.nls.uk` collections/manifests, `dg-view.nls.uk`
  images); rights in manifest `attribution`. Only ~4 open people-photo collections.
- Built `scripts/harvest-nls.ts` — licence-gated (PD / No-Known-Copyright / CC-BY
  only), attribution sidecar, polite/rate-limited. Harvested **3,000** images.

## 2026-06-27 — Other open Scottish collections (research)

- Honest finding: the openly-licensed Scottish material is **almost all
  photography**. Painting/sculpture institutions (National Galleries / Portrait
  Gallery, Glasgow Hunterian) lock even public-domain works behind
  personal/non-commercial terms → unusable.
- Open + harvestable: **Univ. of Edinburgh** (CC BY, clean IIIF — Hill & Adamson
  calotypes), **Univ. of Aberdeen** (CC BY, ~36k GWW portraits, but JP2 transcode
  needed), Europeana (adjunct). See `memory/scottish-open-collections.md`.
- Built `scripts/harvest-edinburgh.ts` — **1,139** CC-BY portrait calotypes.

## 2026-06-27 — Feeling Scotland pipeline + deploy

- Combined corpus: **4,139 images** (3,000 NLS + 1,139 Edinburgh), each with
  institution-level provenance shown in the zoom view (`Source` type).
- Detection across all 4,139 → 15,833 faces → **1,705** kept (lowered min face to
  64px for smaller/softer historical faces) → embedded.
- Per-corpus **monochrome** flag (`APP_MONOCHROME`, CSS `grayscale(1)`) for the
  mixed sepia/tone heritage imagery; Falkirk unaffected.
- Deployed **https://feelingscotland.electricglen.com** (gated, same creds), stack
  `/home/ross/datadrive/docker-feelingscotland/`.

## 2026-06-27 — Corpus analysis (content vs feeling)

- Per-corpus **play-cycle playlists** via `/api/playlist` (`APP_CORPUS`).
- First analysis (`scripts/analyze-corpus.ts`) clustered embeddings + labelled by
  a **descriptive** vocabulary → revealed the dataset's **content** structure
  (574 calotype portraits, 171 engravings, soldiers, women in bonnets, …) and a
  2D t-SNE map (`python/plot_map.py`).
- Ross's correction: that conflates content with emotion. Built
  `scripts/analyze-emotions.ts` — probe with a 155-word feeling lexicon,
  **double-centre** out the content baseline, rank discriminating feelings, find
  synonym islands, pick a max-spread playlist. Validated exemplars visually.
- Rebuilt the Feeling Scotland playlist from that (distinct feelings that
  genuinely separate faces here).

## 2026-06-27 — Started this journal

- Ross asked for a running journal of the work. Created this file; will append an
  entry per significant task going forward. (See `memory/journal-habit.md`.)

## 2026-06-27 — Falkirk playlist + autoplay + per-stack auth

- Ran the emotion analysis on the Falkirk corpus too; reported the proposed
  playlist first. Ross wanted it more **fan-relatable** (not clinical — "nobody
  wants their face under 'menace'"). Reframed around the supporter's emotional
  rollercoaster: pure joy · ecstasy · disbelief · agony · elation · heartbreak ·
  outrage · triumph · anticipation · delight · despair · relief · pride · awe ·
  tension · determination · shock · lost in the moment.
- **Auto-play on load**: the play-cycle now auto-starts ~7s after load (yields if
  the visitor types/clicks/hits play first). The "Enter an expression" hint stays
  up longer (7s) to match.
- **Per-stack auth** via `AUTH_MW`: **Feeling Scotland is now public** (the images
  are openly licensed) while **Falkirk stays password-gated** (a friend's private
  photos). Both redeployed. Note: the Falkirk redeploy needed an old-container
  removal because the compose service was renamed `falkirkface` → `app`.
