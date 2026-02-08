"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface DirectOrderRow {
  id: number;
  user_id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  amount: number;
  code: string;
  status: string;
  created_at: string;
  products?: {
    name: string;
  }[] | null;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Chờ xử lý",
  confirmed: "Đã duyệt",
  failed: "Thất bại",
  cancelled: "Đã hủy"
};

export default function DirectOrdersPage() {
  const [orders, setOrders] = useState<DirectOrderRow[]>([]);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const load = async () => {
    let query = supabase
      .from("direct_orders")
      .select("id, user_id, product_id, quantity, unit_price, amount, code, status, created_at, products(name)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }
    const { data } = await query;
    setOrders(((data as unknown) as DirectOrderRow[]) || []);
  };

  useEffect(() => {
    load();
  }, [statusFilter]);

  const filtered = useMemo(() => orders, [orders]);

  const handleApprove = async (order: DirectOrderRow) => {
    if (!confirm(`Duyệt đơn #${order.id} và gửi tài khoản cho user ${order.user_id}?`)) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setStatus("Chưa đăng nhập.");
      return;
    }
    setSendingId(order.id);
    setStatus(null);
    try {
      const res = await fetch("/api/direct-orders/fulfill", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ orderId: order.id })
      });
      const result = await res.json();
      if (!res.ok) {
        setStatus(result.error || "Duyệt thất bại.");
        return;
      }
      setStatus(`✅ Đã duyệt đơn #${order.id}.`);
      await load();
    } catch (error) {
      setStatus("Duyệt thất bại.");
    } finally {
      setSendingId(null);
    }
  };

  const handleMarkFailed = async (order: DirectOrderRow) => {
    if (!confirm(`Đánh dấu thất bại đơn #${order.id}?`)) return;
    await supabase.from("direct_orders").update({ status: "failed" }).eq("id", order.id);
    await load();
  };

  return (
    <div className="grid" style={{ gap: 24 }}>
      <div className="topbar">
        <div>
          <h1 className="page-title">Direct Orders</h1>
          <p className="muted">Duyệt đơn chuyển khoản trực tiếp khi cần gửi lại tài khoản.</p>
        </div>
      </div>

      <div className="card">
        <div className="form-grid">
          <select
            className="select"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="pending">Chờ xử lý</option>
            <option value="confirmed">Đã duyệt</option>
            <option value="failed">Thất bại</option>
            <option value="cancelled">Đã hủy</option>
            <option value="all">Tất cả</option>
          </select>
        </div>
        {status && <p className="muted" style={{ marginTop: 8 }}>{status}</p>}
      </div>

      <div className="card">
        <h3 className="section-title">Danh sách đơn chuyển khoản</h3>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>User</th>
              <th>Product</th>
              <th>Qty</th>
              <th>Unit</th>
              <th>Amount</th>
              <th>Code</th>
              <th>Status</th>
              <th>Time</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((order) => (
              <tr key={order.id}>
                <td>#{order.id}</td>
                <td>{order.user_id}</td>
                <td>{order.products?.[0]?.name ?? order.product_id}</td>
                <td>{order.quantity}</td>
                <td>{order.unit_price?.toLocaleString?.() ?? order.unit_price}</td>
                <td>{order.amount?.toLocaleString?.() ?? order.amount}</td>
                <td>{order.code}</td>
                <td>{STATUS_LABELS[order.status] ?? order.status}</td>
                <td>{order.created_at ? new Date(order.created_at).toLocaleString() : "-"}</td>
                <td>
                  {order.status === "pending" ? (
                    <>
                      <button
                        className="button secondary"
                        disabled={sendingId === order.id}
                        onClick={() => handleApprove(order)}
                      >
                        Duyệt
                      </button>
                      <button
                        className="button danger"
                        style={{ marginLeft: 8 }}
                        disabled={sendingId === order.id}
                        onClick={() => handleMarkFailed(order)}
                      >
                        Thất bại
                      </button>
                    </>
                  ) : (
                    <span className="muted">-</span>
                  )}
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={10} className="muted">Chưa có đơn.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
