import { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type {
  AttachmentFile,
  AttachmentMimeType,
  DateRange,
  Expense,
  ExpensePatch,
  ExpenseType,
  NewExpense,
} from '../../shared/ipc-types';
import { attachmentsService } from '../services/attachments.service';
import { expensesService } from '../services/expenses.service';
import { assertNumber, assertObject, assertString, handle } from './ipc-wrapper';

const VALID_TYPES: readonly ExpenseType[] = ['utility', 'stock', 'staff', 'other'];
const VALID_MIME: readonly AttachmentMimeType[] = ['image/jpeg', 'application/pdf'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDateRange(raw: unknown): DateRange {
  const o = assertObject(raw, 'range');
  const from = assertString(o['from'], 'from');
  const to = assertString(o['to'], 'to');
  if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) throw new Error('Dates must be yyyy-mm-dd');
  return { from, to };
}

/** Any ISO instant → SQLite's UTC `YYYY-MM-DD HH:MM:SS`, the format datetime('now') writes. */
function parseInstant(raw: unknown, field: string): string {
  const time = Date.parse(assertString(raw, field));
  if (Number.isNaN(time)) throw new Error(`Invalid ${field}: expected a date`);
  return new Date(time).toISOString().slice(0, 19).replace('T', ' ');
}

function parseAttachments(raw: unknown): AttachmentFile[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) throw new Error('addAttachments must be an array');
  return raw.map((row, i) => {
    const o = assertObject(row, `addAttachments[${i}]`);
    const mimeType = assertString(o['mimeType'], `addAttachments[${i}].mimeType`);
    if (!(VALID_MIME as readonly string[]).includes(mimeType)) {
      throw new Error(`Unsupported attachment type: ${mimeType}`);
    }
    return {
      fileName: assertString(o['fileName'], `addAttachments[${i}].fileName`),
      mimeType: mimeType as AttachmentMimeType,
      dataBase64: assertString(o['dataBase64'], `addAttachments[${i}].dataBase64`),
    };
  });
}

function parseNewExpense(raw: unknown): NewExpense {
  const o = assertObject(raw, 'expense');
  const type = assertString(o['type'], 'type');
  if (!(VALID_TYPES as readonly string[]).includes(type)) {
    throw new Error(`Invalid expense type: ${type}`);
  }
  const description =
    o['description'] === null || o['description'] === undefined
      ? ''
      : assertString(o['description'], 'description').trim();
  return {
    type: type as ExpenseType,
    amount: assertNumber(o['amount'], 'amount'),
    description: description || null,
    incurredAt: parseInstant(o['incurredAt'], 'incurredAt'),
    addAttachments: parseAttachments(o['addAttachments']),
  };
}

function parsePatch(raw: unknown): ExpensePatch {
  const o = assertObject(raw, 'patch');
  const remove = o['removeAttachmentIds'] ?? [];
  if (!Array.isArray(remove)) throw new Error('removeAttachmentIds must be an array');
  return {
    ...parseNewExpense(o),
    removeAttachmentIds: remove.map((id, i) => assertNumber(id, `removeAttachmentIds[${i}]`)),
  };
}

export function registerExpensesIpc(): void {
  handle<[unknown], Expense[]>(IPC_CHANNELS.expenses.list, (_e, range) =>
    expensesService.list(parseDateRange(range))
  );
  handle<[unknown], Expense>(IPC_CHANNELS.expenses.create, (_e, input) =>
    expensesService.create(parseNewExpense(input))
  );
  handle<[number, unknown], Expense>(IPC_CHANNELS.expenses.update, (_e, id, patch) =>
    expensesService.update(assertNumber(id, 'id'), parsePatch(patch))
  );
  handle<[number], { id: number }>(IPC_CHANNELS.expenses.remove, (_e, id) =>
    expensesService.remove(assertNumber(id, 'id'))
  );
  handle<[], AttachmentFile[]>(IPC_CHANNELS.expenses.pickAttachments, (e) =>
    attachmentsService.pick(BrowserWindow.fromWebContents(e.sender))
  );
  handle<[number], AttachmentFile>(IPC_CHANNELS.expenses.attachment, (_e, id) =>
    expensesService.attachment(assertNumber(id, 'id'))
  );
  handle<[number], void>(IPC_CHANNELS.expenses.openAttachment, (_e, id) =>
    expensesService.openAttachment(assertNumber(id, 'id'))
  );
}
