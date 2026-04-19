// 订单状态
export type OrderStatus = "pending" | "running" | "completed" | "paused";

// 状态中文映射
export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "待启动",
  running: "进行中",
  completed: "已完成",
  paused: "已暂停",
};

export const STATUS_COLOR: Record<OrderStatus, string> = {
  pending: "#94a3b8",   // slate-400
  running: "#3b82f6",   // blue-500
  completed: "#10b981", // emerald-500
  paused: "#f59e0b",    // amber-500
};

// 生产订单
export interface ProductionOrder {
  id: string;              // 自动生成的内部 ID
  orderNo: string;         // 订单编号(用户录入)
  lineId: string;          // 关联产线 ID
  productModel: string;    // 产品型号
  plannedStart: string;    // 计划开工时间(ISO 字符串)
  plannedEnd: string;      // 计划完工时间(ISO 字符串)
  quantity: number;        // 批量数量(kg)
  status: OrderStatus;
  remark?: string;
  createdAt: string;
}

// 班次定义
export interface Shift {
  name: string;       // 班次名称,如 "早班"
  start: string;      // HH:mm
  end: string;        // HH:mm
}

// 维护窗口
export interface MaintenanceWindow {
  dayOfWeek: number;  // 0=周日, 1=周一, ... 6=周六
  start: string;      // HH:mm
  end: string;        // HH:mm
  note?: string;
}

// 产线
export interface ProductionLine {
  id: string;               // 产线编号(如 "1#" "超声波复合")
  name: string;             // 产线名称(可与 id 相同)
  workDays: number[];       // 工作日 [1,2,3,4,5] 表示周一至周五
  shifts: Shift[];          // 班次
  maintenances: MaintenanceWindow[];
  remark?: string;
  createdAt: string;
}

// 视图模式
export type ViewMode = "day" | "week" | "month";

// 容量状态灯
export type CapacityLight = "green" | "yellow" | "red";
