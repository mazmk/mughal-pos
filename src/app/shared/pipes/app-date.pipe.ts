import { formatDate } from '@angular/common';
import { Pipe, PipeTransform } from '@angular/core';

const FORMATS = {
  date: 'dd/MM/yyyy',
  datetime: 'dd/MM/yyyy, h:mm a',
  'datetime-seconds': 'dd/MM/yyyy, h:mm:ss a',
} as const;

export type AppDateFormat = keyof typeof FORMATS;

type DateValue = string | number | Date | null | undefined;

/** The app's one display format for dates. Returns null for empty values, like Angular's date pipe. */
export function formatAppDate(value: DateValue, format: AppDateFormat = 'date'): string | null {
  if (value == null || value === '') return null;
  return formatDate(value, FORMATS[format], 'en-US');
}

@Pipe({ name: 'appDate', standalone: true })
export class AppDatePipe implements PipeTransform {
  transform(value: DateValue, format: AppDateFormat = 'date'): string | null {
    return formatAppDate(value, format);
  }
}
