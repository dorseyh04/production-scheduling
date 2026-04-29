import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";
import { ensureTables } from "@/lib/db";

export async function GET() {
  try {
    await ensureTables();
    const { rows } = await sql`
      SELECT id, name, work_days, shifts, maintenances, remark, created_at
      FROM production_lines
      ORDER BY created_at ASC
    `;
    const lines = rows.map((r) => ({
      id: r.id,
      name: r.name,
      workDays: r.work_days,
      shifts: r.shifts,
      maintenances: r.maintenances,
      remark: r.remark || undefined,
      createdAt: r.created_at,
    }));
    return NextResponse.json(lines);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTables();
    const body = await req.json();
    const { id, name, workDays, shifts, maintenances, remark } = body;

    if (!id || !name) {
      return NextResponse.json({ error: "id and name required" }, { status: 400 });
    }

    // UPSERT
    await sql`
      INSERT INTO production_lines (id, name, work_days, shifts, maintenances, remark, created_at)
      VALUES (${id}, ${name}, ${JSON.stringify(workDays)}::jsonb, ${JSON.stringify(shifts)}::jsonb, ${JSON.stringify(maintenances)}::jsonb, ${remark || null}, NOW())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        work_days = EXCLUDED.work_days,
        shifts = EXCLUDED.shifts,
        maintenances = EXCLUDED.maintenances,
        remark = EXCLUDED.remark
    `;

    return NextResponse.json({ ok: true });
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
    await sql`DELETE FROM production_lines WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
