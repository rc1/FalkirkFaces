import fs from "node:fs";
import path from "node:path";

// Generates ~500 expressive emotion phrases for the local autocomplete.
// Curated natural phrases come first (so they rank highest), then generated
// modifier+expression / modifier+emotion combos fill the rest. Output is a
// static, reviewable array in lib/expressions.ts — no runtime generation, no API.

// Hand-picked phrases that read like an artist describing a face.
const curated = [
  "looking away", "lost in thought", "holding back tears", "fighting a smile",
  "about to cry", "caught off guard", "deep in concentration", "staring into space",
  "miles away", "on the verge of tears", "trying not to laugh", "biting back words",
  "frozen mid-laugh", "caught mid-sentence", "mouth agape", "brows furrowed",
  "eyes shut tight", "head in hands", "looking down", "glancing back",
  "far-off gaze", "thousand-yard stare", "searching the crowd", "watching intently",
  "bracing for impact", "stunned silence", "quiet disbelief", "slow realisation",
  "dawning horror", "barely holding it together", "putting on a brave face",
  "swallowing pride", "biting the lip", "clenched jaw", "gritted teeth",
  "rolling eyes", "raised eyebrow", "narrowed eyes", "downcast eyes",
  "welling up", "beaming with pride", "lighting up", "falling face",
  "drained of colour", "flushed with anger", "wide awake", "half asleep",
  "blank expression", "vacant stare", "faraway look", "knowing look",
  "withering look", "pleading eyes", "hopeful glance", "wary glance",
  "sidelong look", "double take", "stifled laugh", "silent scream",
  "open-mouthed shock", "jaw on the floor", "wincing in pain", "grimace of effort",
  "lost for words", "at a loss", "seen a ghost", "weight of the world",
  "carrying a secret", "letting go", "breaking down", "pulling it together",
  "soft focus", "hard edge", "guard up", "guard down",
  // More nuanced, observational — the in-between feelings.
  "barely holding back a smile", "trying to stay composed", "fighting back tears",
  "swallowing a lump in the throat", "blinking back emotion", "caught mid-thought",
  "drifting off", "somewhere else entirely", "quietly seething", "simmering beneath",
  "holding it in", "about to lose it", "stifling a yawn", "suppressing a laugh",
  "unimpressed", "underwhelmed", "mildly bemused", "politely baffled",
  "gently amused", "softly delighted", "quietly proud", "secretly pleased",
  "openly adoring", "tender and watchful", "wistful and far away",
  "weary but warm", "tired but tender", "hardened but hurting",
  "bracing against the cold", "squinting into low sun", "wind in the face",
  "mouth open mid-shout", "roaring with the crowd", "lost in a chant",
  "rapt and unblinking", "leaning in to listen", "straining to see",
  "craning for a better look", "shielding the eyes", "hand over mouth",
  "fingers to the lips", "cheeks flushed", "eyes glistening", "jaw set hard",
  "lip curled", "nose wrinkled", "brow knotted", "eyes narrowed to slits",
  "a slow dawning smile", "the moment before laughter", "the moment after tears",
  "quiet awe", "reverent stillness", "private grief in a crowd",
  "alone in a sea of people", "unguarded for a second", "mask slipping",
  "putting on a brave face", "world-weary", "young and unguarded",
  "old and knowing", "deadpan to the core", "wry and knowing",
  "half a smirk", "almost a frown", "not quite crying", "not quite smiling",
];

