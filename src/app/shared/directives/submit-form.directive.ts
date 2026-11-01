import { Directive, ElementRef, inject, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormGroupDirective } from '@angular/forms';

const INVALID_FIELD = 'input.ng-invalid, textarea.ng-invalid, mat-select.ng-invalid';

/**
 * Use `(appSubmit)` instead of `(ngSubmit)` on reactive forms, with a submit
 * button that is never disabled for being invalid. Enter then always does
 * something: it saves, or shows the errors and moves to the first bad field.
 * Enter adds a line in a textarea, so Ctrl/Cmd+Enter saves from anywhere.
 *
 * A submit button outside the <form> (dialog actions) joins it with `form="<id>"`.
 */
@Directive({
  selector: 'form[appSubmit]',
  standalone: true,
  host: {
    '(keydown.control.enter)': 'submit($event)',
    '(keydown.meta.enter)': 'submit($event)',
  },
})
export class SubmitFormDirective {
  readonly appSubmit = output<void>();

  private readonly group = inject(FormGroupDirective);
  private readonly form = inject<ElementRef<HTMLFormElement>>(ElementRef).nativeElement;

  constructor() {
    this.group.ngSubmit.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.group.form.valid) {
        this.appSubmit.emit();
        return;
      }
      this.group.form.markAllAsTouched();
      this.form.querySelector<HTMLElement>(INVALID_FIELD)?.focus();
    });
  }

  submit(event: Event): void {
    event.preventDefault();
    this.form.requestSubmit();
  }
}
