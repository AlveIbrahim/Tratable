/** Opaque keyset-pagination cursor. Never use OFFSET for records — this repo's
 * scale target is 100k rows/table and OFFSET degrades linearly with depth.
 * sortValues holds one entry per active sort column, in order, so multi-
 * column sorts (and grouping, which is implemented as a sort by the group
 * field) paginate correctly past page one — not just the first column. */
export interface Cursor {
  sortValues: unknown[];
  id: string;
}

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeCursor(raw: string): Cursor {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (typeof parsed !== "object" || parsed === null || !("id" in parsed)) {
      throw new Error("malformed cursor");
    }
    return parsed as Cursor;
  } catch {
    throw new Error("Invalid pagination cursor");
  }
}
