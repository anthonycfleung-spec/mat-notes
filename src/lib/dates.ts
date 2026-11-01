// Dates are stored as local yyyy-mm-dd strings so a session belongs to the day you trained.

const pad = (n: number) => String(n).padStart(2, "0");

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO(): string {
  return toISO(new Date());
}

export function addDays(iso: string, days: number): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

/** Monday of the week containing iso. */
export function weekStart(iso: string): string {
  const d = fromISO(iso);
  const offset = (d.getDay() + 6) % 7;
  return addDays(iso, -offset);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86_400_000);
}

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Sun 1 Nov" */
export function formatDay(iso: string): string {
  const d = fromISO(iso);
  return `${DAY[d.getDay()]} ${d.getDate()} ${MONTH[d.getMonth()]}`;
}

/** "1 Nov" */
export function formatShort(iso: string): string {
  const d = fromISO(iso);
  return `${d.getDate()} ${MONTH[d.getMonth()]}`;
}
