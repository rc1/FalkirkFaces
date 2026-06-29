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

## 2026-06-27 — Validated + rebuilt both playlists (not guessed)

- Ross asked whether the Falkirk playlist actually mapped to the embedding-space
  islands or was a guess. Honest answer: I'd guessed the fan-friendly rephrasing.
- Built `scripts/validate-playlist.ts` (per-phrase strength + pairwise top-K
  overlap + candidate scoring) and `scripts/build-playlist.ts` (greedy
  max-distinct selection from a corpus-appropriate pool — Falkirk pool kept
  flattering, Scotland pool left broad).
- Rebuilt BOTH playlists from the data and re-validated independently: no
  redundant pairs; mean top-K overlap 0.067 (Falkirk) / 0.033 (Scotland).
- Falkirk: pure joy · ecstasy · triumph · astonishment · anticipation · suspense ·
  nerves · tension · indignation · fury · despair · resignation · longing · relief ·
  passion · determination · rapt attention · lost in the moment.
- Scotland: pensiveness · dreaminess · contemplation · a haunted look · solemnity ·
  gravity · stoicism · sternness · austerity · disdain · indignation · fury · terror ·
  defiance · resolve · weariness · vacancy · gentleness.

## 2026-06-27 — Webcam search (both sites)

- Added a **camera button**: replaces the input with a small rounded webcam
  window, the play button becomes a stop button, and every 10s it captures a
  frame and searches the corpus for the most similar faces.
- `/api/search-image` embeds an image (webcam frame) via Gemini and runs the same
  LanceDB nearest-neighbour search. `embedImageBytes()` added. Deployed to both.

## 2026-06-27 — YCBA "Feeling Britain" corpus (in progress)

- New corpus from the Yale Center for British Art (open-access British art).
- Verified endpoints (subagent): OAI-PMH `harvester-bl.britishart.yale.edu/
  oaicatmuseum/OAIHandler` (LIDO, sets `ycba:ps` + `ycba:pd`); rights in
  `<lido:rightsWorkSet>` (Public Domain / CC0); production date `<lido:latestDate>`;
  IIIF images via manifest `manifests.collections.yale.edu/ycba/obj/{TMS_ID}` →
  `images.collections.yale.edu/iiif/2/{id}/full/!1280,1280/0/default.jpg`.
- `scripts/harvest-ycba.ts`: OAI harvest ps+pd → filter PD + ≤1949 + people-subject
  → resolve manifest → download. Target ~7k face-bearing works.

## 2026-06-27 — Webcam tweaks + YCBA full harvest launched

- Webcam: capture every **5s** with a subtle in-window 5→1 countdown then a
  flash to black; camera button now **hidden by default**, opt-in via `?webcam`
  in the URL. Deployed to both Falkirk + Feeling Scotland.
- YCBA harvester: fixed a resumption-token double-encoding bug (discovery had
  stopped at page 1) and a title-parse miss; added early-stop once enough records
  are kept. Validated (cap-150 run). Launched full **7,000**-image background
  harvest (PD/CC0, ≤1949, people-subject). Pipeline + deploy of
  feelingbritain.electricglen.com to follow when it completes.

## 2026-06-28 — Feeling Britain (YCBA) deployed

- Harvest had stalled at ~5,775 (missing fetch-timeout — patched). Carried on with
  those 5,775 open-access YCBA images.
- Pipeline: detection → 12,832 faces → **3,665** kept (min 64px) → embedded.
- Data-driven British-art playlist (maternal love · radiant joy · drunken
  merriment · coquetry · mischief · …), validated mean overlap 0.022 — the most
  distinct of the three corpora. Icon = an 18th-c painted portrait.
- Deployed **https://feelingbritain.electricglen.com** — public (open-access), in
  COLOUR (paintings), stack `/home/ross/datadrive/docker-feelingbritain/`.
  "maternal love" → a mother-and-son portrait. Three corpora now live.

## 2026-06-28 — Note from Ross

> I'm interested in using **emotion as the hook for navigating a collection** —
> letting people find their way into an archive through feeling rather than
> dates, names, or keywords.

## 2026-06-29 — Bug + idea: diametric emotion ordering

- **Bug (search doesn't fill on big screens):** `gridLimit()` caps at 600; a
  massive widescreen has >600 cells, so the outer ring stays empty. Fix = raise/
  remove the cap. (Not yet applied.)
- **Idea from Ross — order search results along an emotional AXIS** (e.g. search
  "happy", lay out from happy → sad) instead of a similarity cluster. Discussion:
  - Turns search from "find X" into "traverse the axis between X and its
    opposite" — a spectrum/journey. Squarely "emotion as navigation."
  - Key insight: projecting a face onto the difference vector `(opposite − query)`
    **cancels common-mode content** (medium/era/setting) that pollutes raw
    similarity — so the axis is emotion-isolating, not just decorative.
  - Two flavours: (a) order the query-matches by axis position = subtle gradient
    within the cluster; (b) select faces near the LINE and lay out the full span =
    a genuine happy→neutral→sad journey (the compelling one).
  - Wants a linear / centre-diverging layout (a new "axis" MODE), not the radial
    magnitude bloom.
  - Caveats: off-axis emotions (anger/fear) flatten onto the line and mis-place;
    lopsided collections (Scotland = mostly solemn) leave one pole sparse;
    defining the opposite is non-trivial.
  - Recommended generalisation: **"from X to Y"** — user names BOTH poles
    (tender→menacing, joy→grief); single-emotion search is the special case.

## 2026-06-29 — Loading/cancel + enrichment shipped

- **Loading + cancel for searches.** Axis sorts (esp. B = full vector scan +
  first-time Gemini pole lookup) had no feedback — "didn't realize it was doing
  it." Now: each search aborts the previous in-flight request; a delayed (250ms)
  "sorting…" pill with a cancel ✕ appears only for genuinely slow searches (fast
  match-mode + play-cycle never flicker it); the debug panel mirrors it (spinner +
  "cancel sort"). Cancel aborts the fetch and keeps the current results on screen.
- **Context enrichment complete + deployed.** Britain 2,885 works (all with
  maker), Scotland 1,313 (862 with maker). Enriched sources.json shipped to both
  servers; on-demand blurbs verified live (e.g. a John S. Clifton 1849 scene).
  Falkirk unaffected (no sources). All three healthy.
