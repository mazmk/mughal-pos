import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE } from '@angular/material/core';
import { MAT_DIALOG_DEFAULT_OPTIONS, MatDialogConfig } from '@angular/material/dialog';

import { routes } from './app.routes';
import { DMY_DATE_FORMATS, DmyDateAdapter } from './core/dmy-date-adapter';

/**
 * withHashLocation() is required because Electron loads index.html via the
 * file:// protocol in production, and HTML5 PathLocation would break deep
 * links on reload.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withHashLocation()),
    provideAnimations(),
    // Dialogs open with fixed widths (560–720px); never let them exceed a small window.
    {
      provide: MAT_DIALOG_DEFAULT_OPTIONS,
      useValue: { ...new MatDialogConfig(), maxWidth: 'calc(100vw - 32px)' },
    },
    // Datepickers read and display dd/mm/yyyy. Don't import MatNativeDateModule in a
    // component: its providers would replace these for that component.
    { provide: DateAdapter, useClass: DmyDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: DMY_DATE_FORMATS },
    { provide: MAT_DATE_LOCALE, useValue: 'en-GB' },
  ],
};
