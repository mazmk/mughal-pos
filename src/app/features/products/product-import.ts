import type { ProductImportRow } from '../../../../shared/ipc-types';

export interface ParsedImport {
  rows: ProductImportRow[];
  /** One message per bad line, with its line number. */
  errors: string[];
}

/** Splits one CSV line, honouring "quoted, fields" and "" as an escaped quote. */
function splitCsv(line: string): string[] {
  const fields: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      fields.push(field);
      field = '';
    } else {
      field += c;
    }
  }
  fields.push(field);
  return fields;
}

const HEADER_NAMES = new Set(['name', 'product', 'product name', 'item']);

/**
 * Reads `Category, Product name[, price, cost]` lines: a CSV file, or columns
 * pasted from Excel or Google Sheets (tab-separated). A header row is skipped,
 * and a line with a single column is a product with no category.
 */
export function parseProductLines(text: string): ParsedImport {
  const rows: ProductImportRow[] = [];
  const errors: string[] = [];

  text.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    const cells = (line.includes('\t') ? line.split('\t') : splitCsv(line)).map((c) => c.trim());
    const [category, name, price, cost] = cells.length === 1 ? ['', cells[0]] : cells;
    const lineNo = index + 1;

    if (rows.length === 0 && errors.length === 0 && HEADER_NAMES.has(name?.toLowerCase() ?? '')) {
      return;
    }
    if (!name) {
      errors.push(`Line ${lineNo}: no product name`);
      return;
    }
    if (name.length > 140) {
      errors.push(`Line ${lineNo}: product name is longer than 140 characters`);
      return;
    }
    const unitPrice = price ? Number(price) : 0;
    const costPrice = cost ? Number(cost) : 0;
    if (!Number.isFinite(unitPrice) || unitPrice < 0 || !Number.isFinite(costPrice) || costPrice < 0) {
      errors.push(`Line ${lineNo}: price and cost must be numbers, 0 or more`);
      return;
    }
    rows.push({ category: category || null, name, unitPrice, costPrice });
  });

  return { rows, errors };
}
