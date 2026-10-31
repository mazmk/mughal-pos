import { getDatabase } from '../database/connection';
import type { NewSupplier, Supplier, SupplierPatch } from '../../shared/ipc-types';

interface Row {
  id: number;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  is_active: 0 | 1;
  created_at: string;
  updated_at: string;
}

const toSupplier = (r: Row): Supplier => ({
  id: r.id,
  name: r.name,
  contactName: r.contact_name,
  phone: r.phone,
  email: r.email,
  address: r.address,
  notes: r.notes,
  isActive: r.is_active,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const suppliersRepository = {
  list(): Supplier[] {
    const rows = getDatabase()
      .prepare(`SELECT * FROM suppliers ORDER BY name COLLATE NOCASE`)
      .all() as Row[];
    return rows.map(toSupplier);
  },

  get(id: number): Supplier | null {
    const r = getDatabase().prepare(`SELECT * FROM suppliers WHERE id = ?`).get(id) as
      | Row
      | undefined;
    return r ? toSupplier(r) : null;
  },

  create(input: NewSupplier): Supplier {
    const result = getDatabase()
      .prepare(
        `INSERT INTO suppliers
           (name, contact_name, phone, email, address, notes, is_active)
         VALUES (@name, @contactName, @phone, @email, @address, @notes, @isActive)`
      )
      .run({
        name: input.name,
        contactName: input.contactName,
        phone: input.phone,
        email: input.email,
        address: input.address,
        notes: input.notes,
        isActive: input.isActive,
      });
    const created = this.get(Number(result.lastInsertRowid));
    if (!created) throw new Error('Supplier insert succeeded but row not found');
    return created;
  },

  update(id: number, patch: SupplierPatch): Supplier {
    const map: Record<keyof SupplierPatch, string> = {
      name: 'name',
      contactName: 'contact_name',
      phone: 'phone',
      email: 'email',
      address: 'address',
      notes: 'notes',
      isActive: 'is_active',
    };
    const fields: string[] = [];
    const values: Record<string, unknown> = { id };
    for (const [key, column] of Object.entries(map) as [keyof SupplierPatch, string][]) {
      if (patch[key] !== undefined) {
        fields.push(`${column} = @${key}`);
        values[key] = patch[key];
      }
    }
    if (fields.length === 0) {
      const existing = this.get(id);
      if (!existing) throw new Error(`Supplier ${id} not found`);
      return existing;
    }
    fields.push(`updated_at = datetime('now')`);
    getDatabase()
      .prepare(`UPDATE suppliers SET ${fields.join(', ')} WHERE id = @id`)
      .run(values);
    const next = this.get(id);
    if (!next) throw new Error(`Supplier ${id} not found after update`);
    return next;
  },

  remove(id: number): { id: number } {
    getDatabase().prepare(`DELETE FROM suppliers WHERE id = ?`).run(id);
    return { id };
  },
};
