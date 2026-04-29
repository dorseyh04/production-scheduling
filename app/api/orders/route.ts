import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";
import { ensureTables } from "@/lib/db";

export async function GET() {
  try {
    await ensureTables();
    const { rows } = await sql`
      SELECT id, order_no, line_id, product_model,
             planned_start, planned_end, quantity,
             status, remark, created_at
      FROM production_orders
      ORDER BY planned_start ASC
    `;
    const orders = rows.map((r) => ({
      id: r.id,
      orderNo: r.order_no,
      lineId: r.line_id,
      productModel: r.product_model,
      plannedStart: r.planned_start,
      plannedEnd: r.planned_end,
      quantity: Number(r.quantity),
      status: r.status,
      remark: r.remark || undefined,
      createdAt: r.created_at,
    }));
    return NextResponse.json(orders);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTables();
    const body = await req.json();

    // 支持单条或批量
    const items: any[] = Array.isArray(body) ? body : [body];

    for (const o of items) {
      const {
        id,
        orderNo,
        lineId,
        productModel,
        plannedStart,
        plannedEnd,
        quantity,
        status,
        remark,
      } = o;

      if (!id || !orderNo || !lineId || !productModel) {
        return NextResponse.json(
          { error: "Missing required fields" },
          { status: 400 }
        );
      }

      await sql`
        INSERT INTO production_orders
          (id, order_no, line_id, product_model, planned_start, planned_end, quantity, status, remark, created_at)
        VALUES
          (${id}, ${orderNo}, ${lineId}, ${productModel}, ${plannedStart}, ${plannedEnd}, ${quantity}, ${status || "pending"}, ${remark || null}, NOW())
        ON CONFLICT (id) DO UPDATE SET
          order_no = EXCLUDED.order_no,
          line_id = EXCLUDED.line_id,
          product_model = EXCLUDED.product_model,
          planned_start = EXCLUDED.planned_start,
          planned_end = EXCLUDED.planned_end,
          quantity = EXCLUDED.quantity,
          status = EXCLUDED.status,
          remark = EXCLUDED.remark
      `;
    }

    return NextResponse.json({ ok: true, count: items.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await ensureTables();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    await sql`DELETE FROM production_orders WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
