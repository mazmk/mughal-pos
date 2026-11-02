import { getDatabase } from '../database/connection';
import type {
  AttachmentFile,
  AttachmentMimeType,
  DateRange,
  Expense,
  ExpenseAttachment,
  ExpensePatch,
  NewExpense,
} from '../../shared/ipc-types';
import { attachmentsService } from './attachments.service';

const MAX_ATTACHMENTS = 10;

interface ExpenseRow {
  id: number;
  type: Expense['type'];
  amount: number;
  description: string | null;
  incurred_at: string;
  created_at: string;
  updated_at: string;
}

interface AttachmentRow {
  id: number;
  expense_id: number;
  file_name: string;
  mime_type: AttachmentMimeType;
  size_bytes: number;
  created_at: string;
}

// Never select `data` here: lists stay light, bytes load one file at a time.
const ATTACHMENT_COLUMNS = `id, expense_id, file_name, mime_type, size_bytes, created_at`;

const toAttachment = (r: AttachmentRow): ExpenseAttachment => ({
  id: r.id,
  expenseId: r.expense_id,
  fileName: r.file_name,
  mimeType: r.mime_type,
  sizeBytes: r.size_bytes,
  createdAt: r.created_at,
});

const toExpense = (r: ExpenseRow, attachments: ExpenseAttachment[]): Expense => ({
  id: r.id,
  type: r.type,
  amount: r.amount,
  description: r.description,
  incurredAt: r.incurred_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  attachments,
});

function load(id: number): Expense | null {
  const db = getDatabase();
  const row = db.prepare(`SELECT * FROM expenses WHERE id = ?`).get(id) as ExpenseRow | undefined;
  if (!row) return null;
  const attachments = db
    .prepare(`SELECT ${ATTACHMENT_COLUMNS} FROM expense_attachments WHERE expense_id = ? ORDER BY id`)
    .all(id) as AttachmentRow[];
  return toExpense(row, attachments.map(toAttachment));
}

function validate(input: NewExpense): void {
  if (!(input.amount > 0)) throw new Error('Expense amount must be more than 0');
}

function addAttachments(expenseId: number, files: AttachmentFile[]): void {
  const db = getDatabase();
  const count = (
    db
      .prepare(`SELECT COUNT(*) AS n FROM expense_attachments WHERE expense_id = ?`)
      .get(expenseId) as { n: number }
  ).n;
  if (count + files.length > MAX_ATTACHMENTS) {
    throw new Error(`An expense can have at most ${MAX_ATTACHMENTS} attachments`);
  }
  const insert = db.prepare(
    `INSERT INTO expense_attachments (expense_id, file_name, mime_type, size_bytes, data)
     VALUES (?, ?, ?, ?, ?)`
  );
  for (const file of files) {
    const { fileName, mimeType, data } = attachmentsService.decode(file);
    insert.run(expenseId, fileName, mimeType, data.length, data);
  }
}

export const expensesService = {
  list(range: DateRange): Expense[] {
    const db = getDatabase();
    const inRange = `date(incurred_at, 'localtime') BETWEEN date(?) AND date(?)`;
    const rows = db
      .prepare(`SELECT * FROM expenses WHERE ${inRange} ORDER BY incurred_at DESC, id DESC`)
      .all(range.from, range.to) as ExpenseRow[];
    const attachments = db
      .prepare(
        `SELECT ${ATTACHMENT_COLUMNS} FROM expense_attachments
         WHERE expense_id IN (SELECT id FROM expenses WHERE ${inRange})
         ORDER BY id`
      )
      .all(range.from, range.to) as AttachmentRow[];

    const byExpense = new Map<number, ExpenseAttachment[]>();
    for (const a of attachments) {
      const list = byExpense.get(a.expense_id) ?? [];
      list.push(toAttachment(a));
      byExpense.set(a.expense_id, list);
    }
    return rows.map((r) => toExpense(r, byExpense.get(r.id) ?? []));
  },

  create(input: NewExpense): Expense {
    validate(input);
    const db = getDatabase();
    const id = db.transaction(() => {
      const result = db
        .prepare(
          `INSERT INTO expenses (type, amount, description, incurred_at)
           VALUES (@type, @amount, @description, @incurredAt)`
        )
        .run({
          type: input.type,
          amount: input.amount,
          description: input.description,
          incurredAt: input.incurredAt,
        });
      const expenseId = Number(result.lastInsertRowid);
      addAttachments(expenseId, input.addAttachments);
      return expenseId;
    })();

    const created = load(id);
    if (!created) throw new Error(`Expense ${id} not found after insert`);
    return created;
  },

  update(id: number, patch: ExpensePatch): Expense {
    validate(patch);
    const db = getDatabase();
    db.transaction(() => {
      const result = db
        .prepare(
          `UPDATE expenses
             SET type = @type, amount = @amount, description = @description,
                 incurred_at = @incurredAt, updated_at = datetime('now')
           WHERE id = @id`
        )
        .run({
          id,
          type: patch.type,
          amount: patch.amount,
          description: patch.description,
          incurredAt: patch.incurredAt,
        });
      if (result.changes === 0) throw new Error(`Expense ${id} not found`);

      const remove = db.prepare(`DELETE FROM expense_attachments WHERE id = ? AND expense_id = ?`);
      for (const attachmentId of patch.removeAttachmentIds) remove.run(attachmentId, id);
      addAttachments(id, patch.addAttachments);
    })();

    const updated = load(id);
    if (!updated) throw new Error(`Expense ${id} not found after update`);
    return updated;
  },

  /** Hard delete; its attachments go with it (ON DELETE CASCADE). */
  remove(id: number): { id: number } {
    getDatabase().prepare(`DELETE FROM expenses WHERE id = ?`).run(id);
    return { id };
  },

  attachment(id: number): AttachmentFile {
    const row = this.attachmentData(id);
    return { fileName: row.fileName, mimeType: row.mimeType, dataBase64: row.data.toString('base64') };
  },

  async openAttachment(id: number): Promise<void> {
    await attachmentsService.open(id, this.attachmentData(id));
  },

  attachmentData(id: number): { fileName: string; mimeType: AttachmentMimeType; data: Buffer } {
    const row = getDatabase()
      .prepare(`SELECT file_name, mime_type, data FROM expense_attachments WHERE id = ?`)
      .get(id) as { file_name: string; mime_type: AttachmentMimeType; data: Buffer } | undefined;
    if (!row) throw new Error(`Attachment ${id} not found`);
    return { fileName: row.file_name, mimeType: row.mime_type, data: row.data };
  },
};
