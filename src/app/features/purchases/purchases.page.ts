import { Component } from '@angular/core';
import { PlaceholderPageComponent } from '../../shared/components/placeholder-page/placeholder-page.component';

@Component({
  selector: 'app-purchases-page',
  standalone: true,
  imports: [PlaceholderPageComponent],
  template: `<app-placeholder-page title="Purchases" subtitle="Record goods received from suppliers." icon="shopping_cart_checkout" />`,
})
export class PurchasesPage {}
