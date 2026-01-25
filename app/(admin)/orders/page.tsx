"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface OrderRow {
  id: number;
  user_id: number;
  product_id: number;
  content: string;
  price: number;
  quantity: number;
  created_at: string;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from("orders")
      .select("id, user_id, product_id, content, price, quantity, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    setOrders((data as OrderRow[]) || []);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="grid" style={{ gap: 24 }}>
      <div className="topbar">
        <div>
          <h1 className="page-title">Orders</h1>
          <p className="muted">Theo dõi đơn hàng gần nhất.</p>
        </div>
      </div>

      <div className="card">
        <h3 className="section-title">Danh sách đơn hàng</h3>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>User</th>
              <th>Product</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>#{order.id}</td>
                <td>{order.user_id}</td>
                <td>{order.product_id}</td>
                <td>{order.quantity}</td>
                <td>{order.price.toLocaleString()}</td>
                <td>{new Date(order.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {!orders.length && (
              <tr>
                <td colSpan={6} className="muted">Chưa có đơn hàng.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
