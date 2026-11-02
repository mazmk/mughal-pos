import { formatDate } from '@angular/common';
import { Pipe, PipeTransform } from '@angular/core';

const FORMATS = {
  date: 'dd/MM/yyyy',
  datetime: 'dd/MM/yyyy, h:mm a',
  'datetime-seconds': 'dd/MM/yyyy, h:mm:ss a',
} as const;

export type AppDateFormat = keyof typeof FORMATS;

type DateValue = string | number | Date | null | undefined;

const SQLITE_DATETIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

/**
 * SQLite's datetime('now') is UTC written without a zone, and JavaScript reads
 * that as local time. Mark it as UTC so it displays on the computer's clock.
 */
function withZone(value: string | number | Date): string | number | Date {
  return typeof value === 'string' && SQLITE_DATETIME.test(value)
    ? `${value.replace(' ', 'T')}Z`
    : value;
}

/** A stored timestamp as a Date, read as UTC when it has no zone. */
export function parseAppDate(value: string): Date {
  return new Date(withZone(value));
}

/** The app's one display format for dates. Returns null for empty values, like Angular's date pipe. */
export function formatAppDate(value: DateValue, format: AppDateFormat = 'date'): string | null {
  if (value == null || value === '') return null;
  return formatDate(withZone(value), FORMATS[format], 'en-US');
}

@Pipe({ name: 'appDate', standalone: true })
export class AppDatePipe implements PipeTransform {
  transform(value: DateValue, format: AppDateFormat = 'date'): string | null {
    return formatAppDate(value, format);
  }
}
