// Port of scripts/lib/common.sh's log/warn/die (ADR-0007): same stderr format,
// so a runner's stdout stays clean for real output.

export function stamp(d: Date = new Date()): string {
  return `[${d.toISOString().slice(0, 19).replace("T", " ")} UTC]`;
}

export function log(msg: string): void {
  process.stderr.write(`${stamp()} ${msg}\n`);
}

export function warn(msg: string): void {
  log(`WARN: ${msg}`);
}

export function error(msg: string): void {
  log(`ERROR: ${msg}`);
}
