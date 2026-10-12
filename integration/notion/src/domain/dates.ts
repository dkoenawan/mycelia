// UTC date helpers (pure), the same rules as the repo's src/lib/dates.ts,
// which domain/ may not import (D8). A run takes its date once, at start.

export function utcDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function utcTime(d: Date): string {
  return d.toISOString().slice(11, 16);
}

export function utcStamp(d: Date): string {
  return `${d.toISOString().slice(0, 19)}Z`;
}
