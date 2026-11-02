import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type {
  NewProduct,
  Product,
  ProductImportResult,
  ProductImportRow,
  ProductPatch,
} from '../../shared/ipc-types';
import { MAX_IMPORT_ROWS, productImportService } from '../services/product-import.service';
import { productsRepository } from '../services/products.repository';
import { assertNumber, assertObject, assertString, handle } from './ipc-wrapper';

function parseNewProduct(raw: unknown): NewProduct {
  const o = assertObject(raw, 'product');
  return {
    sku: assertString(o['sku'], 'sku'),
    barcode: o['barcode'] === null ? null : o['barcode'] ? assertString(o['barcode'], 'barcode') : null,
    name: assertString(o['name'], 'name'),
    categoryId: o['categoryId'] === null || o['categoryId'] === undefined
      ? null
      : assertNumber(o['categoryId'], 'categoryId'),
    unitPrice: assertNumber(o['unitPrice'], 'unitPrice'),
    costPrice: assertNumber(o['costPrice'], 'costPrice'),
    taxRate: assertNumber(o['taxRate'], 'taxRate'),
    imagePath: o['imagePath'] === null || o['imagePath'] === undefined
      ? null
      : assertString(o['imagePath'], 'imagePath'),
    isActive: (o['isActive'] === 1 || o['isActive'] === 0 ? o['isActive'] : 1) as 0 | 1,
  };
}

function parsePatch(raw: unknown): ProductPatch {
  const o = assertObject(raw, 'patch');
  const patch: ProductPatch = {};
  if ('sku' in o) patch.sku = assertString(o['sku'], 'sku');
  if ('barcode' in o) patch.barcode = o['barcode'] === null ? null : assertString(o['barcode'], 'barcode');
  if ('name' in o) patch.name = assertString(o['name'], 'name');
  if ('categoryId' in o)
    patch.categoryId = o['categoryId'] === null ? null : assertNumber(o['categoryId'], 'categoryId');
  if ('unitPrice' in o) patch.unitPrice = assertNumber(o['unitPrice'], 'unitPrice');
  if ('costPrice' in o) patch.costPrice = assertNumber(o['costPrice'], 'costPrice');
  if ('taxRate' in o) patch.taxRate = assertNumber(o['taxRate'], 'taxRate');
  if ('imagePath' in o)
    patch.imagePath = o['imagePath'] === null ? null : assertString(o['imagePath'], 'imagePath');
  if ('isActive' in o) patch.isActive = (o['isActive'] ? 1 : 0) as 0 | 1;
  return patch;
}

function parseImportRows(raw: unknown): ProductImportRow[] {
  if (!Array.isArray(raw)) throw new Error('rows must be an array');
  if (raw.length > MAX_IMPORT_ROWS) {
    throw new Error(`Import at most ${MAX_IMPORT_ROWS} products at a time`);
  }
  return raw.map((row, i) => {
    const o = assertObject(row, `rows[${i}]`);
    const name = assertString(o['name'], `rows[${i}].name`).trim();
    if (!name || name.length > 140) throw new Error(`Line ${i + 1}: name must be 1–140 characters`);
    const category =
      o['category'] === null || o['category'] === undefined
        ? ''
        : assertString(o['category'], `rows[${i}].category`).trim();
    if (category.length > 100) throw new Error(`Line ${i + 1}: category is too long`);
    const price = (key: 'unitPrice' | 'costPrice') => {
      const n = o[key] === undefined ? 0 : assertNumber(o[key], `rows[${i}].${key}`);
      if (n < 0) throw new Error(`Line ${i + 1}: prices can't be negative`);
      return n;
    };
    return {
      category: category || null,
      name,
      unitPrice: price('unitPrice'),
      costPrice: price('costPrice'),
    };
  });
}

export function registerProductsIpc(): void {
  handle<[], Product[]>(IPC_CHANNELS.products.list, () => productsRepository.list());

  handle<[number], Product | null>(IPC_CHANNELS.products.get, (_e, id) =>
    productsRepository.get(assertNumber(id, 'id'))
  );

  handle<[unknown], Product>(IPC_CHANNELS.products.create, (_e, input) =>
    productsRepository.create(parseNewProduct(input))
  );

  handle<[number, unknown], Product>(IPC_CHANNELS.products.update, (_e, id, patch) =>
    productsRepository.update(assertNumber(id, 'id'), parsePatch(patch))
  );

  handle<[number], { id: number }>(IPC_CHANNELS.products.remove, (_e, id) =>
    productsRepository.remove(assertNumber(id, 'id'))
  );

  handle<[unknown], ProductImportResult>(IPC_CHANNELS.products.import, (_e, rows) =>
    productImportService.import(parseImportRows(rows))
  );
}
