import type { ProductionLine, ProductionOrder } from "@/types";

const LINES_KEY = "ps_lines_v1";
const ORDERS_KEY = "ps_orders_v1";

function safeRead<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWrite(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("Storage write failed:", e);
  }
}

export const storage = {
  loadLines(): ProductionLine[] {
    return safeRead<ProductionLine[]>(LINES_KEY, []);
  },
  saveLines(lines: ProductionLine[]) {
    safeWrite(LINES_KEY, lines);
  },
  loadOrders(): ProductionOrder[] {
    return safeRead<ProductionOrder[]>(ORDERS_KEY, []);
  },
  saveOrders(orders: ProductionOrder[]) {
    safeWrite(ORDERS_KEY, orders);
  },
  // 导出全部数据(备份)
  exportAll() {
    return {
      lines: this.loadLines(),
      orders: this.loadOrders(),
      exportedAt: new Date().toISOString(),
    };
  },
  // 导入数据
  importAll(data: { lines?: ProductionLine[]; orders?: ProductionOrder[] }) {
    if (data.lines) this.saveLines(data.lines);
    if (data.orders) this.saveOrders(data.orders);
  },
};

// 初始化默认产线(首次加载时)
export function seedDefaultLinesIfEmpty() {
  const lines = storage.loadLines();
  if (lines.length > 0) return;

  const now = new Date().toISOString();
  const defaults: ProductionLine[] = [
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
      createdAt: now,
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
      createdAt: now,
    },
    {
      id: "超声波复合",
      name: "超声波复合线",
      workDays: [1, 2, 3, 4, 5, 6],
      shifts: [{ name: "白班", start: "08:00", end: "18:00" }],
      maintenances: [],
      createdAt: now,
    },
    {
      id: "热熔胶复合",
      name: "热熔胶复合线",
      workDays: [1, 2, 3, 4, 5, 6],
      shifts: [{ name: "白班", start: "08:00", end: "18:00" }],
      maintenances: [],
      createdAt: now,
    },
  ];
  storage.saveLines(defaults);
}
