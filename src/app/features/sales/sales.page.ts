import { Component } from '@angular/core';
import { PlaceholderPageComponent } from '../../shared/components/placeholder-page/placeholder-page.component';

@Component({
  selector: 'app-sales-page',
  standalone: true,
  imports: [PlaceholderPageComponent],
  template: `<app-placeholder-page title="Sales" subtitle="Historical sales and refunds." icon="receipt_long" />`,
})
export class SalesPage {}
