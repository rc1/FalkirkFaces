import * as lancedb from "@lancedb/lancedb";
import { paths } from "./paths";

// One LanceDB database folder, one table ("faces"). The table is intentionally
// tiny: just { id, vector }. Everything human-readable stays in the manifest and
// is joined back by id. Wipe-and-rebuild friendly.

const TABLE = "faces";

export interface VectorRow {
  id: string;
  vector: number[];
}

export async function connect() {
  return lancedb.connect(paths.lancedb);
}

/** Overwrite the whole index with a fresh set of vectors. */
export async function rebuildTable(rows: VectorRow[]) {
  const db = await connect();
  if (rows.length === 0) {
    // Nothing to index yet — drop any stale table so search returns empty.
    try {
      await db.dropTable(TABLE);
    } catch {
      /* table didn't exist */
    }
    return;
  }
  await db.createTable(TABLE, rows as unknown as Record<string, unknown>[], {
    mode: "overwrite",
  });
}

export interface SearchHit {
  id: string;
  distance: number;
}

/** Nearest faces to a query vector. Returns ids + raw L2 distance. */
export async function searchVectors(
  vector: number[],
  limit: number,
): Promise<SearchHit[]> {
  const db = await connect();
  let tbl;
  try {
    tbl = await db.openTable(TABLE);
  } catch {
    return []; // not indexed yet
  }
  const rows = await tbl.search(vector).limit(limit).toArray();
  return rows.map((r: Record<string, unknown>) => ({
    id: String(r.id),
    distance: Number(r._distance),
  }));
}

export interface VectorHit extends SearchHit {
  vector: number[];
}

const toNums = (v: unknown): number[] => Array.from(v as ArrayLike<number>);

/** Like searchVectors, but also returns each hit's embedding (for re-ranking). */
export async function searchVectorsFull(
  vector: number[],
  limit: number,
): Promise<VectorHit[]> {
  const db = await connect();
  let tbl;
  try {
    tbl = await db.openTable(TABLE);
  } catch {
    return [];
  }
  const rows = await tbl.search(vector).limit(limit).toArray();
  return rows.map((r: Record<string, unknown>) => ({
    id: String(r.id),
    distance: Number(r._distance),
    vector: toNums(r.vector),
  }));
}

/** Every indexed vector (the corpus is small — a full scan is cheap). */
export async function allVectors(): Promise<VectorRow[]> {
  const db = await connect();
  let tbl;
  try {
    tbl = await db.openTable(TABLE);
  } catch {
    return [];
  }
  const rows = await tbl.query().limit(100000).toArray();
  return rows.map((r: Record<string, unknown>) => ({
    id: String(r.id),
    vector: toNums(r.vector),
  }));
}
