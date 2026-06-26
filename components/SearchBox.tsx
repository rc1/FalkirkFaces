"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EXPRESSIONS } from "@/lib/expressions";

// Tiny auto-sizing pill. No button: search fires when you stop typing
// (debounced), or immediately on Enter / picking a suggestion.
const MAX_SUGGESTIONS = 8;
const DEBOUNCE_MS = 450;

export default function SearchBox({
  onSearch,
}: {
  onSearch: (q: string) => void;
}) {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1);
  const [hint, setHint] = useState(true); // brief "what to type" tooltip
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show the hint for a few seconds on load.
  useEffect(() => {
    const t = setTimeout(() => setHint(false), 4000);
    return () => clearTimeout(t);
  }, []);

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    const starts: string[] = [];
    const contains: string[] = [];
    for (const e of EXPRESSIONS) {
      if (e === q) continue;
      if (e.startsWith(q)) starts.push(e);
      else if (e.includes(q)) contains.push(e);
      if (starts.length >= MAX_SUGGESTIONS) break;
    }
    return [...starts, ...contains].slice(0, MAX_SUGGESTIONS);
  }, [value]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function fireNow(q: string) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    onSearch(q);
  }
  function fireDebounced(q: string) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onSearch(q), DEBOUNCE_MS);
  }

  function choose(s: string) {
    setValue(s);
    setOpen(false);
    setHi(-1);
    fireNow(s);
    inputRef.current?.blur();
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHi((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((h) => Math.max(h - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && hi >= 0 && suggestions[hi]) choose(suggestions[hi]);
      else {
        setOpen(false);
        fireNow(value);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setHi(-1);
    }
  }

  // Grow with the text, but stay small enough to "fit a short word".
  const widthCh = Math.max(6, value.length + 1);

  return (
    <div className="search-field">
      {!value && (
        <div className={`search-hint ${hint ? "" : "hide"}`}>
          Enter an expression or emotion
        </div>
      )}

      {open && suggestions.length > 0 && (
        <ul className="suggestions">
          {suggestions.map((s, i) => (
            <li
              key={s}
              className={`suggestion ${i === hi ? "active" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(s);
              }}
              onMouseEnter={() => setHi(i)}
            >
              {s}
            </li>
          ))}
        </ul>
      )}

      <div className="search-pill">
        <input
          ref={inputRef}
          value={value}
          style={{ width: `${widthCh}ch` }}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
            setHi(-1);
            fireDebounced(e.target.value);
          }}
          onFocus={() => value && setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKey}
          autoFocus
          aria-label="search expressions"
        />
        {value && (
          <button
            className="pill-clear"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setValue("");
              setOpen(false);
              setHi(-1);
              fireNow("");
            }}
            aria-label="clear"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
