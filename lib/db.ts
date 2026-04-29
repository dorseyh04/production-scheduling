import { sql } from "@vercel/postgres";

// 建表(首次调用时自动创建,幂等)
export async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS production_lines (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      work_days JSONB NOT NULL DEFAULT '[]',
      shifts JSONB NOT NULL DEFAULT '[]',
      maintenances JSONB NOT NULL DEFAULT '[]',
      remark TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS production_orders (
      id TEXT PRIMARY KEY,
      order_no TEXT NOT NULL,
      line_id TEXT NOT NULL,
      product_model TEXT NOT NULL,
      planned_start TIMESTAMPTZ NOT NULL,
      planned_end TIMESTAMPTZ NOT NULL,
      quantity NUMERIC NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      remark TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}
