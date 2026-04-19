"use client";

import React, { useEffect, useState } from "react";
import type {
  OrderStatus,
  ProductionLine,
  ProductionOrder,
} from "@/types";
import { STATUS_LABEL } from "@/types";
import {
  findConflicts,
  fromLocalInput,
  genId,
  isWithinLineCalendar,
  toLocalInput,
} from "@/lib/utils";

interface OrderDialogProps {
  open: boolean;
  order: ProductionOrder | null; // null = 新增
  lines: ProductionLine[];
  allOrders: ProductionOrder[];
  onClose: () => void;
  onSave: (order: ProductionOrder) => void;
  onDelete?: (id: string) => void;
}

export default function OrderDialog({
  open,
  order,
  lines,
  allOrders,
  onClose,
  onSave,
  onDelete,
}: OrderDialogProps) {
  const [orderNo, setOrderNo] = useState("");
  const [lineId, setLineId] = useState("");
  const [productModel, setProductModel] = useState("");
  const [plannedStart, setPlannedStart] = useState("");
  const [plannedEnd, setPlannedEnd] = useState("");
  const [quantity, setQuantity] = useState<number | "">("");
  const [status, setStatus] = useState<OrderStatus>("pending");
  const [remark, setRemark] = useState("");

  useEffect(() => {
    if (order) {
      setOrderNo(order.orderNo);
      setLineId(order.lineId);
      setProductModel(order.productModel);
      setPlannedStart(toLocalInput(order.plannedStart));
      setPlannedEnd(toLocalInput(order.plannedEnd));
      setQuantity(order.quantity);
      setStatus(order.status);
      setRemark(order.remark || "");
    } else {
      // 新增默认值
      const now = new Date();
      now.setMinutes(0, 0, 0);
      now.setHours(now.getHours() + 1);
      const end = new Date(now.getTime() + 4 * 3600000);
      setOrderNo("");
      setLineId(lines[0]?.id || "");
      setProductModel("");
      setPlannedStart(toLocalInput(now.toISOString()));
      setPlannedEnd(toLocalInput(end.toISOString()));
      setQuantity("");
      setStatus("pending");
      setRemark("");
    }
  }, [order, open, lines]);

  if (!open) return null;

  function handleSave() {
    if (!orderNo.trim()) return alert("请输入订单编号");
    if (!lineId) return alert("请选择产线");
    if (!productModel.trim()) return alert("请输入产品型号");
    if (!plannedStart || !plannedEnd) return alert("请输入计划开工/完工时间");
    if (!quantity || Number(quantity) <= 0)
      return alert("请输入有效的批量数量");

    const startIso = fromLocalInput(plannedStart);
    const endIso = fromLocalInput(plannedEnd);
    if (new Date(endIso) <= new Date(startIso)) {
      return alert("完工时间必须晚于开工时间");
    }

    // 校验产线日历
    const line = lines.find((l) => l.id === lineId);
    if (line) {
      const cal = isWithinLineCalendar(line, startIso, endIso);
      if (!cal.ok) return alert("❌ " + cal.reason);
    }

    const id = order?.id || genId("ord");

    // 冲突检测
    const conflicts = findConflicts(
      { id, lineId, plannedStart: startIso, plannedEnd: endIso },
      allOrders
    );
    if (conflicts.length > 0) {
      const msg =
        "与以下订单时间重叠: " +
        conflicts.map((c) => c.orderNo).join(", ") +
        "\n\n是否仍要保存?";
      if (!confirm(msg)) return;
    }

    const saved: ProductionOrder = {
      id,
      orderNo: orderNo.trim(),
      lineId,
      productModel: productModel.trim(),
      plannedStart: startIso,
      plannedEnd: endIso,
      quantity: Number(quantity),
      status,
      remark: remark.trim() || undefined,
      createdAt: order?.createdAt || new Date().toISOString(),
    };
    onSave(saved);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">
            {order ? "编辑订单" : "新增订单"}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-5 space-y-4">
          <Field label="订单编号" required>
            <input
              className="input"
              value={orderNo}
              onChange={(e) => setOrderNo(e.target.value)}
              placeholder="如 SO20240521-0087"
            />
          </Field>

          <Field label="关联产线" required>
            <select
              className="input"
              value={lineId}
              onChange={(e) => setLineId(e.target.value)}
            >
              <option value="">-- 请选择 --</option>
              {lines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.id} {l.name !== l.id ? `(${l.name})` : ""}
                </option>
              ))}
            </select>
          </Field>

          <Field label="产品型号" required>
            <input
              className="input"
              value={productModel}
              onChange={(e) => setProductModel(e.target.value)}
              placeholder="如 KNE-AP70"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="计划开工时间" required>
              <input
                type="datetime-local"
                className="input"
                value={plannedStart}
                onChange={(e) => setPlannedStart(e.target.value)}
              />
            </Field>
            <Field label="计划完工时间" required>
              <input
                type="datetime-local"
                className="input"
                value={plannedEnd}
                onChange={(e) => setPlannedEnd(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="批量数量 (kg)" required>
              <input
                type="number"
                className="input"
                value={quantity}
                onChange={(e) =>
                  setQuantity(e.target.value ? Number(e.target.value) : "")
                }
                placeholder="如 1200"
                min={0}
              />
            </Field>
            <Field label="状态">
              <select
                className="input"
                value={status}
                onChange={(e) => setStatus(e.target.value as OrderStatus)}
              >
                {(Object.keys(STATUS_LABEL) as OrderStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="备注">
            <textarea
              className="input min-h-[60px]"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="可选"
            />
          </Field>
        </div>

        <div className="px-5 py-4 border-t border-slate-200 flex items-center justify-between">
          <div>
            {order && onDelete && (
              <button
                className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded"
                onClick={() => {
                  if (confirm(`确定删除订单 ${order.orderNo} 吗?`)) {
                    onDelete(order.id);
                  }
                }}
              >
                删除
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm border border-slate-300 rounded hover:bg-slate-50"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm bg-brand-600 text-white rounded hover:bg-brand-700"
            >
              保存
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid #cbd5e1;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          background: white;
          outline: none;
        }
        .input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}
