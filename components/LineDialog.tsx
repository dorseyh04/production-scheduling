"use client";

import React, { useEffect, useState } from "react";
import type {
  MaintenanceWindow,
  ProductionLine,
  Shift,
} from "@/types";
import { genId } from "@/lib/utils";

interface LineDialogProps {
  open: boolean;
  line: ProductionLine | null;
  onClose: () => void;
  onSave: (line: ProductionLine) => void;
  onDelete?: (id: string) => void;
}

const WEEK_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

export default function LineDialog({
  open,
  line,
  onClose,
  onSave,
  onDelete,
}: LineDialogProps) {
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [workDays, setWorkDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [shifts, setShifts] = useState<Shift[]>([
    { name: "早班", start: "08:00", end: "14:00" },
    { name: "晚班", start: "14:00", end: "20:00" },
  ]);
  const [maintenances, setMaintenances] = useState<MaintenanceWindow[]>([]);
  const [remark, setRemark] = useState("");

  useEffect(() => {
    if (line) {
      setId(line.id);
      setName(line.name);
      setWorkDays(line.workDays);
      setShifts(line.shifts);
      setMaintenances(line.maintenances);
      setRemark(line.remark || "");
    } else {
      setId("");
      setName("");
      setWorkDays([1, 2, 3, 4, 5]);
      setShifts([
        { name: "早班", start: "08:00", end: "14:00" },
        { name: "晚班", start: "14:00", end: "20:00" },
      ]);
      setMaintenances([]);
      setRemark("");
    }
  }, [line, open]);

  if (!open) return null;

  function toggleDay(d: number) {
    setWorkDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()
    );
  }

  function addShift() {
    setShifts([...shifts, { name: "新班次", start: "08:00", end: "20:00" }]);
  }

  function updateShift(i: number, patch: Partial<Shift>) {
    setShifts(shifts.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function removeShift(i: number) {
    setShifts(shifts.filter((_, idx) => idx !== i));
  }

  function addMaintenance() {
    setMaintenances([
      ...maintenances,
      { dayOfWeek: 3, start: "14:00", end: "16:00", note: "" },
    ]);
  }

  function updateMaintenance(i: number, patch: Partial<MaintenanceWindow>) {
    setMaintenances(
      maintenances.map((m, idx) => (idx === i ? { ...m, ...patch } : m))
    );
  }

  function removeMaintenance(i: number) {
    setMaintenances(maintenances.filter((_, idx) => idx !== i));
  }

  function handleSave() {
    if (!id.trim()) return alert("请输入产线编号");
    if (workDays.length === 0) return alert("请至少选择一个工作日");
    if (shifts.length === 0) return alert("请至少配置一个班次");

    const saved: ProductionLine = {
      id: id.trim(),
      name: name.trim() || id.trim(),
      workDays,
      shifts,
      maintenances,
      remark: remark.trim() || undefined,
      createdAt: line?.createdAt || new Date().toISOString(),
    };
    onSave(saved);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">
            {line ? "编辑产线" : "新增产线"}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                产线编号 <span className="text-red-500">*</span>
              </label>
              <input
                className="input"
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="如 1# / 超声波复合"
                disabled={!!line} // 编辑时不允许改 ID(避免关联订单错乱)
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                产线名称
              </label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="可选,默认与编号相同"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              工作日
            </label>
            <div className="flex gap-1">
              {WEEK_LABELS.map((label, d) => (
                <button
                  key={d}
                  onClick={() => toggleDay(d)}
                  className={`w-10 h-10 rounded text-sm font-medium transition-colors ${
                    workDays.includes(d)
                      ? "bg-brand-600 text-white"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700">
                班次安排
              </label>
              <button
                onClick={addShift}
                className="text-xs text-brand-600 hover:underline"
              >
                + 添加班次
              </button>
            </div>
            <div className="space-y-2">
              {shifts.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    className="input flex-1"
                    value={s.name}
                    onChange={(e) => updateShift(i, { name: e.target.value })}
                    placeholder="班次名"
                  />
                  <input
                    type="time"
                    className="input w-28"
                    value={s.start}
                    onChange={(e) => updateShift(i, { start: e.target.value })}
                  />
                  <span className="text-slate-400">—</span>
                  <input
                    type="time"
                    className="input w-28"
                    value={s.end}
                    onChange={(e) => updateShift(i, { end: e.target.value })}
                  />
                  <button
                    onClick={() => removeShift(i)}
                    className="text-red-500 hover:text-red-700 text-sm px-2"
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700">
                维护窗口
              </label>
              <button
                onClick={addMaintenance}
                className="text-xs text-brand-600 hover:underline"
              >
                + 添加维护窗口
              </button>
            </div>
            <div className="space-y-2">
              {maintenances.length === 0 && (
                <div className="text-xs text-slate-400">暂无维护窗口</div>
              )}
              {maintenances.map((m, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    className="input w-20"
                    value={m.dayOfWeek}
                    onChange={(e) =>
                      updateMaintenance(i, {
                        dayOfWeek: Number(e.target.value),
                      })
                    }
                  >
                    {WEEK_LABELS.map((l, d) => (
                      <option key={d} value={d}>
                        周{l}
                      </option>
                    ))}
                  </select>
                  <input
                    type="time"
                    className="input w-28"
                    value={m.start}
                    onChange={(e) =>
                      updateMaintenance(i, { start: e.target.value })
                    }
                  />
                  <span className="text-slate-400">—</span>
                  <input
                    type="time"
                    className="input w-28"
                    value={m.end}
                    onChange={(e) =>
                      updateMaintenance(i, { end: e.target.value })
                    }
                  />
                  <input
                    className="input flex-1"
                    value={m.note || ""}
                    onChange={(e) =>
                      updateMaintenance(i, { note: e.target.value })
                    }
                    placeholder="备注"
                  />
                  <button
                    onClick={() => removeMaintenance(i)}
                    className="text-red-500 hover:text-red-700 text-sm px-2"
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              备注
            </label>
            <textarea
              className="input min-h-[60px]"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
            />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-200 flex items-center justify-between">
          <div>
            {line && onDelete && (
              <button
                className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded"
                onClick={() => {
                  if (
                    confirm(
                      `确定删除产线 ${line.id} 吗?\n注意:该产线下的订单不会被自动删除,请先妥善处理。`
                    )
                  ) {
                    onDelete(line.id);
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
        .input:disabled {
          background: #f1f5f9;
          color: #64748b;
        }
        textarea.input,
        input.input:not([type="time"]) {
          width: 100%;
        }
      `}</style>
    </div>
  );
}
