"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { EXPRESSIONS } from "@/lib/expressions";

// Controlled pill: the page owns the value so the play-cycle can type into it.
// Search fires when the user stops typing (debounced), or immediately on Enter /
// picking a suggestion. While the play-cycle runs, suggestions + hint are muted.
const MAX_SUGGESTIONS = 8;
const DEBOUNCE_MS = 450;

export default function SearchBox({
  value,
  onValueChange,
  onSearch,
  playing,
}: {
  value: string;
  onValueChange: (v: string) => void;
  onSearch: (q: string) => void;
  playing: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1);
  const [hint, setHint] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const sizerRef = useRef<HTMLSpanElement>(null);
  const [inputW, setInputW] = useState(48);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Size the input to its text exactly (the `ch` unit over-pads), so the clear
  // button sits right after the word.
  useLayoutEffect(() => {
    if (sizerRef.current) setInputW(Math.max(40, sizerRef.current.offsetWidth + 4));
  }, [value]);

  useEffect(() => {
    const t = setTimeout(() => setHint(false), 4000);
    return () => clearTimeout(t);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

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
    onValueChange(s);
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

  const showHint = !value && !playing;
  const showSuggestions = open && !playing && suggestions.length > 0;

  return (
    <div className="search-field">
      {showHint && (
        <div className={`search-hint ${hint ? "" : "hide"}`}>
          Enter an expression or emotion
        </div>
      )}

      {showSuggestions && (
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

      <span ref={sizerRef} className="input-sizer" aria-hidden>
        {value}
      </span>

      <div className="search-pill">
        <input
          ref={inputRef}
          value={value}
          style={{ width: `${inputW}px` }}
          onChange={(e) => {
            onValueChange(e.target.value);
            setOpen(true);
            setHi(-1);
            fireDebounced(e.target.value);
          }}
          onFocus={() => value && !playing && setOpen(true)}
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
              onValueChange("");
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