// Single-word emotions.
const emotions = [
  "joy", "grief", "anger", "rage", "fury", "sorrow", "despair", "anguish",
  "melancholy", "wistfulness", "longing", "yearning", "contentment", "serenity",
  "calm", "peace", "bliss", "ecstasy", "elation", "euphoria", "delight", "glee",
  "mirth", "amusement", "contempt", "disdain", "disgust", "revulsion", "scorn",
  "suspicion", "distrust", "wariness", "vigilance", "alarm", "panic", "terror",
  "dread", "fear", "fright", "horror", "shock", "surprise", "astonishment",
  "amazement", "awe", "wonder", "curiosity", "intrigue", "fascination", "boredom",
  "apathy", "indifference", "weariness", "exhaustion", "defiance", "determination",
  "resolve", "stubbornness", "pride", "arrogance", "smugness", "shame", "guilt",
  "embarrassment", "humiliation", "regret", "remorse", "shyness", "timidity",
  "confidence", "hope", "optimism", "anticipation", "eagerness", "excitement",
  "nervousness", "anxiety", "worry", "unease", "tension", "frustration",
  "irritation", "annoyance", "exasperation", "bitterness", "resentment", "jealousy",
  "envy", "loneliness", "isolation", "vulnerability", "tenderness", "affection",
  "warmth", "love", "adoration", "devotion", "compassion", "sympathy", "pity",
  "gratitude", "relief", "satisfaction", "triumph", "resignation", "helplessness",
  "confusion", "bewilderment", "disbelief", "skepticism", "doubt", "concentration",
  "focus", "wonderment", "heartbreak", "numbness", "restlessness", "menace",
  // Finer-grained shades.
  "tenderness", "yearning", "reverence", "trepidation", "foreboding",
  "consternation", "incredulity", "bemusement", "wariness", "tenacity",
  "stoicism", "fortitude", "vulnerability", "tendresse", "rapture",
  "disquiet", "ennui", "sullenness", "petulance", "indignation",
  "vexation", "wistfulness", "serenity", "tranquility", "elatedness",
  "jubilation", "rapt wonder", "tender pity", "bittersweetness", "longing",
  "homesickness", "nostalgia", "reluctance", "hesitancy", "ambivalence",
];

// Single-word expressions.
const expressions = [
  "smile", "grin", "smirk", "frown", "scowl", "glare", "stare", "gaze", "glance",
  "sneer", "pout", "grimace", "wince", "squint", "sigh", "gasp", "laugh", "sob",
  "snarl", "beam", "gape", "blink", "yawn", "snigger", "chuckle",
];

const exprMods = [
  "soft", "faint", "wry", "crooked", "forced", "sly", "broad", "slight", "half",
  "nervous", "wide", "blank", "vacant", "cold", "hard", "sidelong", "weary",
  "sudden", "frozen", "trembling", "tight-lipped", "knowing", "bitter", "shy",
];

const emoMods = [
  "quiet", "soft", "deep", "raw", "faint", "wild", "fierce", "barely contained",
  "simmering", "restrained", "sudden", "frozen", "hollow", "weary", "tender",
  "nervous", "growing", "fleeting", "silent", "unspoken", "smouldering", "open",
  "guarded", "wide-eyed",
];

const out: string[] = [];
const seen = new Set<string>();
const add = (s: string) => {
  const v = s.trim().toLowerCase();
  if (v && !seen.has(v)) {
    seen.add(v);
    out.push(v);
  }
};

curated.forEach(add);
emotions.forEach(add);
expressions.forEach(add);
// Interleave combos so variety shows early.
for (const m of exprMods) for (const e of expressions) add(`${m} ${e}`);
for (const m of emoMods) for (const e of emotions) add(`${m} ${e}`);

const LIMIT = 800;
const list = out.slice(0, LIMIT);

const file = path.resolve("lib/expressions.ts");
fs.writeFileSync(
  file,
  `// AUTO-GENERATED by scripts/gen-expressions.ts — ${list.length} expressive\n` +
    `// emotion phrases for the local autocomplete. Edit the generator, not this file.\n` +
    `export const EXPRESSIONS: string[] = ${JSON.stringify(list, null, 0)
      .replace(/","/g, '",\n  "')
      .replace(/^\["/, '[\n  "')
      .replace(/"\]$/, '",\n];')};\n`,
);
console.log(`Wrote ${list.length} expressions -> ${file}`);
