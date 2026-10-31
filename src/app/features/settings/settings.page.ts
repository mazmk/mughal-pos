import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SettingsService } from '../../core/services/settings.service';
import { ThemeMode, ThemeService } from '../../core/services/theme.service';
import { BackupPanelComponent } from './backup-panel.component';

interface ProfileForm {
  name: string;
  currency: string;
  locale: string;
}

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    BackupPanelComponent,
  ],
  templateUrl: './settings.page.html',
  styleUrl: './settings.page.scss',
})
export class SettingsPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly settings = inject(SettingsService);
  private readonly theme = inject(ThemeService);
  private readonly snack = inject(MatSnackBar);

  readonly saving = signal(false);
  readonly form: FormGroup = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    currency: ['', [Validators.required, Validators.maxLength(10)]],
    locale: ['', [Validators.required, Validators.maxLength(20)]],
  });

  readonly themeMode = this.theme.mode;
  readonly themeOptions: readonly { value: ThemeMode; label: string; icon: string }[] = [
    { value: 'system', label: 'Match system', icon: 'contrast' },
    { value: 'light', label: 'Light', icon: 'light_mode' },
    { value: 'dark', label: 'Dark', icon: 'dark_mode' },
  ];

  readonly logoBusy = signal(false);
  readonly hasCustomLogo = computed(() => this.settings.shopLogo() !== '');
  readonly logoPreview = computed(() => this.settings.shopLogo() || 'brand/symbol-color.svg');

  async ngOnInit(): Promise<void> {
    await this.settings.refresh();
    this.form.reset({
      name: this.settings.value('shop.name', 'Mughal Tuck Shop'),
      currency: this.settings.value('shop.currency', 'PKR'),
      locale: this.settings.value('shop.locale', 'en-PK'),
    });
  }

  async save(): Promise<void> {
    if (this.form.invalid) return;
    const value = this.form.getRawValue() as ProfileForm;
    this.saving.set(true);
    try {
      await this.settings.set('shop.name', value.name);
      await this.settings.set('shop.currency', value.currency);
      await this.settings.set('shop.locale', value.locale);
      this.snack.open('Shop profile saved', 'OK', { duration: 2500 });
    } catch (err) {
      this.snack.open(err instanceof Error ? err.message : String(err), 'Dismiss', {
        duration: 4000,
      });
    } finally {
      this.saving.set(false);
    }
  }

  async setTheme(mode: ThemeMode): Promise<void> {
    this.theme.setMode(mode);
    try {
      await this.settings.set('theme.mode', mode);
    } catch {
      // non-fatal
    }
  }

  async pickLogo(): Promise<void> {
    this.logoBusy.set(true);
    try {
      if (await this.settings.pickLogo()) this.snack.open('Shop logo updated', 'OK', { duration: 2500 });
    } catch (err) {
      this.snack.open(err instanceof Error ? err.message : String(err), 'Dismiss', { duration: 5000 });
    } finally {
      this.logoBusy.set(false);
    }
  }

  async clearLogo(): Promise<void> {
    this.logoBusy.set(true);
    try {
      await this.settings.clearLogo();
      this.snack.open('Using the default logo', 'OK', { duration: 2500 });
    } catch (err) {
      this.snack.open(err instanceof Error ? err.message : String(err), 'Dismiss', { duration: 5000 });
    } finally {
      this.logoBusy.set(false);
    }
  }
}
