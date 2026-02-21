"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Stats = { users: number; orders: number; revenue: number };

type OrderRow = {
  id: number | string;
  user_id: number | string;
  product_id: number | string;
  price: number;
  quantity: number;
  created_at: string;
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ users: 0, orders: 0, revenue: 0 });
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [usernamesByUserId, setUsernamesByUserId] = useState<Record<string, string | null>>({});
  const [productNamesById, setProductNamesById] = useState<Record<string, string>>({});
  const [pendingDeposits, setPendingDeposits] = useState(0);
  const [pendingWithdrawals, setPendingWithdrawals] = useState(0);

  useEffect(() => {
    const load = async () => {
      const [usersCountRes, ordersDataRes] = await Promise.all([
        supabase.from("users").select("user_id", { count: "exact", head: true }),
        supabase
          .from("orders")
          .select("id, user_id, product_id, price, quantity, created_at")
          .order("created_at", { ascending: false })
          .limit(5000)
      ]);

      const allOrders = (ordersDataRes.data as OrderRow[]) || [];
      const revenue = allOrders.reduce((sum, row) => sum + Number(row.price || 0), 0);
      setStats({
        users: usersCountRes.count ?? 0,
        orders: allOrders.length,
        revenue
      });

      const latestOrders = allOrders.slice(0, 6);
      setOrders(latestOrders);

      // Fetch usernames and product names for the visible rows (keeps the dashboard query simple).
      const userIds = Array.from(
        new Set(
          latestOrders
            .map((o) => o.user_id)
            .filter((v): v is number | string => v !== null && v !== undefined)
            .map(String)
        )
      );
      const productIds = Array.from(
        new Set(
          latestOrders
            .map((o) => o.product_id)
            .filter((v): v is number | string => v !== null && v !== undefined)
            .map(String)
        )
      );

      const [usersRes, productsRes] = await Promise.all([
        userIds.length
          ? supabase.from("users").select("user_id, username").in("user_id", userIds)
          : Promise.resolve({ data: [] as Array<{ user_id: number | string; username: string | null }> }),
        productIds.length
          ? supabase.from("products").select("id, name").in("id", productIds)
          : Promise.resolve({ data: [] as Array<{ id: number | string; name: string }> })
      ]);

      const usernames: Record<string, string | null> = {};
      for (const u of usersRes.data ?? []) {
        if (u?.user_id !== null && u?.user_id !== undefined) {
          usernames[String(u.user_id)] = u.username ?? null;
        }
      }
      setUsernamesByUserId(usernames);

      const productNames: Record<string, string> = {};
      for (const p of productsRes.data ?? []) {
        if (p?.id !== null && p?.id !== undefined) {
          productNames[String(p.id)] = p.name;
        }
      }
      setProductNamesById(productNames);

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

  const formatDateTime = (isoString: string | null | undefined) => {
    if (!isoString) return "-";
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return isoString;
    return new Intl.DateTimeFormat("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(date);
  };

  return (
    <div className="grid" style={{ gap: 24 }}>
      <div className="topbar">
        <div>
          <h1 className="page-title">Tổng quan</h1>
          <p className="muted">Tổng quan hiệu suất shop hôm nay.</p>
        </div>
        <div className="badge">Live Supabase</div>
      </div>

      <div className="grid stats">
        <div className="card">
          <p className="muted">Người dùng</p>
          <h2>{stats.users}</h2>
        </div>
        <div className="card">
          <p className="muted">Đơn hàng</p>
          <h2>{stats.orders}</h2>
        </div>
        <div className="card">
          <p className="muted">Doanh thu (VND)</p>
          <h2>{stats.revenue.toLocaleString("vi-VN")}</h2>
        </div>
        <div className="card">
          <p className="muted">Đang chờ</p>
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
              <th>UserID</th>
              <th>Username</th>
              <th>Sản phẩm</th>
              <th>SL</th>
              <th>Giá</th>
              <th>Thời gian</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>#{order.id}</td>
                <td>{order.user_id}</td>
                <td>{usernamesByUserId[String(order.user_id)] || "-"}</td>
                <td>{productNamesById[String(order.product_id)] || order.product_id}</td>
                <td>{order.quantity}</td>
                <td>{order.price.toLocaleString("vi-VN")}</td>
                <td>{formatDateTime(order.created_at)}</td>
              </tr>
            ))}
            {!orders.length && (
              <tr>
                <td colSpan={7} className="muted">
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
