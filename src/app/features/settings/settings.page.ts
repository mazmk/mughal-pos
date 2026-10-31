import { Component } from '@angular/core';
import { PlaceholderPageComponent } from '../../shared/components/placeholder-page/placeholder-page.component';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [PlaceholderPageComponent],
  template: `<app-placeholder-page title="Settings" subtitle="Shop profile, backups, and preferences." icon="settings" />`,
})
export class SettingsPage {}
