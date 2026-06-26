import fs from "node:fs";
import { GoogleGenAI } from "@google/genai";
import { config } from "./config";

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

/** Embed a free-text expressive query, e.g. "wide-eyed anxiety". */
export async function embedText(text: string): Promise<number[]> {
  return embed(text);
}

/** Embed a face-crop image file directly (no caption in between). */
export async function embedImageFile(filePath: string): Promise<number[]> {
  const b64 = fs.readFileSync(filePath).toString("base64");
  const ext = filePath.toLowerCase().endsWith(".png")
    ? "image/png"
    : "image/jpeg";
  return embed([{ inlineData: { mimeType: ext, data: b64 } }]);
}
