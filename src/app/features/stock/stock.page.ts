import { Component } from '@angular/core';
import { PlaceholderPageComponent } from '../../shared/components/placeholder-page/placeholder-page.component';

@Component({
  selector: 'app-stock-page',
  standalone: true,
  imports: [PlaceholderPageComponent],
  template: `<app-placeholder-page title="Stock Movements" subtitle="Immutable ledger of every stock change." icon="swap_vert" />`,
})
export class StockPage {}
