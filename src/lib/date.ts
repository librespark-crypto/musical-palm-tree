/**
 * Local-time date helpers. Everything is `YYYY-MM-DD` in the user's own
 * timezone: a study day belongs to the calendar the student is living in, not
 * to UTC. Pure functions only, so they are trivially unit-testable.
 */
import type { ISODate } from '@/lib/types';

const MS_PER_DAY = 86_400_000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const WEEKDAYS_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export function toISODate(date: Date): ISODate {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayISO(): ISODate {
  return toISODate(new Date());
}

export function parseISODate(iso: ISODate | null | undefined): Date | null {
  if (!iso) return null;
  const parts = String(iso).slice(0, 10).split('-').map(Number);
  const [y, m, d] = parts;
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/** Calendar-day difference `b - a` (b later => positive). */
export function diffDays(a: ISODate | null, b: ISODate | null): number {
  const x = parseISODate(a);
  const y = parseISODate(b);
  if (!x || !y) return 0;
  return Math.round((y.getTime() - x.getTime()) / MS_PER_DAY);
}

export function addDays(iso: ISODate, days: number): ISODate {
  const date = parseISODate(iso) ?? new Date();
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function daysFromToday(iso: ISODate | null): number {
  if (!iso) return 0;
  return diffDays(todayISO(), iso);
}

export function weekdayShort(iso: ISODate): string {
  const date = parseISODate(iso);
  return date ? (WEEKDAYS[date.getDay()] ?? '') : '';
}

export function weekdayLong(iso: ISODate): string {
  const date = parseISODate(iso);
  return date ? (WEEKDAYS_LONG[date.getDay()] ?? '') : '';
}

export function formatDate(iso: ISODate | null, style: 'short' | 'medium' | 'long' = 'medium'): string {
  const date = parseISODate(iso);
  if (!date) return '';
  const month = MONTHS[date.getMonth()] ?? '';
  if (style === 'short') return `${date.getDate()} ${month}`;
  if (style === 'long') return `${weekdayLong(iso ?? '')}, ${date.getDate()} ${month} ${date.getFullYear()}`;
  return `${date.getDate()} ${month} ${date.getFullYear()}`;
}

/** Human relative day label used across lists ("Today", "3d overdue"). */
export function relativeDay(iso: ISODate | null): string {
  if (!iso) return '';
  const delta = daysFromToday(iso);
  if (delta === 0) return 'Today';
  if (delta === 1) return 'Tomorrow';
  if (delta === -1) return 'Yesterday';
  if (delta < 0) return `${Math.abs(delta)}d overdue`;
  if (delta <= 7) return `in ${delta}d (${weekdayShort(iso)})`;
  return formatDate(iso, 'short');
}

export function startOfWeekISO(iso: ISODate = todayISO()): ISODate {
  const date = parseISODate(iso) ?? new Date();
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day; // week starts on Monday
  return addDays(iso, diff);
}

/** `Monday 3 Mar` style headers for planner columns. */
export function dayHeading(iso: ISODate): string {
  const date = parseISODate(iso);
  if (!date) return iso;
  return `${weekdayLong(iso)} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export interface DayRange {
  from: ISODate;
  to: ISODate;
}

export function lastNDays(n: number, endISO: ISODate = todayISO()): DayRange {
  return { from: addDays(endISO, -(n - 1)), to: endISO };
}

/** Inclusive list of days between two dates, oldest first. */
export function eachDay(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  let cursor = from;
  let guard = 0;
  while (cursor <= to && guard < 4000) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
    guard += 1;
  }
  return out;
}

export function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 10) / 10;
}

/** `7h 30m` style duration. */
export function formatMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes || 0));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m}m`;
  if (!m) return `${h}h`;
  return `${h}h ${m}m`;
}

/** `mm:ss` / `h:mm:ss` stopwatch clock. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
