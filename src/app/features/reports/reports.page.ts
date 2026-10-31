import { Component } from '@angular/core';
import { PlaceholderPageComponent } from '../../shared/components/placeholder-page/placeholder-page.component';

@Component({
  selector: 'app-reports-page',
  standalone: true,
  imports: [PlaceholderPageComponent],
  template: `<app-placeholder-page title="Reports" subtitle="Daily, weekly, and monthly performance." icon="analytics" />`,
})
export class ReportsPage {}
