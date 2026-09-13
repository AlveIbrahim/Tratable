import { customAlphabet } from "nanoid";

// Unambiguous alphabet (no 0/O/I/l confusion) for IDs that may appear in URLs/logs.
const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
const generate = customAlphabet(alphabet, 20);

export const ID_PREFIXES = {
  user: "usr",
  workspace: "wsp",
  base: "bas",
  table: "tbl",
  field: "fld",
  record: "rec",
  view: "viw",
  interface: "itf",
  page: "pag",
  option: "opt",
  importJob: "imp",
  attachment: "att",
  refreshToken: "rft",
} as const;

export type IdKind = keyof typeof ID_PREFIXES;

export function makeId(kind: IdKind): string {
  return `${ID_PREFIXES[kind]}_${generate()}`;
}

export function isIdOfKind(value: string, kind: IdKind): boolean {
  return value.startsWith(`${ID_PREFIXES[kind]}_`);
}
