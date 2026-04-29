import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";
import { ensureTables } from "@/lib/db";

// POST /api/seed — 初始化默认产线(仅在空表时执行)
export async function POST() {
  try {
    await ensureTables();

    const { rows } = await sql`SELECT COUNT(*) as cnt FROM production_lines`;
    if (Number(rows[0].cnt) > 0) {
      return NextResponse.json({ message: "已有数据,跳过初始化", seeded: false });
    }

    const defaults = [
      {
        id: "1#",
        name: "1#生产线",
        workDays: [1, 2, 3, 4, 5],
        shifts: [
          { name: "早班", start: "08:00", end: "14:00" },
          { name: "晚班", start: "14:00", end: "20:00" },
        ],
        maintenances: [
          { dayOfWeek: 3, start: "14:00", end: "16:00", note: "预维护窗口" },
        ],
      },
      {
        id: "2#",
        name: "2#生产线",
        workDays: [1, 2, 3, 4, 5],
        shifts: [
          { name: "早班", start: "08:00", end: "14:00" },
          { name: "晚班", start: "14:00", end: "20:00" },
        ],
        maintenances: [],
      },
      {
        id: "超声波复合",
        name: "超声波复合线",
        workDays: [1, 2, 3, 4, 5, 6],
        shifts: [{ name: "白班", start: "08:00", end: "18:00" }],
        maintenances: [],
      },
      {
        id: "热熔胶复合",
        name: "热熔胶复合线",
        workDays: [1, 2, 3, 4, 5, 6],
        shifts: [{ name: "白班", start: "08:00", end: "18:00" }],
        maintenances: [],
      },
    ];

    for (const l of defaults) {
      await sql`
        INSERT INTO production_lines (id, name, work_days, shifts, maintenances, created_at)
        VALUES (${l.id}, ${l.name}, ${JSON.stringify(l.workDays)}::jsonb, ${JSON.stringify(l.shifts)}::jsonb, ${JSON.stringify(l.maintenances)}::jsonb, NOW())
        ON CONFLICT (id) DO NOTHING
      `;
    }

    return NextResponse.json({ message: "默认产线初始化完成", seeded: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
