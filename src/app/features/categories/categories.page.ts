import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { Category } from '../../../../shared/ipc-types';
import { CategoriesService } from '../../core/services/categories.service';
import { AppDatePipe } from '../../shared/pipes/app-date.pipe';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { CategoryFormDialog } from './category-form.dialog';

@Component({
  selector: 'app-categories-page',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    AppDatePipe,
  ],
  templateUrl: './categories.page.html',
  styleUrl: './categories.page.scss',
})
export class CategoriesPage implements OnInit {
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  readonly svc = inject(CategoriesService);

  readonly columns = ['name', 'description', 'updatedAt', 'actions'] as const;

  ngOnInit(): void {
    void this.svc.refresh();
  }

  async create(): Promise<void> {
    const ref = this.dialog.open(CategoryFormDialog, { data: null });
    const input = await firstValueFrom(ref.afterClosed());
    if (!input) return;
    try {
      await this.svc.create(input);
      this.snack.open('Category created', 'OK', { duration: 2000 });
    } catch (err) {
      this.snack.open(err instanceof Error ? err.message : String(err), 'Dismiss', {
        duration: 4000,
      });
    }
  }

  async edit(cat: Category): Promise<void> {
    const ref = this.dialog.open(CategoryFormDialog, { data: cat });
    const patch = await firstValueFrom(ref.afterClosed());
    if (!patch) return;
    try {
      await this.svc.update(cat.id, patch);
      this.snack.open('Category updated', 'OK', { duration: 2000 });
    } catch (err) {
      this.snack.open(err instanceof Error ? err.message : String(err), 'Dismiss', {
        duration: 4000,
      });
    }
  }

  async remove(cat: Category): Promise<void> {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete category?',
        message: `Delete "${cat.name}"? Products in this category will be unassigned.`,
        destructive: true,
        confirmLabel: 'Delete',
      },
    });
    const ok = await firstValueFrom(ref.afterClosed());
    if (!ok) return;
    try {
      await this.svc.remove(cat.id);
      this.snack.open('Category deleted', 'OK', { duration: 2000 });
    } catch (err) {
      this.snack.open(err instanceof Error ? err.message : String(err), 'Dismiss', {
        duration: 4000,
      });
    }
  }
}
