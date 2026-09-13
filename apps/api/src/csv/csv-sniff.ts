import * as fs from "node:fs";
import chardet from "chardet";

const CANDIDATE_DELIMITERS = [",", ";", "\t", "|"];

/** Reads a leading chunk of the file to guess text encoding and delimiter,
 * without reading the whole file into memory — needed for the 50MB/500k-row
 * files this import path is sized for. */
export function sniffFile(path: string): { encoding: string; delimiter: string } {
  const fd = fs.openSync(path, "r");
  try {
    const buf = Buffer.alloc(64 * 1024);
    const bytesRead = fs.readSync(fd, buf, 0, buf.length, 0);
    const sample = buf.subarray(0, bytesRead);

    const detected = chardet.detect(sample);
    const encoding = normalizeEncoding(detected);

    const text = sample.toString(encoding as BufferEncoding, 0, sample.length);
    const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
    let bestDelimiter = ",";
    let bestCount = -1;
    for (const d of CANDIDATE_DELIMITERS) {
      const count = firstLine.split(d).length - 1;
      if (count > bestCount) {
        bestCount = count;
        bestDelimiter = d;
      }
    }
    return { encoding, delimiter: bestDelimiter };
  } finally {
    fs.closeSync(fd);
  }
}

function normalizeEncoding(detected: string | null): string {
  if (!detected) return "utf8";
  const lower = detected.toLowerCase();
  if (lower.includes("utf-8") || lower.includes("ascii")) return "utf8";
  if (lower.includes("utf-16le")) return "utf16le";
  // Node's Buffer.toString doesn't support most legacy encodings
  // (windows-1252, iso-8859-1, etc.) natively — fall back to utf8 and let
  // per-cell parse errors surface as import row errors rather than
  // silently mojibake-ing the whole file. A TextDecoder-based re-encode
  // pass is a reasonable Phase 9 follow-up if this proves common.
  return "utf8";
}
