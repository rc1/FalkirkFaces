import fs from "node:fs";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";
import { paths } from "./paths";
import type { Source } from "./types";

// On-demand, grounded "blurb" — one evocative caption per source work, composed
// ONLY from the real catalogue facts (no outside knowledge, no invention).
// Generated lazily on first view and cached to disk, so cost tracks actual use
// and each work is only ever generated once.

const MODEL = process.env.NARRATE_MODEL || "gemini-3.5-flash";

let client: GoogleGenAI | null = null;
function ai(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

const CACHE = path.join(paths.data, "blurb-cache.json");
let cache: Record<string, string> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function load(): Record<string, string> {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(CACHE, "utf8"));
  } catch {
    cache = {};
  }
  return cache!;
}
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.writeFileSync(CACHE, JSON.stringify(cache));
    } catch {
      /* best effort */
    }
  }, 1000);
}

function factsOf(s: Source): string {
  return [
    s.label && `Title: ${s.label}`,
    s.creator && `Maker: ${s.creator}`,
    s.date && `Date: ${s.date}`,
    s.medium && `Medium: ${s.medium}`,
    s.classification && `Type: ${s.classification}`,
    s.subjects?.length && `Subjects: ${s.subjects.join(", ")}`,
    s.description && `Catalogue note: ${s.description}`,
    s.institution && `Collection: ${s.institution}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Grounded caption for a source work, keyed by a stable id. Cached. */
export async function blurbFor(key: string, s: Source): Promise<string | null> {
  const c = load();
  if (key in c) return c[key];
  const facts = factsOf(s);
  if (!facts) return null;
  const prompt =
    "You write a single, quietly evocative caption for a heritage image so a " +
    "viewer feels its mood and humanity. Use ONLY the facts below — never invent " +
    "names, events, dates, places, or details that are not present. If the facts " +
    "are thin, stay impressionistic rather than guessing. One sentence, at most " +
    "26 words, present tense, no quotation marks, no preamble.\n\nFacts:\n" +
    facts +
    "\n\nCaption:";
  try {
    const r = await ai().models.generateContent({ model: MODEL, contents: prompt });
    const text = (r.text || "").trim().replace(/^["']|["']$/g, "");
    if (text) {
      c[key] = text;
      scheduleSave();
      return text;
    }
  } catch {
    /* leave uncached so it can retry later */
  }
  return null;
}
