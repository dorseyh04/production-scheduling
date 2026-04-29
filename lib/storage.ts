import type { ProductionLine, ProductionOrder } from "@/types";

const API_BASE = "/api";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `API error ${res.status}`);
  }
  return res.json();
}

export const api = {
  // ===== 产线 =====
  async loadLines(): Promise<ProductionLine[]> {
    return apiFetch<ProductionLine[]>("/lines");
  },

  async saveLine(line: ProductionLine): Promise<void> {
    await apiFetch("/lines", {
      method: "POST",
      body: JSON.stringify(line),
    });
  },

  async deleteLine(id: string): Promise<void> {
    await apiFetch(`/lines?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  // ===== 订单 =====
  async loadOrders(): Promise<ProductionOrder[]> {
    return apiFetch<ProductionOrder[]>("/orders");
  },

  async saveOrder(order: ProductionOrder): Promise<void> {
    await apiFetch("/orders", {
      method: "POST",
      body: JSON.stringify(order),
    });
  },

  async saveOrders(orders: ProductionOrder[]): Promise<void> {
    if (orders.length === 0) return;
    await apiFetch("/orders", {
      method: "POST",
      body: JSON.stringify(orders),
    });
  },

  async deleteOrder(id: string): Promise<void> {
    await apiFetch(`/orders?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  // ===== 初始化种子 =====
  async seed(): Promise<void> {
    await apiFetch("/seed", { method: "POST" });
  },
};
