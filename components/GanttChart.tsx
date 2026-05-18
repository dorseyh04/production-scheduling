"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import type {
  ProductionLine,
  ProductionOrder,
  ViewMode,
  OrderStatus,
} from "@/types";
import { STATUS_COLOR, STATUS_LABEL } from "@/types";
import {
  calcCapacityLight,
  capacityLightText,
  findConflicts,
  formatDateTime,
  isWithinLineCalendar,
} from "@/lib/utils";

interface GanttChartProps {
  lines: ProductionLine[];
  orders: ProductionOrder[];
  viewMode: ViewMode;
  anchorDate: Date; // 视图锚定日期(起点)
  onOrderUpdate: (orderId: string, patch: Partial<ProductionOrder>) => void;
  onOrderClick: (order: ProductionOrder) => void;
}

// 每视图的时间跨度(小时)
const VIEW_HOURS: Record<ViewMode, number> = {
  day: 24,
  week: 24 * 7,
  month: 24 * 30,
};

// 每视图的主刻度间隔(小时)
const MAJOR_TICK: Record<ViewMode, number> = {
  day: 2,
  week: 24,
  month: 24 * 2,
};

const ROW_HEIGHT = 56;
const HEADER_HEIGHT = 48;
const LABEL_WIDTH = 160;

