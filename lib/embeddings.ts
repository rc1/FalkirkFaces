import fs from "node:fs";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";
import { config } from "./config";
import { paths } from "./paths";

// All embedding logic lives here so the provider can be swapped without touching
// the pipeline or the API routes. Today: Gemini Embedding 2 — Google's natively
// multimodal model that maps BOTH images and text into one shared vector space.
// That shared space is the whole trick: we embed a face crop and a text query
// ("quiet sadness") and compare them directly. No captioning step required.

let client: GoogleGenAI | null = null;
function ai(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set (see .env.example)");
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

async function embed(contents: unknown): Promise<number[]> {
  const res = await ai().models.embedContent({
    model: config.embedModel,
    contents: contents as never,
    config: { outputDimensionality: config.embedDim },
  });
  const values = res.embeddings?.[0]?.values;
  if (!values) throw new Error("No embedding returned");
  return values;
}

// --- Text-query cache ----------------------------------------------------
// Query embeddings repeat a lot (the play-cycle, quick prompts, autocomplete
// picks), so we cache them in memory and persist to disk. Survives restarts and
// is shared across users. Keyed by model + dimensions + normalised text.
const CACHE_FILE = path.join(paths.data, "embed-cache.json");
let cache: Map<string, number[]> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function cacheKey(text: string): string {
  return `${config.embedModel}:${config.embedDim}:${text.trim().toLowerCase()}`;
}
function loadCache(): Map<string, number[]> {
  if (cache) return cache;
  cache = new Map();
  try {
    const obj = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")) as Record<
      string,
      number[]
    >;
    for (const [k, v] of Object.entries(obj)) cache.set(k, v);
  } catch {
    /* no cache yet */
  }
  return cache;
}
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.writeFileSync(CACHE_FILE, JSON.stringify(Object.fromEntries(cache!)));
    } catch {
      /* best effort */
    }
  }, 1000);
}

/** Embed a free-text expressive query — cached. */
export async function embedText(text: string): Promise<number[]> {
  const c = loadCache();
  const key = cacheKey(text);
  const hit = c.get(key);
  if (hit) return hit;
  const vec = await embed(text);
  c.set(key, vec);
  scheduleSave();
  return vec;
}

/** Embed raw image bytes (base64). Used by the live webcam search. */
export async function embedImageBytes(
  b64: string,
  mime = "image/jpeg",
): Promise<number[]> {
  return embed([{ inlineData: { mimeType: mime, data: b64 } }]);
}

/** Embed a face-crop image file directly (pipeline use; not cached). */
export async function embedImageFile(filePath: string): Promise<number[]> {
  const b64 = fs.readFileSync(filePath).toString("base64");
  const ext = filePath.toLowerCase().endsWith(".png")
    ? "image/png"
    : "image/jpeg";
  return embedImageBytes(b64, ext);
}
