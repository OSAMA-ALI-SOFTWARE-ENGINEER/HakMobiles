export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  colour TEXT,
  model TEXT,
  sell_price INTEGER NOT NULL DEFAULT 0,
  alert_level INTEGER,
  barcode TEXT,
  photo_path TEXT,
  purged_at TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  shop_name TEXT NOT NULL,
  contact TEXT,
  phone TEXT,
  nif TEXT,
  address TEXT,
  city TEXT,
  email TEXT,
  credit_limit INTEGER,
  status TEXT DEFAULT 'lead',
  shop_type TEXT,
  tags TEXT,
  source TEXT,
  assigned_to TEXT,
  whatsapp TEXT,
  postcode TEXT,
  payment_terms INTEGER,
  notes TEXT,
  purged_at TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact TEXT,
  phone TEXT,
  country TEXT,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  address TEXT,
  home_address TEXT,
  nif TEXT,
  whatsapp TEXT,
  purged_at TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS partners (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  share_pct INTEGER NOT NULL,
  user_id TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  supplier_id TEXT NOT NULL,
  date TEXT NOT NULL,
  invoice_no TEXT,
  extra_cost INTEGER NOT NULL DEFAULT 0,
  purged_at TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS purchase_lines (
  id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  qty INTEGER NOT NULL,
  unit_cost INTEGER NOT NULL,
  qty_received INTEGER,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  invoice_no TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  date TEXT NOT NULL,
  sold_by TEXT,
  note TEXT,
  purged_at TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS sale_lines (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  qty INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  discount INTEGER NOT NULL DEFAULT 0,
  unit_cost_at_sale INTEGER,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS stock_adjustments (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  qty INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS supplier_payments (
  id TEXT PRIMARY KEY,
  supplier_id TEXT NOT NULL,
  paid_by TEXT,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  fx_rate TEXT NOT NULL DEFAULT '1',
  amount_eur INTEGER NOT NULL,
  method TEXT,
  purpose TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS customer_payments (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  received_by TEXT,
  amount INTEGER NOT NULL,
  method TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS payment_allocations (
  id TEXT PRIMARY KEY,
  customer_payment_id TEXT NOT NULL,
  sale_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  fx_rate TEXT NOT NULL DEFAULT '1',
  amount_eur INTEGER NOT NULL,
  paid_by TEXT,
  receipt_path TEXT,
  purged_at TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS partner_transfers (
  id TEXT PRIMARY KEY,
  from_partner TEXT NOT NULL,
  to_partner TEXT NOT NULL,
  amount INTEGER NOT NULL,
  method TEXT,
  note TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL,
  value TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS outbox (
  op_id TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sync_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_seq INTEGER NOT NULL DEFAULT 0,
  pin_hash TEXT,
  pin_salt TEXT,
  pin_attempts INTEGER NOT NULL DEFAULT 0,
  invoice_counter INTEGER NOT NULL DEFAULT 0,
  invoice_prefix TEXT
);
INSERT OR IGNORE INTO sync_state (id, last_seq) VALUES (1, 0);
CREATE TABLE IF NOT EXISTS customer_activities (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  type TEXT NOT NULL,
  body TEXT,
  user_id TEXT,
  happened_at TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS follow_ups (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  title TEXT NOT NULL,
  type TEXT,
  due_at TEXT NOT NULL,
  assigned_to TEXT,
  done_at TEXT,
  auto_reason TEXT,
  notes TEXT,
  priority TEXT,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);
ALTER TABLE customers ADD COLUMN status TEXT DEFAULT 'lead';
ALTER TABLE customers ADD COLUMN shop_type TEXT;
ALTER TABLE customers ADD COLUMN tags TEXT;
ALTER TABLE customers ADD COLUMN source TEXT;
ALTER TABLE customers ADD COLUMN assigned_to TEXT;
ALTER TABLE customers ADD COLUMN whatsapp TEXT;
ALTER TABLE customers ADD COLUMN postcode TEXT;
ALTER TABLE customers ADD COLUMN payment_terms INTEGER;
ALTER TABLE customers ADD COLUMN notes TEXT;
ALTER TABLE purchases ADD COLUMN extra_cost INTEGER DEFAULT 0;
ALTER TABLE purchase_lines ADD COLUMN qty_received INTEGER;
ALTER TABLE products ADD COLUMN purged_at TEXT;
ALTER TABLE customers ADD COLUMN purged_at TEXT;
ALTER TABLE suppliers ADD COLUMN purged_at TEXT;
ALTER TABLE suppliers ADD COLUMN first_name TEXT;
ALTER TABLE suppliers ADD COLUMN last_name TEXT;
ALTER TABLE suppliers ADD COLUMN address TEXT;
ALTER TABLE suppliers ADD COLUMN home_address TEXT;
ALTER TABLE suppliers ADD COLUMN nif TEXT;
ALTER TABLE suppliers ADD COLUMN whatsapp TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS suppliers_nif_unique ON suppliers (nif);
ALTER TABLE purchases ADD COLUMN purged_at TEXT;
ALTER TABLE sales ADD COLUMN purged_at TEXT;
ALTER TABLE expenses ADD COLUMN purged_at TEXT;
`

export const MONEY_FIELDS: Record<string, string[]> = {
  products: ['sell_price'],
  customers: ['credit_limit'],
  purchases: ['extra_cost'],
  purchase_lines: ['unit_cost'],
  sale_lines: ['unit_price', 'discount', 'unit_cost_at_sale'],
  supplier_payments: ['amount', 'amount_eur'],
  customer_payments: ['amount'],
  payment_allocations: ['amount'],
  expenses: ['amount', 'amount_eur'],
  partner_transfers: ['amount'],
}

/** These money columns reject NULL. An empty amount is zero. Credit limit and cost-at-sale may stay empty. */
export const MONEY_DEFAULT_ZERO: Record<string, string[]> = {
  products: ['sell_price'],
  purchases: ['extra_cost'],
  purchase_lines: ['unit_cost'],
  sale_lines: ['unit_price', 'discount'],
  supplier_payments: ['amount', 'amount_eur'],
  customer_payments: ['amount'],
  payment_allocations: ['amount'],
  expenses: ['amount', 'amount_eur'],
  partner_transfers: ['amount'],
}

export interface Sql {
  exec(sql: string): void
  run(sql: string, params?: unknown[]): void
  all<T extends Record<string, unknown>>(sql: string, params?: unknown[]): T[]
  transaction<T>(fn: () => T): T
}