export default function GanttChart({
  lines,
  orders,
  viewMode,
  anchorDate,
  onOrderUpdate,
  onOrderClick,
}: GanttChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const chartWidth = Math.max(800, containerWidth - LABEL_WIDTH);
  const totalHours = VIEW_HOURS[viewMode];
  const pxPerHour = chartWidth / totalHours;

  // 视图起点(整点对齐)
  const viewStart = useMemo(() => {
    const d = new Date(anchorDate);
    d.setMinutes(0, 0, 0);
    if (viewMode === "week" || viewMode === "month") {
      d.setHours(0);
    }
    return d;
  }, [anchorDate, viewMode]);

  const viewEnd = useMemo(() => {
    return new Date(viewStart.getTime() + totalHours * 3600000);
  }, [viewStart, totalHours]);

  // 生成刻度
  const ticks = useMemo(() => {
    const arr: { offsetHours: number; label: string; isMajor: boolean }[] = [];
    const majorInterval = MAJOR_TICK[viewMode];
    const minorInterval =
      viewMode === "day" ? 1 : viewMode === "week" ? 6 : 12;

    for (let h = 0; h <= totalHours; h += minorInterval) {
      const t = new Date(viewStart.getTime() + h * 3600000);
      const isMajor = h % majorInterval === 0;
      let label = "";
      if (isMajor) {
        if (viewMode === "day") {
          label = `${String(t.getHours()).padStart(2, "0")}:00`;
        } else if (viewMode === "week") {
          label = `${t.getMonth() + 1}/${t.getDate()} (${
            ["日", "一", "二", "三", "四", "五", "六"][t.getDay()]
          })`;
        } else {
          label = `${t.getMonth() + 1}/${t.getDate()}`;
        }
      }
      arr.push({ offsetHours: h, label, isMajor });
    }
    return arr;
  }, [viewStart, totalHours, viewMode]);

  // 将订单映射到像素位置
  function orderToBox(order: ProductionOrder) {
    const s = new Date(order.plannedStart).getTime();
    const e = new Date(order.plannedEnd).getTime();
    const vs = viewStart.getTime();
    const ve = viewEnd.getTime();
    // 视图外
    if (e <= vs || s >= ve) return null;
    const left = ((Math.max(s, vs) - vs) / 3600000) * pxPerHour;
    const right = ((Math.min(e, ve) - vs) / 3600000) * pxPerHour;
    return { left, width: Math.max(2, right - left) };
  }

  // 拖拽状态
  const [drag, setDrag] = useState<{
    orderId: string;
    startX: number;
    originStart: string;
    originEnd: string;
    deltaMinutes: number;
  } | null>(null);

  function onTaskMouseDown(e: React.MouseEvent, order: ProductionOrder) {
    if (order.status === "completed") return;
    e.preventDefault();
    setDrag({
      orderId: order.id,
      startX: e.clientX,
      originStart: order.plannedStart,
      originEnd: order.plannedEnd,
      deltaMinutes: 0,
    });
  }

  useEffect(() => {
    if (!drag) return;
    const order = orders.find((o) => o.id === drag.orderId);
    if (!order) return;

    function onMove(ev: MouseEvent) {
      if (!drag) return;
      const dx = ev.clientX - drag.startX;
      const dh = dx / pxPerHour;
      // 吸附到 15 分钟
      const deltaMinutes = Math.round((dh * 60) / 15) * 15;
      setDrag({ ...drag, deltaMinutes });
    }

    function onUp() {
      if (!drag || !order) {
        setDrag(null);
        return;
      }
      if (drag.deltaMinutes === 0) {
        setDrag(null);
        return;
      }

      const newStart = new Date(
        new Date(drag.originStart).getTime() + drag.deltaMinutes * 60000
      ).toISOString();
      const newEnd = new Date(
        new Date(drag.originEnd).getTime() + drag.deltaMinutes * 60000
      ).toISOString();

      // 校验
      const line = lines.find((l) => l.id === order.lineId);
      if (line) {
        const cal = isWithinLineCalendar(line, newStart, newEnd);
        if (!cal.ok) {
          alert("❌ 调整失败: " + cal.reason);
          setDrag(null);
          return;
        }
        const conflicts = findConflicts(
          {
            id: order.id,
            lineId: order.lineId,
            plannedStart: newStart,
            plannedEnd: newEnd,
          },
          orders
        );
        if (conflicts.length > 0) {
          alert(
            "❌ 与以下订单时间重叠: " +
              conflicts.map((c) => c.orderNo).join(", ")
          );
          setDrag(null);
          return;
        }
      }

      onOrderUpdate(order.id, {
        plannedStart: newStart,
        plannedEnd: newEnd,
      });
      setDrag(null);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag, orders, lines, pxPerHour, onOrderUpdate]);

  // 当前时间竖线
  const nowLeft = useMemo(() => {
    const now = Date.now();
    const vs = viewStart.getTime();
    const ve = viewEnd.getTime();
    if (now < vs || now > ve) return null;
    return ((now - vs) / 3600000) * pxPerHour;
  }, [viewStart, viewEnd, pxPerHour]);

  if (lines.length === 0) {
    return (
      <div className="p-12 text-center text-slate-500 bg-white rounded-lg border border-slate-200">
        暂无产线。请先到"产线管理"页面添加产线。
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="bg-white rounded-lg border border-slate-200 overflow-x-auto"
      id="gantt-export-area"
    >
      <div style={{ width: LABEL_WIDTH + chartWidth, position: "relative" }}>
        {/* 表头 */}
        <div
          className="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-10"
          style={{ height: HEADER_HEIGHT }}
        >
          <div
            className="flex items-center justify-center font-medium text-sm text-slate-700 border-r border-slate-200"
            style={{ width: LABEL_WIDTH, flexShrink: 0 }}
          >
            产线
          </div>
          <div style={{ width: chartWidth, position: "relative" }}>
            {ticks.map((t, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 flex items-center"
                style={{ left: t.offsetHours * pxPerHour }}
              >
                <div
                  className={`absolute top-0 bottom-0 ${
                    t.isMajor ? "border-l border-slate-300" : ""
                  }`}
                />
                {t.isMajor && (
                  <span className="ml-1 text-xs text-slate-600 whitespace-nowrap">
                    {t.label}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 各产线行 */}
        {lines.map((line, rowIdx) => {
          const light = calcCapacityLight(line.id, orders);
          // 只统计该产线在产(running)和待启动(pending)的订单
          const activeOrders = orders.filter(
            (o) =>
              o.lineId === line.id &&
              (o.status === "running" || o.status === "pending")
          );
          return (
            <div
              key={line.id}
              className="flex border-b border-slate-100 relative"
              style={{ height: ROW_HEIGHT }}
            >
              {/* 产线标签 */}
              <div
                className="flex items-center gap-2 px-3 border-r border-slate-200 bg-slate-50"
                style={{ width: LABEL_WIDTH, flexShrink: 0 }}
              >
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
                  title={capacityLightText(light)}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800 truncate">
                    {line.id}
                  </div>
                  {line.name !== line.id && (
                    <div className="text-[10px] text-slate-400 truncate">
                      {line.name}
                    </div>
                  )}
                  <div className="text-[10px] text-slate-500 truncate">
                    {activeOrders.length} 个在产/待产订单
                  </div>
                </div>
              </div>

              {/* 时间轴区 */}
              <div
                className="relative"
                style={{ width: chartWidth, height: ROW_HEIGHT }}
              >
                {/* 背景网格 */}
                {ticks.map((t, i) =>
                  t.isMajor ? (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 border-l border-slate-100"
                      style={{ left: t.offsetHours * pxPerHour }}
                    />
                  ) : null
                )}

                {/* 周末背景(周视图) */}
                {viewMode === "week" &&
                  Array.from({ length: 7 }).map((_, d) => {
                    const date = new Date(viewStart.getTime() + d * 86400000);
                    const dow = date.getDay();
                    if (dow !== 0 && dow !== 6) return null;
                    return (
                      <div
                        key={d}
                        className="absolute top-0 bottom-0 bg-slate-50"
                        style={{
                          left: d * 24 * pxPerHour,
                          width: 24 * pxPerHour,
                        }}
                      />
                    );
                  })}

                {/* 订单块 */}
                {lineOrders.map((order) => {
                  const box = orderToBox(order);
                  if (!box) return null;
                  const isDragging = drag?.orderId === order.id;
                  const previewOffset =
                    isDragging && drag
                      ? (drag.deltaMinutes / 60) * pxPerHour
                      : 0;
                  const color = STATUS_COLOR[order.status];

                  return (
                    <div
                      key={order.id}
                      className={`gantt-task absolute rounded shadow-sm border ${
                        isDragging ? "dragging" : ""
                      }`}
                      style={{
                        left: box.left + previewOffset,
                        top: 8,
                        width: box.width,
                        height: ROW_HEIGHT - 16,
                        backgroundColor: color,
                        borderColor: color,
                      }}
                      onMouseDown={(e) => onTaskMouseDown(e, order)}
                      onClick={(e) => {
                        if (!drag) onOrderClick(order);
                        e.stopPropagation();
                      }}
                      title={`${order.orderNo} | ${order.productModel} | ${order.quantity}kg\n${formatDateTime(order.plannedStart)} ~ ${formatDateTime(order.plannedEnd)}\n状态: ${STATUS_LABEL[order.status]}`}
                    >
                      <div className="px-2 py-1 text-white text-xs font-medium overflow-hidden">
                        <div className="truncate">{order.orderNo}</div>
                        <div className="truncate opacity-90 text-[10px]">
                          {order.productModel} · {order.quantity}kg
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* 当前时间线 */}
        {nowLeft !== null && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: LABEL_WIDTH + nowLeft,
              top: 0,
              bottom: 0,
              width: 2,
              backgroundColor: "#ef4444",
              zIndex: 5,
            }}
          >
            <div className="absolute top-0 left-0 -translate-x-1/2 bg-red-500 text-white text-[10px] px-1 rounded">
              现在
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
