"use client";

import { useCallback, useEffect, useState } from "react";
import type { FaceView } from "@/lib/types";
import SearchBox from "@/components/SearchBox";
import FaceGrid from "@/components/FaceGrid";
import Reveal from "@/components/Reveal";
import { PLAYLIST } from "@/lib/playlist";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Home() {
  const [faces, setFaces] = useState<FaceView[]>([]);
  const [radial, setRadial] = useState(false);
  const [gen, setGen] = useState(0);
  const [query, setQuery] = useState("");
  const [playing, setPlaying] = useState(false);
  const [fs, setFs] = useState(false);
  const [revealed, setRevealed] = useState<{
    face: FaceView;
    index: number;
    rect: DOMRect;
  } | null>(null);

  const load = useCallback(async (q: string) => {
    if (!q.trim()) {
      const res = await fetch("/api/faces");
      const data = await res.json();
      setFaces(data.faces);
      setRadial(false);
    } else {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, limit: 200 }),
      });
      const data = await res.json();
      setFaces(data.error ? [] : data.faces);
      setRadial(true);
    }
    setGen((g) => g + 1);
  }, []);

  useEffect(() => {
    load("");
  }, [load]);

  // Play-cycle: type an expression letter by letter, search it, hold, advance.
  useEffect(() => {
    if (!playing) return;
    let cancelled = false;
    (async () => {
      let idx = 0;
      while (!cancelled) {
        const phrase = PLAYLIST[idx % PLAYLIST.length];
        for (let i = 1; i <= phrase.length; i++) {
          if (cancelled) return;
          setQuery(phrase.slice(0, i));
          await sleep(48);
        }
        if (cancelled) return;
        await load(phrase);
        await sleep(4000);
        idx++;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [playing, load]);

  // Track fullscreen state so the icon reflects reality.
  useEffect(() => {
    const h = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  }

  // User typing takes over from the play-cycle.
  const onUserChange = (v: string) => {
    if (playing) setPlaying(false);
    setQuery(v);
  };

  return (
    <main className="screen">
      <FaceGrid
        faces={faces}
        onReveal={(face, index, rect) => setRevealed({ face, index, rect })}
        dismissIndex={revealed?.index ?? null}
        radial={radial}
        gen={gen}
      />

      <div className="search-dock">
        <SearchBox
          value={query}
          onValueChange={onUserChange}
          onSearch={load}
          playing={playing}
        />

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

        <button
          className={`dock-btn ${playing ? "on" : ""}`}
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? "stop play" : "play expressions"}
          title={playing ? "Stop" : "Play through expressions"}
        >
          {playing ? (
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
      </div>

      {revealed && (
        <Reveal
          face={revealed.face}
          rect={revealed.rect}
          onClose={() => setRevealed(null)}
        />
      )}
    </main>
  );
}
