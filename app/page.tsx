"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FaceView } from "@/lib/types";
import SearchBox from "@/components/SearchBox";
import Webcam from "@/components/Webcam";
import FaceGrid from "@/components/FaceGrid";
import Reveal from "@/components/Reveal";
import DebugPanel, { DEFAULT_DBG, type Dbg } from "@/components/DebugPanel";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const AUTOPLAY_DELAY = 7000; // show the hint, then start the play-cycle

// Enough results to fill the mosaic on this viewport (mirrors FaceGrid's tile
// sizing) — a small screen needs ~80, a widescreen ~500.
function gridLimit(): number {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const t = w < 600 ? 72 : w < 960 ? 104 : 132;
  const cols = Math.max(1, Math.round(w / t));
  const rows = Math.ceil(h / t);
  return Math.min(600, cols * rows + 12);
}

export default function Home() {
  const [faces, setFaces] = useState<FaceView[]>([]);
  const [radial, setRadial] = useState(false);
  const [gen, setGen] = useState(0);
  const [query, setQuery] = useState("");
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [webcam, setWebcam] = useState(false);
  const [webcamEnabled, setWebcamEnabled] = useState(false); // ?webcam gate
  const [fs, setFs] = useState(false);
  const [dbg, setDbg] = useState<Dbg>(DEFAULT_DBG);
  const [dbgOpen, setDbgOpen] = useState(false);
  const [playlist, setPlaylist] = useState<string[]>([]);
  const dbgRef = useRef(dbg);
  dbgRef.current = dbg; // play loop reads this without re-subscribing
  const acted = useRef(false); // user interacted → don't auto-start
  const [revealed, setRevealed] = useState<{
    face: FaceView;
    index: number;
    rect: DOMRect;
  } | null>(null);
  // Which tile the grid is dismissed around. Cleared at the START of a close so
  // the grid fades back in while the image is still fading/shrinking away.
  const [dismiss, setDismiss] = useState<number | null>(null);

  const lastQuery = useRef("");
  const abortRef = useRef<AbortController | null>(null);
  const load = useCallback(async (q: string) => {
    lastQuery.current = q;
    abortRef.current?.abort(); // supersede any in-flight search
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    // Only surface the spinner if the search is actually slow (axis modes), so
    // fast match-mode searches and the play-cycle don't flicker it.
    const timer = setTimeout(() => {
      if (abortRef.current === ctrl) setLoading(true);
    }, 250);
    try {
      if (!q.trim()) {
        const res = await fetch("/api/faces", { signal: ctrl.signal });
        const data = await res.json();
        setFaces(data.faces);
        setRadial(false);
      } else {
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: q,
            limit: gridLimit(),
            mode: dbgRef.current.queryMode,
          }),
          signal: ctrl.signal,
        });
        const data = await res.json();
        setFaces(data.error ? [] : data.faces);
        setRadial(true);
      }
      setGen((g) => g + 1);
    } catch {
      return; // aborted or failed — keep whatever is on screen
    } finally {
      clearTimeout(timer);
      if (abortRef.current === ctrl) {
        setLoading(false);
        abortRef.current = null;
      }
    }
  }, []);

  const cancelSearch = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
  }, []);

  // Switching the debug search-ranking mode re-runs the last query for compare.
  useEffect(() => {
    if (lastQuery.current.trim()) load(lastQuery.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbg.queryMode]);

  useEffect(() => {
    load("");
    // Corpus-specific play-cycle phrases.
    fetch("/api/playlist")
      .then((r) => r.json())
      .then((d) => setPlaylist(d.playlist || []))
      .catch(() => {});
  }, [load]);

  // Play-cycle: type an expression letter by letter, search it, hold, advance.
  useEffect(() => {
    if (!playing || playlist.length === 0) return;
    let cancelled = false;
    (async () => {
      let idx = 0;
      while (!cancelled) {
        const phrase = playlist[idx % playlist.length];
        for (let i = 1; i <= phrase.length; i++) {
          if (cancelled) return;
          setQuery(phrase.slice(0, i));
          await sleep(48);
        }
        if (cancelled) return;
        await load(phrase);
        await sleep(dbgRef.current.playHold);
        idx++;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [playing, load, playlist]);

  // Auto-start the play-cycle a few seconds after load (once the playlist is in),
  // unless the visitor has already interacted.
  useEffect(() => {
    if (playlist.length === 0 || acted.current) return;
    const t = setTimeout(() => {
      if (!acted.current) setPlaying(true);
    }, AUTOPLAY_DELAY);
    return () => clearTimeout(t);
  }, [playlist]);

  // Track fullscreen state so the icon reflects reality.
  useEffect(() => {
    const h = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  // Hidden debug trigger: backtick key, or ?debug in the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("debug")) setDbgOpen(true);
    if (params.has("webcam")) setWebcamEnabled(true); // opt-in webcam button
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === "`" && tag !== "INPUT") setDbgOpen((o) => !o);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Mobile-friendly trigger: 4 quick taps in the top-left corner.
  const taps = useRef<number[]>([]);
  const cornerTap = () => {
    const now = Date.now();
    taps.current = [...taps.current, now].filter((t) => now - t < 800);
    if (taps.current.length >= 4) {
      taps.current = [];
      setDbgOpen((o) => !o);
    }
  };

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  }

  // User typing takes over from the play-cycle.
  const onUserChange = (v: string) => {
    acted.current = true;
    if (playing) setPlaying(false);
    setQuery(v);
  };

  // Search the corpus for faces resembling a captured webcam frame.
  const searchImage = useCallback(async (dataUrl: string) => {
    const res = await fetch("/api/search-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: dataUrl, limit: gridLimit() }),
    });
    const data = await res.json();
    if (!data.error) {
      setFaces(data.faces);
      setRadial(true);
      setGen((g) => g + 1);
    }
  }, []);

  // Toggle webcam mode (stops the play-cycle; takes over the input).
  const toggleWebcam = () => {
    acted.current = true;
    setPlaying(false);
    setWebcam((w) => !w);
  };

  return (
    <main className="screen">
      <FaceGrid
        faces={faces}
        onReveal={(face, index, rect) => {
          acted.current = true;
          setPlaying(false); // clicking a face stops the play-cycle
          setRevealed({ face, index, rect });
          setDismiss(index);
        }}
        dismissIndex={dismiss}
        radial={radial}
        gen={gen}
        tileOverride={dbg.tile}
        dismissSpan={dbg.dismissSpan}
        bloomStep={dbg.bloomStep}
        faceZoom={dbg.faceZoom}
      />

      {/* search-in-flight indicator with a cancel (axis sorts can be slow) */}
      {loading && (
        <div className="search-loading">
          <span className="spinner" />
          <span>sorting…</span>
          <button onClick={cancelSearch} aria-label="cancel search" title="Cancel">
            ✕
          </button>
        </div>
      )}

      {/* subtle center vignette — edges fade to draw the eye inward */}
      <div className="vignette" style={{ opacity: dbg.vignette }} />

      {/* invisible hotspot to summon the debug panel on touch devices */}
      <div className="debug-hotspot" onClick={cornerTap} />

      <div className="search-dock">
        <button
          className="dock-btn"
          onClick={toggleFullscreen}
          aria-label={fs ? "exit fullscreen" : "fullscreen"}
          title={fs ? "Exit fullscreen" : "Fullscreen"}
        >
          {fs ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 3v6H3M21 9h-6V3M3 15h6v6M15 21v-6h6" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6" />
            </svg>
          )}
        </button>

        {webcam ? (
          <Webcam onCapture={searchImage} />
        ) : (
          <SearchBox
            value={query}
            onValueChange={onUserChange}
            onSearch={load}
            playing={playing}
          />
        )}

        {/* Play / pause / stop. In webcam mode this is the stop button. */}
        <button
          className={`dock-btn ${playing || webcam ? "on" : ""}`}
          onClick={() => {
            if (webcam) {
              setWebcam(false);
            } else {
              acted.current = true;
              setPlaying((p) => !p);
            }
          }}
          aria-label={webcam ? "stop webcam" : playing ? "stop play" : "play expressions"}
          title={webcam ? "Stop" : playing ? "Stop" : "Play through expressions"}
        >
          {webcam ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="5" y="5" width="14" height="14" rx="2" />
            </svg>
          ) : playing ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 5l12 7-12 7V5z" />
            </svg>
          )}
        </button>

        {/* Webcam (opt-in via ?webcam): find the faces most like you. */}
        {webcamEnabled && (
          <button
            className={`dock-btn ${webcam ? "on" : ""}`}
            onClick={toggleWebcam}
            aria-label="webcam search"
            title="Find faces like yours"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </button>
        )}
      </div>

      {revealed && (
        <Reveal
          face={revealed.face}
          rect={revealed.rect}
          onClosingStart={() => setDismiss(null)}
          onClose={() => setRevealed(null)}
          fadeDelay={dbg.fadeDelay}
          zoomMs={dbg.zoomMs}
        />
      )}

      {dbgOpen && (
        <DebugPanel
          dbg={dbg}
          setDbg={setDbg}
          onClose={() => setDbgOpen(false)}
          loading={loading}
          onCancel={cancelSearch}
        />
      )}
    </main>
  );
}
