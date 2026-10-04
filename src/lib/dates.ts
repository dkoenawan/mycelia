// UTC date helpers. A run takes its date once, at start (DES-002).

export function utcDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function utcTime(d: Date): string {
  return d.toISOString().slice(11, 16);
}

export function utcStamp(d: Date): string {
  return `${d.toISOString().slice(0, 19)}Z`;
}
