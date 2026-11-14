// The system clock (DES-005): today's date in local time, the operator's day.
import type { Clock } from "../application/ports.ts";

export class SystemClock implements Clock {
  today(): string {
    const d = new Date();
    const pad = (n: number): string => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
}
