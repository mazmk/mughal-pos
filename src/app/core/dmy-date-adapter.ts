import { Injectable } from '@angular/core';
import { MAT_NATIVE_DATE_FORMATS, MatDateFormats, NativeDateAdapter } from '@angular/material/core';

/**
 * Reads typed datepicker input as dd/mm/yyyy. The stock adapter uses Date.parse,
 * which is month-first: 02/03/2026 would silently become 3 February.
 */
@Injectable()
export class DmyDateAdapter extends NativeDateAdapter {
  override parse(value: unknown, parseFormat?: unknown): Date | null {
    if (typeof value !== 'string') return super.parse(value, parseFormat);
    if (!value.trim()) return null;

    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
    if (!match) return this.invalid();

    const [day, month, year] = match.slice(1).map(Number);
    const date = new Date(year, month - 1, day);
    // new Date() rolls overflow forward (31/02 → 3 March), so reject it here.
    return date.getMonth() === month - 1 ? date : this.invalid();
  }
}

/** Rendered with MAT_DATE_LOCALE en-GB, this prints as dd/mm/yyyy. */
export const DMY_DATE_FORMATS: MatDateFormats = {
  ...MAT_NATIVE_DATE_FORMATS,
  display: {
    ...MAT_NATIVE_DATE_FORMATS.display,
    dateInput: { day: '2-digit', month: '2-digit', year: 'numeric' },
  },
};
