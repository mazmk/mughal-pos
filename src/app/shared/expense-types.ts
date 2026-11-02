import type { ExpenseType } from '../../../shared/ipc-types';

export interface ExpenseTypeOption {
  readonly value: ExpenseType;
  readonly label: string;
  readonly icon: string;
  /** Hint under the details field in the expense form. */
  readonly hint: string;
}

export const EXPENSE_TYPES: readonly ExpenseTypeOption[] = [
  { value: 'utility', label: 'Utility bill', icon: 'bolt', hint: 'e.g. Electricity bill for October' },
  { value: 'stock', label: 'Bought stock', icon: 'inventory_2', hint: 'e.g. Who you bought from and what' },
  { value: 'staff', label: 'Taken by team member', icon: 'person', hint: 'Who took the money, and why' },
  { value: 'other', label: 'Other', icon: 'more_horiz', hint: 'What the money was spent on' },
];

const BY_VALUE = new Map(EXPENSE_TYPES.map((t) => [t.value, t]));

export function expenseType(value: ExpenseType): ExpenseTypeOption {
  return BY_VALUE.get(value) ?? EXPENSE_TYPES[EXPENSE_TYPES.length - 1];
}
