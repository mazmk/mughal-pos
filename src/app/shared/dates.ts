import type { DateRange } from '../../../shared/ipc-types';

/** A local calendar date as yyyy-mm-dd, the form report and list ranges take. */
export function toISODate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** First to last day of the month `offset` months from now (0 = this month, -1 = last). */
export function monthRange(offset = 0): { from: Date; to: Date } {
  const now = new Date();
  return {
    from: new Date(now.getFullYear(), now.getMonth() + offset, 1),
    to: new Date(now.getFullYear(), now.getMonth() + offset + 1, 0),
  };
}

export function thisMonth(): DateRange {
  const { from, to } = monthRange();
  return { from: toISODate(from), to: toISODate(to) };
}
