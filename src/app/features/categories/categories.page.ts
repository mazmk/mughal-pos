import { Component } from '@angular/core';
import { PlaceholderPageComponent } from '../../shared/components/placeholder-page/placeholder-page.component';

@Component({
  selector: 'app-categories-page',
  standalone: true,
  imports: [PlaceholderPageComponent],
  template: `<app-placeholder-page title="Categories" subtitle="Organise products into categories." icon="category" />`,
})
export class CategoriesPage {}
