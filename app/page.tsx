"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import GanttChart from "@/components/GanttChart";
import OrderDialog from "@/components/OrderDialog";
import LineDialog from "@/components/LineDialog";
import type {
  OrderStatus,
  ProductionLine,
  ProductionOrder,
  ViewMode,
} from "@/types";
import { STATUS_LABEL } from "@/types";
import { api } from "@/lib/storage";
import {
  downloadImportTemplate,
  exportOrdersToExcel,
  parseOrdersFromExcel,
} from "@/lib/excel";
import { exportElementToPDF } from "@/lib/pdf";
import {
  capacityLightText,
  calcCapacityLight,
  formatDate,
  formatDateTime,
} from "@/lib/utils";

export default function Home() {
  const [lines, setLines] = useState<ProductionLine[]>([]);
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [anchorDate, setAnchorDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState<"board" | "lines" | "orders">(
    "board"
  );

  // 对话框
  const [orderDialog, setOrderDialog] = useState<{
    open: boolean;
    order: ProductionOrder | null;
  }>({ open: false, order: null });
  const [lineDialog, setLineDialog] = useState<{
    open: boolean;
    line: ProductionLine | null;
  }>({ open: false, line: null });

  // 多选(用于批量偏移)
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 从数据库加载数据
  async function refreshData() {
    try {
      const [linesData, ordersData] = await Promise.all([
        api.loadLines(),
        api.loadOrders(),
      ]);
      setLines(linesData);
      setOrders(ordersData);
    } catch (e) {
      console.error("加载数据失败:", e);
    } finally {
      setLoading(false);
    }
  }

  // 初始化
  useEffect(() => {
    api.seed().then(() => refreshData());
  }, []);

  // 订单 CRUD
  async function saveOrder(order: ProductionOrder) {
    try {
      await api.saveOrder(order);
      setOrders((prev) => {
        const exists = prev.some((o) => o.id === order.id);
        return exists
          ? prev.map((o) => (o.id === order.id ? order : o))
          : [...prev, order];
      });
      setOrderDialog({ open: false, order: null });
    } catch (e: any) {
      alert("保存失败: " + e.message);
    }
  }
  async function deleteOrder(id: string) {
    try {
      await api.deleteOrder(id);
      setOrders((prev) => prev.filter((o) => o.id !== id));
      setOrderDialog({ open: false, order: null });
    } catch (e: any) {
      alert("删除失败: " + e.message);
    }
  }
  async function updateOrder(id: string, patch: Partial<ProductionOrder>) {
    const order = orders.find((o) => o.id === id);
    if (!order) return;
    const updated = { ...order, ...patch };
    try {
      await api.saveOrder(updated);
      setOrders((prev) =>
        prev.map((o) => (o.id === id ? updated : o))
      );
    } catch (e: any) {
      alert("更新失败: " + e.message);
    }
  }

  // 取消订单(仅未开工):释放产能
  async function cancelPendingOrder(id: string) {
    const order = orders.find((o) => o.id === id);
    if (!order) return;
    if (order.status !== "pending") {
      return alert("只能取消状态为'待启动'的订单");
    }
    if (!confirm(`确定取消订单 ${order.orderNo} 吗? 该时间段产能将被释放。`))
      return;
    try {
      await api.deleteOrder(id);
      setOrders((prev) => prev.filter((o) => o.id !== id));
      alert(`✅ 订单 ${order.orderNo} 已取消,产能已释放。`);
    } catch (e: any) {
      alert("取消失败: " + e.message);
    }
  }

  // 产线 CRUD
  async function saveLine(line: ProductionLine) {
    try {
      await api.saveLine(line);
      setLines((prev) => {
        const exists = prev.some((l) => l.id === line.id);
        return exists
          ? prev.map((l) => (l.id === line.id ? line : l))
          : [...prev, line];
      });
      setLineDialog({ open: false, line: null });
    } catch (e: any) {
      alert("保存失败: " + e.message);
    }
  }
  async function deleteLine(id: string) {
    try {
      await api.deleteLine(id);
      setLines((prev) => prev.filter((l) => l.id !== id));
      setLineDialog({ open: false, line: null });
    } catch (e: any) {
      alert("删除失败: " + e.message);
    }
  }

  // Excel 导入
  async function handleImport(file: File) {
    const res = await parseOrdersFromExcel(file);
    if (res.errors.length > 0) {
      const msg =
        `解析 ${res.success.length} 条成功, ${res.errors.length} 条失败:\n\n` +
        res.errors
          .slice(0, 10)
          .map((e) => `第 ${e.row} 行: ${e.message}`)
          .join("\n") +
        (res.errors.length > 10 ? `\n...还有 ${res.errors.length - 10} 条错误` : "");
      if (res.success.length === 0) {
        alert("❌ " + msg);
        return;
      }
      if (!confirm(msg + "\n\n是否导入成功解析的条目?")) return;
    }
    if (res.success.length === 0) {
      alert("没有可导入的数据");
      return;
    }
    try {
      await api.saveOrders(res.success);
      setOrders((prev) => [...prev, ...res.success]);
      alert(`✅ 成功导入 ${res.success.length} 条订单`);
    } catch (e: any) {
      alert("导入保存失败: " + e.message);
    }
  }

  // 批量时间偏移
  async function batchShiftOrders(hours: number) {
    if (selectedOrders.length === 0) {
      return alert("请先在订单列表中勾选要偏移的订单");
    }
    const ms = hours * 3600000;
    const updated = orders
      .filter((o) => selectedOrders.includes(o.id))
      .map((o) => ({
        ...o,
        plannedStart: new Date(
          new Date(o.plannedStart).getTime() + ms
        ).toISOString(),
        plannedEnd: new Date(
          new Date(o.plannedEnd).getTime() + ms
        ).toISOString(),
      }));
    try {
      await api.saveOrders(updated);
      setOrders((prev) =>
        prev.map((o) => {
          const u = updated.find((x) => x.id === o.id);
          return u || o;
        })
      );
      alert(
        `✅ 已将 ${selectedOrders.length} 个订单${hours > 0 ? "延后" : "提前"} ${Math.abs(
          hours
        )} 小时`
      );
    } catch (e: any) {
      alert("批量偏移失败: " + e.message);
    }
  }

  // 导航
  function shiftAnchor(dir: 1 | -1) {
    const d = new Date(anchorDate);
    if (viewMode === "day") d.setDate(d.getDate() + dir);
    else if (viewMode === "week") d.setDate(d.getDate() + 7 * dir);
    else d.setMonth(d.getMonth() + dir);
    setAnchorDate(d);
  }

  // 汇总统计
  const stats = useMemo(() => {
    const total = orders.length;
    const byStatus: Record<OrderStatus, number> = {
      pending: 0,
      running: 0,
      completed: 0,
      paused: 0,
    };
    orders.forEach((o) => (byStatus[o.status] = (byStatus[o.status] || 0) + 1));
    return { total, byStatus };
  }, [orders]);

  return (
    <div className="min-h-screen">
      {/* 顶部导航 */}
      <header className="bg-gradient-to-r from-brand-700 to-brand-900 text-white shadow-lg no-print">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">生产排产系统</h1>
            <p className="text-xs text-brand-100 opacity-90">
              Cornell New Materials · 生产计划与产能可视化
            </p>
          </div>
          <nav className="flex gap-1">
            {(
              [
                { k: "board", l: "排产看板" },
                { k: "orders", l: "订单管理" },
                { k: "lines", l: "产线管理" },
              ] as const
            ).map((t) => (
              <button
                key={t.k}
                onClick={() => setActiveTab(t.k)}
                className={`px-4 py-2 text-sm rounded transition-colors ${
                  activeTab === t.k
                    ? "bg-white text-brand-700 font-medium"
                    : "text-white/80 hover:bg-white/10"
                }`}
              >
                {t.l}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="inline-block w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="text-slate-500 text-sm">正在加载数据...</p>
            </div>
          </div>
        ) : (
          <>
            {activeTab === "board" && (
          <BoardView
            lines={lines}
            orders={orders}
            viewMode={viewMode}
            setViewMode={setViewMode}
            anchorDate={anchorDate}
            setAnchorDate={setAnchorDate}
            shiftAnchor={shiftAnchor}
            stats={stats}
            onOrderClick={(o) => setOrderDialog({ open: true, order: o })}
            onOrderUpdate={updateOrder}
            onNew={() => setOrderDialog({ open: true, order: null })}
          />
        )}

        {activeTab === "orders" && (
          <OrdersView
            lines={lines}
            orders={orders}
            selected={selectedOrders}
            setSelected={setSelectedOrders}
            onEdit={(o) => setOrderDialog({ open: true, order: o })}
            onNew={() => setOrderDialog({ open: true, order: null })}
            onCancel={cancelPendingOrder}
            onImport={handleImport}
            onDownloadTemplate={downloadImportTemplate}
            onExport={() => exportOrdersToExcel(orders)}
            onBatchShift={batchShiftOrders}
            fileInputRef={fileInputRef}
          />
        )}

        {activeTab === "lines" && (
          <LinesView
            lines={lines}
            orders={orders}
            onEdit={(l) => setLineDialog({ open: true, line: l })}
            onNew={() => setLineDialog({ open: true, line: null })}
          />
        )}
          </>
        )}
      </main>

      {/* 对话框 */}
      <OrderDialog
        open={orderDialog.open}
        order={orderDialog.order}
        lines={lines}
        allOrders={orders}
        onClose={() => setOrderDialog({ open: false, order: null })}
        onSave={saveOrder}
        onDelete={deleteOrder}
      />
      <LineDialog
        open={lineDialog.open}
        line={lineDialog.line}
        onClose={() => setLineDialog({ open: false, line: null })}
        onSave={saveLine}
        onDelete={deleteLine}
      />
    </div>
  );
}

// ============ 排产看板视图 ============
function BoardView({
  lines,
  orders,
  viewMode,
  setViewMode,
  anchorDate,
  setAnchorDate,
  shiftAnchor,
  stats,
  onOrderClick,
  onOrderUpdate,
  onNew,
}: {
  lines: ProductionLine[];
  orders: ProductionOrder[];
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  anchorDate: Date;
  setAnchorDate: (d: Date) => void;
  shiftAnchor: (dir: 1 | -1) => void;
  stats: { total: number; byStatus: Record<OrderStatus, number> };
  onOrderClick: (o: ProductionOrder) => void;
  onOrderUpdate: (id: string, patch: Partial<ProductionOrder>) => void;
  onNew: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* 统计卡片 */}
      <div className="grid grid-cols-5 gap-3 no-print">
        <StatCard label="订单总数" value={stats.total} color="#0f172a" />
        <StatCard
          label="待启动"
          value={stats.byStatus.pending}
          color="#94a3b8"
        />
        <StatCard
          label="进行中"
          value={stats.byStatus.running}
          color="#3b82f6"
        />
        <StatCard
          label="已完成"
          value={stats.byStatus.completed}
          color="#10b981"
        />
        <StatCard
          label="已暂停"
          value={stats.byStatus.paused}
          color="#f59e0b"
        />
      </div>

      {/* 控制栏 */}
      <div className="bg-white rounded-lg border border-slate-200 p-3 flex flex-wrap items-center gap-3 no-print">
        <div className="flex rounded border border-slate-300 overflow-hidden">
          {(["day", "week", "month"] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              className={`px-3 py-1.5 text-sm ${
                viewMode === v
                  ? "bg-brand-600 text-white"
                  : "bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {v === "day" ? "日" : v === "week" ? "周" : "月"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => shiftAnchor(-1)}
            className="px-2 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50"
          >
            ◀
          </button>
          <button
            onClick={() => setAnchorDate(new Date())}
            className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50"
          >
            今天
          </button>
          <button
            onClick={() => shiftAnchor(1)}
            className="px-2 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50"
          >
            ▶
          </button>
          <span className="ml-2 text-sm text-slate-600">
            {formatDate(anchorDate.toISOString())}
          </span>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> 充足(&gt;7天)
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> 适中(2-7天)
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" /> 紧张(&lt;2天)
          </span>
        </div>

        <button
          onClick={onNew}
          className="px-3 py-1.5 text-sm bg-brand-600 text-white rounded hover:bg-brand-700"
        >
          + 新增订单
        </button>
        <button
          onClick={() =>
            exportElementToPDF(
              "gantt-export-area",
              `排产看板_${new Date().toISOString().slice(0, 10)}.pdf`
            )
          }
          className="px-3 py-1.5 text-sm border border-slate-300 rounded hover:bg-slate-50"
        >
          导出 PDF
        </button>
      </div>

      {/* 甘特图 */}
      <GanttChart
        lines={lines}
        orders={orders}
        viewMode={viewMode}
        anchorDate={anchorDate}
        onOrderUpdate={onOrderUpdate}
        onOrderClick={onOrderClick}
      />

      <p className="text-xs text-slate-500">
        提示: 拖拽任务块可调整时间(吸附到15分钟);点击任务块可编辑详情。
      </p>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="text-2xl font-bold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

// ============ 订单管理视图 ============
function OrdersView({
  lines,
  orders,
  selected,
  setSelected,
  onEdit,
  onNew,
  onCancel,
  onImport,
  onDownloadTemplate,
  onExport,
  onBatchShift,
  fileInputRef,
}: {
  lines: ProductionLine[];
  orders: ProductionOrder[];
  selected: string[];
  setSelected: (ids: string[]) => void;
  onEdit: (o: ProductionOrder) => void;
  onNew: () => void;
  onCancel: (id: string) => void;
  onImport: (f: File) => void;
  onDownloadTemplate: () => void;
  onExport: () => void;
  onBatchShift: (hours: number) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}) {
  const [filter, setFilter] = useState<{ line: string; status: string; q: string }>(
    { line: "", status: "", q: "" }
  );
  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (filter.line && o.lineId !== filter.line) return false;
      if (filter.status && o.status !== filter.status) return false;
      if (filter.q) {
        const q = filter.q.toLowerCase();
        if (
          !o.orderNo.toLowerCase().includes(q) &&
          !o.productModel.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [orders, filter]);

  const [shiftHours, setShiftHours] = useState<number>(2);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-slate-200 p-3 flex flex-wrap items-center gap-2">
        <input
          className="px-3 py-1.5 text-sm border border-slate-300 rounded"
          placeholder="搜索订单号/产品型号"
          value={filter.q}
          onChange={(e) => setFilter({ ...filter, q: e.target.value })}
        />
        <select
          className="px-3 py-1.5 text-sm border border-slate-300 rounded"
          value={filter.line}
          onChange={(e) => setFilter({ ...filter, line: e.target.value })}
        >
          <option value="">全部产线</option>
          {lines.map((l) => (
            <option key={l.id} value={l.id}>
              {l.id}
            </option>
          ))}
        </select>
        <select
          className="px-3 py-1.5 text-sm border border-slate-300 rounded"
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
        >
          <option value="">全部状态</option>
          {(Object.keys(STATUS_LABEL) as OrderStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>

        <div className="flex-1" />

        <button
          onClick={onDownloadTemplate}
          className="px-3 py-1.5 text-sm border border-slate-300 rounded hover:bg-slate-50"
        >
          下载模板
        </button>
        <input
          type="file"
          ref={fileInputRef}
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              onImport(f);
              e.target.value = "";
            }
          }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1.5 text-sm border border-slate-300 rounded hover:bg-slate-50"
        >
          导入 Excel
        </button>
        <button
          onClick={onExport}
          className="px-3 py-1.5 text-sm border border-slate-300 rounded hover:bg-slate-50"
        >
          导出 Excel
        </button>
        <button
          onClick={onNew}
          className="px-3 py-1.5 text-sm bg-brand-600 text-white rounded hover:bg-brand-700"
        >
          + 新增订单
        </button>
      </div>

      {selected.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-blue-900 font-medium">
            已选 {selected.length} 个订单
          </span>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.5"
              value={shiftHours}
              onChange={(e) => setShiftHours(Number(e.target.value))}
              className="w-20 px-2 py-1 text-sm border border-slate-300 rounded"
            />
            <span className="text-sm text-slate-600">小时</span>
            <button
              onClick={() => onBatchShift(-Math.abs(shiftHours))}
              className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-white"
            >
              批量提前
            </button>
            <button
              onClick={() => onBatchShift(Math.abs(shiftHours))}
              className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-white"
            >
              批量延后
            </button>
            <button
              onClick={() => setSelected([])}
              className="px-3 py-1 text-sm text-slate-600 hover:text-slate-900"
            >
              清除选择
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="w-10 px-2 py-2">
                  <input
                    type="checkbox"
                    checked={
                      filtered.length > 0 &&
                      filtered.every((o) => selected.includes(o.id))
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        const allIds = Array.from(
                          new Set([...selected, ...filtered.map((o) => o.id)])
                        );
                        setSelected(allIds);
                      } else {
                        setSelected(
                          selected.filter(
                            (id) => !filtered.some((o) => o.id === id)
                          )
                        );
                      }
                    }}
                  />
                </th>
                <Th>订单编号</Th>
                <Th>产线</Th>
                <Th>产品型号</Th>
                <Th>开工时间</Th>
                <Th>完工时间</Th>
                <Th>数量(kg)</Th>
                <Th>状态</Th>
                <Th>操作</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-slate-400">
                    暂无订单
                  </td>
                </tr>
              )}
              {filtered.map((o) => (
                <tr
                  key={o.id}
                  className="border-b border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-2 py-2">
                    <input
                      type="checkbox"
                      checked={selected.includes(o.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelected([...selected, o.id]);
                        else setSelected(selected.filter((x) => x !== o.id));
                      }}
                    />
                  </td>
                  <Td>{o.orderNo}</Td>
                  <Td>{o.lineId}</Td>
                  <Td>{o.productModel}</Td>
                  <Td>{formatDateTime(o.plannedStart)}</Td>
                  <Td>{formatDateTime(o.plannedEnd)}</Td>
                  <Td>{o.quantity.toLocaleString()}</Td>
                  <Td>
                    <StatusBadge status={o.status} />
                  </Td>
                  <Td>
                    <div className="flex gap-2">
                      <button
                        onClick={() => onEdit(o)}
                        className="text-brand-600 hover:underline text-xs"
                      >
                        编辑
                      </button>
                      {o.status === "pending" && (
                        <button
                          onClick={() => onCancel(o.id)}
                          className="text-red-600 hover:underline text-xs"
                        >
                          取消
                        </button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        提示: 勾选多个订单后可批量时间偏移;取消待启动订单会立即释放该时间段产能。
      </p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-3 py-2 text-xs font-medium text-slate-600 uppercase">
      {children}
    </th>
  );
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2 text-slate-800">{children}</td>;
}
function StatusBadge({ status }: { status: OrderStatus }) {
  const colors: Record<OrderStatus, string> = {
    pending: "bg-slate-100 text-slate-700",
    running: "bg-blue-100 text-blue-700",
    completed: "bg-emerald-100 text-emerald-700",
    paused: "bg-amber-100 text-amber-700",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs ${colors[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

// ============ 产线管理视图 ============
function LinesView({
  lines,
  orders,
  onEdit,
  onNew,
}: {
  lines: ProductionLine[];
  orders: ProductionOrder[];
  onEdit: (l: ProductionLine) => void;
  onNew: () => void;
}) {
  const WEEK = ["日", "一", "二", "三", "四", "五", "六"];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">产线管理</h2>
          <p className="text-xs text-slate-500">
            配置产线日历、班次与预维护窗口
          </p>
        </div>
        <button
          onClick={onNew}
          className="px-3 py-1.5 text-sm bg-brand-600 text-white rounded hover:bg-brand-700"
        >
          + 新增产线
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {lines.map((l) => {
          const light = calcCapacityLight(l.id, orders);
          const count = orders.filter(
            (o) => o.lineId === l.id && o.status !== "completed"
          ).length;
          return (
            <div
              key={l.id}
              className="bg-white rounded-lg border border-slate-200 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{
                      backgroundColor:
                        light === "green"
                          ? "#10b981"
                          : light === "yellow"
                          ? "#f59e0b"
                          : "#ef4444",
                    }}
                  />
                  <div>
                    <div className="font-semibold text-slate-900">{l.id}</div>
                    {l.name !== l.id && (
                      <div className="text-xs text-slate-500">{l.name}</div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => onEdit(l)}
                  className="text-xs text-brand-600 hover:underline"
                >
                  编辑
                </button>
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-slate-500">工作日: </span>
                  <span className="text-slate-800">
                    {l.workDays.map((d) => "周" + WEEK[d]).join(" ")}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">班次: </span>
                  <span className="text-slate-800">
                    {l.shifts
                      .map((s) => `${s.name} ${s.start}-${s.end}`)
                      .join(" | ")}
                  </span>
                </div>
                {l.maintenances.length > 0 && (
                  <div>
                    <span className="text-slate-500">维护: </span>
                    <span className="text-slate-800">
                      {l.maintenances
                        .map(
                          (m) =>
                            `周${WEEK[m.dayOfWeek]} ${m.start}-${m.end}${
                              m.note ? `(${m.note})` : ""
                            }`
                        )
                        .join(" | ")}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-3 pt-2 border-t border-slate-100 text-xs text-slate-500">
                  <span>排产订单: {count}</span>
                  <span>· {capacityLightText(light)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
