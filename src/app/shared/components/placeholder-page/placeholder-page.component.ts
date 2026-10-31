import { Component, Input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-placeholder-page',
  standalone: true,
  imports: [MatCardModule, MatIconModule],
  template: `
    <div class="flex flex-col gap-4 max-w-3xl">
      <header>
        <h1 class="m-0 text-2xl font-semibold tracking-tight">{{ title }}</h1>
        <p class="m-0 mt-1 text-sm opacity-70">{{ subtitle }}</p>
      </header>

      <mat-card appearance="outlined" class="!rounded-xl">
        <mat-card-content class="flex items-center gap-4 !p-6">
          <mat-icon class="!h-10 !w-10 !text-4xl opacity-60">{{ icon }}</mat-icon>
          <div class="flex flex-col">
            <span class="font-medium">Feature scaffolded</span>
            <span class="text-sm opacity-70">
              Routes, folder, and lazy loading are configured. Implementation lands in a later step.
            </span>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
})
export class PlaceholderPageComponent {
  @Input() title = 'Feature';
  @Input() subtitle = '';
  @Input() icon = 'construction';
}
