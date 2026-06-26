"use client";

import { useCallback, useEffect, useState } from "react";
import type { FaceView } from "@/lib/types";
import SearchBox from "@/components/SearchBox";
import FaceGrid from "@/components/FaceGrid";
import Reveal from "@/components/Reveal";

export default function Home() {
  const [faces, setFaces] = useState<FaceView[]>([]);
  const [radial, setRadial] = useState(false);
  const [gen, setGen] = useState(0);
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
        <SearchBox onSearch={load} />
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
