import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type {
  ProductionLine,
  ProductionOrder,
  CapacityLight,
} from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 生成唯一 ID
export function genId(prefix = "id"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// 格式化日期为 datetime-local input 格式
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

// 从 datetime-local 转 ISO
export function fromLocalInput(local: string): string {
  if (!local) return "";
  return new Date(local).toISOString();
}

// 格式化显示
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// 计算两个时间的小时差
export function hoursBetween(startIso: string, endIso: string): number {
  return (new Date(endIso).getTime() - new Date(startIso).getTime()) / 3600000;
}

// 判断两订单时间是否冲突(同产线)
export function isOverlap(
  a: { plannedStart: string; plannedEnd: string },
  b: { plannedStart: string; plannedEnd: string }
): boolean {
  const aStart = new Date(a.plannedStart).getTime();
  const aEnd = new Date(a.plannedEnd).getTime();
  const bStart = new Date(b.plannedStart).getTime();
  const bEnd = new Date(b.plannedEnd).getTime();
  return aStart < bEnd && bStart < aEnd;
}

// 检查订单是否在产线运营时间内
export function isWithinLineCalendar(
  line: ProductionLine,
  startIso: string,
  endIso: string
): { ok: boolean; reason?: string } {
  const start = new Date(startIso);
  const end = new Date(endIso);

  if (end <= start) {
    return { ok: false, reason: "完工时间必须晚于开工时间" };
  }

  // 检查工作日
  const dow = start.getDay();
  if (!line.workDays.includes(dow)) {
    return {
      ok: false,
      reason: `${line.id} 在星期${["日", "一", "二", "三", "四", "五", "六"][dow]}不排产`,
    };
  }

  // 检查班次:订单起止时间须在某个班次范围内
  const startHM = start.getHours() * 60 + start.getMinutes();
  const endHM = end.getHours() * 60 + end.getMinutes();
  const toMin = (hm: string) => {
    const [h, m] = hm.split(":").map(Number);
    return h * 60 + m;
  };

  // 若订单跨日,仅简单校验开工时间在某班次起点之后
  const sameDay = start.toDateString() === end.toDateString();
  if (sameDay) {
    const inShift = line.shifts.some((s) => {
      const ss = toMin(s.start);
      const se = toMin(s.end);
      return startHM >= ss && endHM <= se;
    });
    if (!inShift && line.shifts.length > 0) {
      const ranges = line.shifts.map((s) => `${s.start}–${s.end}`).join(", ");
      return {
        ok: false,
        reason: `${line.id} 当日运营时段为 ${ranges},不可排产在此时间`,
      };
    }
  }

  // 检查维护窗口
  for (const m of line.maintenances) {
    if (m.dayOfWeek !== dow) continue;
    const ms = toMin(m.start);
    const me = toMin(m.end);
    if (startHM < me && endHM > ms) {
      return {
        ok: false,
        reason: `与 ${line.id} 维护窗口冲突 (星期${
          ["日", "一", "二", "三", "四", "五", "六"][dow]
        } ${m.start}-${m.end})`,
      };
    }
  }

  return { ok: true };
}

// 检查该订单与同产线其他订单冲突
export function findConflicts(
  order: Pick<ProductionOrder, "id" | "lineId" | "plannedStart" | "plannedEnd">,
  allOrders: ProductionOrder[]
): ProductionOrder[] {
  return allOrders.filter(
    (o) =>
      o.id !== order.id &&
      o.lineId === order.lineId &&
      o.status !== "completed" &&
      isOverlap(o, order)
  );
}

// 计算产线容量状态灯
// 逻辑:取该产线最晚排产订单的完工时间与当前时间的差值
export function calcCapacityLight(
  lineId: string,
  orders: ProductionOrder[]
): CapacityLight {
  const now = Date.now();
  const lineOrders = orders.filter(
    (o) => o.lineId === lineId && o.status !== "completed"
  );
  if (lineOrders.length === 0) return "red";

  const latestEnd = Math.max(
    ...lineOrders.map((o) => new Date(o.plannedEnd).getTime())
  );
  const daysAhead = (latestEnd - now) / 86400000;

  if (daysAhead > 7) return "green";
  if (daysAhead < 2) return "red";
  return "yellow";
}

// 获取容量状态灯描述
export function capacityLightText(light: CapacityLight): string {
  switch (light) {
    case "green":
      return "排产充足(>7天)";
    case "yellow":
      return "排产适中(2-7天)";
    case "red":
      return "排产紧张(<2天)";
  }
}
