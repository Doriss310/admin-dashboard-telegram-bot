"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Stats = { users: number; orders: number; revenue: number };

type OrderRow = {
  id: number;
  user_id: number;
  product_id: number;
  price: number;
  quantity: number;
  created_at: string;
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ users: 0, orders: 0, revenue: 0 });
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [pendingDeposits, setPendingDeposits] = useState(0);
  const [pendingWithdrawals, setPendingWithdrawals] = useState(0);

  useEffect(() => {
    const load = async () => {
      const { data: statsData } = await supabase.rpc("get_stats");
      if (statsData && Array.isArray(statsData) && statsData[0]) {
        setStats(statsData[0]);
      }

      const { data: ordersData } = await supabase
        .from("orders")
        .select("id, user_id, product_id, price, quantity, created_at")
        .order("created_at", { ascending: false })
        .limit(6);
      setOrders((ordersData as OrderRow[]) || []);

      const { data: depositsData } = await supabase
        .from("deposits")
        .select("id")
        .eq("status", "pending");
      setPendingDeposits(depositsData?.length ?? 0);

      const { data: withdrawalsData } = await supabase
        .from("withdrawals")
        .select("id")
        .eq("status", "pending");
      setPendingWithdrawals(withdrawalsData?.length ?? 0);
    };

    load();
  }, []);

  return (
    <div className="grid" style={{ gap: 24 }}>
      <div className="topbar">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="muted">Tổng quan hiệu suất shop hôm nay.</p>
        </div>
        <div className="badge">Live Supabase</div>
      </div>

      <div className="grid stats">
        <div className="card">
          <p className="muted">Users</p>
          <h2>{stats.users}</h2>
        </div>
        <div className="card">
          <p className="muted">Orders</p>
          <h2>{stats.orders}</h2>
        </div>
        <div className="card">
          <p className="muted">Revenue (VND)</p>
          <h2>{stats.revenue.toLocaleString()}</h2>
        </div>
        <div className="card">
          <p className="muted">Pending</p>
          <h2>
            {pendingDeposits} nạp / {pendingWithdrawals} rút
          </h2>
        </div>
      </div>

      <div className="card">
        <h3 className="section-title">Đơn hàng gần nhất</h3>
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
                <td colSpan={6} className="muted">
                  Chưa có đơn hàng.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
