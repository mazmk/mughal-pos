import { Pipe, PipeTransform, inject } from '@angular/core';
import { SettingsService } from '../../core/services/settings.service';

/**
 * Formats a number using the shop's configured currency + locale.
 * Falls back to PKR/en-PK until settings load.
 */
@Pipe({ name: 'money', standalone: true, pure: false })
export class MoneyPipe implements PipeTransform {
  private readonly settings = inject(SettingsService);

  transform(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) return '—';
    const currency = this.settings.value('shop.currency', 'PKR');
    const locale = this.settings.value('shop.locale', 'en-PK');
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
      }).format(value);
    } catch {
      return `${currency} ${value.toFixed(2)}`;
    }
  }
}
