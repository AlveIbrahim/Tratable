import type { CSSProperties } from "react";

const CHIP_COUNT = 10;

/** Deterministic chip color for a select/multi-select choice, hashed from
 * its id — the same choice reads the same color everywhere (grid, editor,
 * export preview) without persisting a color per choice server-side. */
export function chipColorClass(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  const n = (hash % CHIP_COUNT) + 1;
  return `chip-${n}`;
}

export function chipStyle(id: string): CSSProperties {
  const n = chipColorClass(id).replace("chip-", "");
  return {
    background: `var(--chip-${n}-bg)`,
    color: `var(--chip-${n}-fg)`,
  };
}
