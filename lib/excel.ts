"use client";

import * as XLSX from "xlsx";
import type { ProductionOrder } from "@/types";
import { genId } from "@/lib/utils";

// 下载 Excel 导入模板
export function downloadImportTemplate() {
  const headers = [
    "订单编号",
    "产线编号",
    "产品型号",
    "计划开工时间",
    "计划完工时间",
    "数量(kg)",
    "状态",
    "备注",
  ];
  const sample = [
    [
      "SO20240521-0087",
      "1#",
      "KNE-AP70",
      "2024-06-10 08:30",
      "2024-06-10 16:30",
      1200,
      "待启动",
      "",
    ],
    [
      "SO20240521-0088",
      "2#",
      "PBT-2001",
      "2024-06-10 14:00",
      "2024-06-11 02:00",
      1800,
      "待启动",
      "示例订单",
    ],
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...sample]);
  ws["!cols"] = [
    { wch: 20 },
    { wch: 12 },
    { wch: 16 },
    { wch: 20 },
    { wch: 20 },
    { wch: 12 },
    { wch: 10 },
    { wch: 20 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "订单导入模板");
  XLSX.writeFile(wb, "生产订单导入模板.xlsx");
}

// 中文状态 → 英文状态
function parseStatus(s: string): ProductionOrder["status"] {
  const t = (s || "").trim();
  if (t === "进行中" || t === "running") return "running";
  if (t === "已完成" || t === "completed") return "completed";
  if (t === "已暂停" || t === "paused") return "paused";
  return "pending";
}

// 解析日期字段:支持 "2024-06-10 08:30" / "2024-06-10T08:30" / Excel 序列号
function parseDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    // Excel 日期序列号
    const d = XLSX.SSF.parse_date_code(value);
    if (!d) return null;
    const iso = new Date(
      Date.UTC(d.y, d.m - 1, d.d, d.H, d.M, Math.floor(d.S))
    );
    // XLSX 返回的是 UTC,需按本地时区处理
    const local = new Date(
      iso.getTime() + iso.getTimezoneOffset() * 60000
    );
    return local.toISOString();
  }
  const s = String(value).trim().replace("T", " ");
  const match = s.match(
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[ ]?(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/
  );
  if (!match) {
    const d = new Date(s);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  }
  const [, y, mo, da, h, mi, se] = match;
  const d = new Date(
    Number(y),
    Number(mo) - 1,
    Number(da),
    Number(h),
    Number(mi),
    Number(se || 0)
  );
  return d.toISOString();
}

export interface ImportResult {
  success: ProductionOrder[];
  errors: { row: number; message: string }[];
}

// 从 Excel 解析订单
export async function parseOrdersFromExcel(file: File): Promise<ImportResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: "",
  });

  const result: ImportResult = { success: [], errors: [] };

  rows.forEach((row, idx) => {
    const rowNum = idx + 2; // Excel 从 1 开始,表头占 1 行
    try {
      const orderNo = String(row["订单编号"] || "").trim();
      const lineId = String(row["产线编号"] || "").trim();
      const productModel = String(row["产品型号"] || "").trim();
      const startRaw = row["计划开工时间"];
      const endRaw = row["计划完工时间"];
      const qtyRaw = row["数量(kg)"] ?? row["数量"];
      const statusRaw = String(row["状态"] || "");
      const remark = String(row["备注"] || "").trim();

      if (!orderNo) throw new Error("订单编号不能为空");
      if (!lineId) throw new Error("产线编号不能为空");
      if (!productModel) throw new Error("产品型号不能为空");

      const start = parseDate(startRaw);
      const end = parseDate(endRaw);
      if (!start) throw new Error("计划开工时间格式无效");
      if (!end) throw new Error("计划完工时间格式无效");
      if (new Date(end) <= new Date(start))
        throw new Error("完工时间必须晚于开工时间");

      const quantity = Number(qtyRaw);
      if (!quantity || quantity <= 0) throw new Error("数量必须为正数");

      result.success.push({
        id: genId("ord"),
        orderNo,
        lineId,
        productModel,
        plannedStart: start,
        plannedEnd: end,
        quantity,
        status: parseStatus(statusRaw),
        remark: remark || undefined,
        createdAt: new Date().toISOString(),
      });
    } catch (e: any) {
      result.errors.push({
        row: rowNum,
        message: e?.message || "解析失败",
      });
    }
  });

  return result;
}

// 导出全部订单为 Excel
export function exportOrdersToExcel(orders: ProductionOrder[]) {
  const STATUS_CN: Record<string, string> = {
    pending: "待启动",
    running: "进行中",
    completed: "已完成",
    paused: "已暂停",
  };
  const rows = orders.map((o) => ({
    订单编号: o.orderNo,
    产线编号: o.lineId,
    产品型号: o.productModel,
    计划开工时间: formatForExcel(o.plannedStart),
    计划完工时间: formatForExcel(o.plannedEnd),
    "数量(kg)": o.quantity,
    状态: STATUS_CN[o.status] || o.status,
    备注: o.remark || "",
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 20 },
    { wch: 12 },
    { wch: 16 },
    { wch: 20 },
    { wch: 20 },
    { wch: 12 },
    { wch: 10 },
    { wch: 20 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "生产订单");
  XLSX.writeFile(
    wb,
    `生产订单导出_${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}

function formatForExcel(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}
