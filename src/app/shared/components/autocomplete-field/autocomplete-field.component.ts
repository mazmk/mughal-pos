import {
  AfterContentInit,
  Component,
  DoCheck,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  NgControl,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import type { ErrorStateMatcher } from '@angular/material/core';
import {
  MatAutocompleteModule,
  type MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import type { SubscriptSizing } from '@angular/material/form-field';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInput, MatInputModule } from '@angular/material/input';

export interface AutocompleteOption<T> {
  readonly value: T;
  readonly label: string;
  readonly icon?: string;
}

/**
 * The app's dropdown: a text field that lists matching options as you type.
 * Use it with formControlName or ngModel, as you would a mat-select. The
 * control only ever holds an option's value (or null when `clearable`).
 *
 * Text that matches no option is an error rather than being thrown away, so
 * a half-typed entry can't be saved by accident. Leaving the field empty
 * clears a `clearable` one, and puts the last choice back on any other.
 */
@Component({
  selector: 'app-autocomplete-field',
  standalone: true,
  imports: [MatFormFieldModule, MatInputModule, MatAutocompleteModule, MatIconModule, MatButtonModule],
  host: { class: 'block' },
  template: `
    <mat-form-field appearance="outline" class="!w-full" [subscriptSizing]="subscriptSizing()">
      <mat-label>{{ label() }}</mat-label>
      @if (selectedIcon(); as icon) {
        <mat-icon matIconPrefix class="!ml-3 !mr-1">{{ icon }}</mat-icon>
      }
      <input
        #field
        matInput
        autocomplete="off"
        [placeholder]="placeholder()"
        [value]="text()"
        [disabled]="disabled()"
        [required]="required()"
        [errorStateMatcher]="errorState"
        [class.ng-invalid]="ngControl?.invalid"
        [matAutocomplete]="auto"
        (input)="onInput(field.value)"
        (focus)="onFocus(field)"
        (mouseup)="onMouseup($event)"
        (blur)="onBlur()"
      />
      @if (clearable() && text() && !disabled()) {
        <button
          mat-icon-button
          matSuffix
          type="button"
          [attr.aria-label]="'Clear ' + label()"
          (click)="clear(); field.focus()"
        >
          <mat-icon>close</mat-icon>
        </button>
      }
      <mat-autocomplete
        #auto
        autoActiveFirstOption
        [displayWith]="labelFor"
        (optionSelected)="onSelected($event)"
      >
        @for (o of filtered(); track o.value) {
          <mat-option [value]="o.value">
            @if (o.icon) {
              <mat-icon>{{ o.icon }}</mat-icon>
            }
            {{ o.label }}
          </mat-option>
        } @empty {
          <mat-option disabled>No matches</mat-option>
        }
      </mat-autocomplete>
      @if (hint(); as hint) {
        <mat-hint>{{ hint }}</mat-hint>
      }
      <mat-error>{{ error() }}</mat-error>
    </mat-form-field>
  `,
})
export class AutocompleteFieldComponent<T> implements ControlValueAccessor, AfterContentInit, DoCheck {
  readonly ngControl = inject(NgControl, { self: true, optional: true });

  readonly label = input.required<string>();
  readonly options = input.required<readonly AutocompleteOption<T>[]>();
  readonly placeholder = input('Type to search');
  readonly hint = input<string | null>(null);
  readonly error = input('Pick an option from the list');
  /** Allow an empty field, which sets the control to null. */
  readonly clearable = input(false, { transform: booleanAttribute });
  readonly subscriptSizing = input<SubscriptSizing>('fixed');

  readonly value = signal<T | null>(null);
  readonly text = signal('');
  readonly disabled = signal(false);
  /** True while the text is the user's own typing, not the chosen option's label. */
  private readonly typing = signal(false);

  // Optional: ngDoCheck first runs before this component's view exists.
  private readonly matInput = viewChild(MatInput);
  private justFocused = false;
  private onChange: (value: T | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  readonly selectedIcon = computed(() => {
    const v = this.value();
    return this.typing() ? null : (this.options().find((o) => o.value === v)?.icon ?? null);
  });

  /** All options until the user types; then those containing every typed word. */
  readonly filtered = computed(() => {
    const text = this.text();
    const options = this.options();
    if (text === this.labelFor(this.value())) return options;
    const words = text.toLowerCase().split(/\s+/).filter(Boolean);
    return options.filter((o) => words.every((w) => o.label.toLowerCase().includes(w)));
  });

  readonly errorState: ErrorStateMatcher = {
    isErrorState: () => !!this.ngControl?.invalid && !!this.ngControl.touched,
  };

  constructor() {
    if (this.ngControl) this.ngControl.valueAccessor = this;
    // Options often load after the value is set (categories from the database),
    // so show the label once it exists.
    effect(() => {
      this.options();
      untracked(() => {
        if (!this.typing()) this.text.set(this.labelFor(this.value()));
      });
    });
  }

  // Not ngOnInit: formControlName only attaches its control after this
  // component's own init hook has run.
  ngAfterContentInit(): void {
    this.ngControl?.control?.addValidators(this.validateText);
    this.ngControl?.control?.updateValueAndValidity({ emitEvent: false });
  }

  // MatInput only re-checks its error state when it has a form control of its
  // own. The control is on this component, so do it here: that is how a
  // submitted form shows "required" on a field nobody touched.
  ngDoCheck(): void {
    this.matInput()?.updateErrorState();
  }

  readonly labelFor = (value: T | null): string =>
    value === null ? '' : (this.options().find((o) => o.value === value)?.label ?? '');

  required(): boolean {
    return this.ngControl?.control?.hasValidator(Validators.required) ?? false;
  }

  /**
   * Select the chosen label on focus, as in a dropdown, so typing replaces it
   * instead of adding to it. A click's mouseup would undo the selection, so
   * the first one after focusing is cancelled.
   */
  onFocus(field: HTMLInputElement): void {
    field.select();
    this.justFocused = true;
  }

  onMouseup(event: MouseEvent): void {
    if (this.justFocused) event.preventDefault();
    this.justFocused = false;
  }

  onInput(text: string): void {
    this.typing.set(true);
    this.text.set(text);
    if (!text.trim() && this.clearable()) this.commit(null);
    else this.revalidate();
  }

  onSelected(event: MatAutocompleteSelectedEvent): void {
    this.commit(event.option.value as T);
  }

  /** Typing an option's full name counts as picking it. */
  onBlur(): void {
    const text = this.text().trim().toLowerCase();
    const exact = this.options().find((o) => o.label.toLowerCase() === text);
    if (exact) this.commit(exact.value);
    else if (!text) this.clearable() ? this.commit(null) : this.commit(this.value());
    this.onTouched();
    this.revalidate();
  }

  clear(): void {
    this.commit(null);
  }

  private commit(value: T | null): void {
    const changed = value !== this.value();
    this.typing.set(false);
    this.value.set(value);
    this.text.set(this.labelFor(value));
    if (changed) this.onChange(value);
    this.revalidate();
  }

  private revalidate(): void {
    this.ngControl?.control?.updateValueAndValidity();
  }

  private readonly validateText = (_: AbstractControl): ValidationErrors | null => {
    const text = this.text().trim();
    return this.typing() && text !== '' && text !== this.labelFor(this.value())
      ? { unknownOption: true }
      : null;
  };

  writeValue(value: T | null): void {
    this.typing.set(false);
    this.value.set(value ?? null);
    this.text.set(this.labelFor(value ?? null));
  }

  registerOnChange(fn: (value: T | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }
}
