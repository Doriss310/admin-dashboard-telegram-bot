"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface RevenueStats {
  last7: number;
  last30: number;
  today: number;
}

interface DirectOrderStats {
  total: number;
  confirmed: number;
  failed: number;
  pending: number;
}

export default function ReportsPage() {
  const [stats, setStats] = useState<RevenueStats>({ last7: 0, last30: 0, today: 0 });
  const [directOrderStats, setDirectOrderStats] = useState<DirectOrderStats>({
    total: 0,
    confirmed: 0,
    failed: 0,
    pending: 0
  });

  useEffect(() => {
    const load = async () => {
      const now = new Date();
      const start30 = new Date();
      start30.setDate(now.getDate() - 30);
      const { data: ordersData } = await supabase
        .from("orders")
        .select("price, created_at")
        .gte("created_at", start30.toISOString());

      const orders = ordersData || [];
      const start7 = new Date();
      start7.setDate(now.getDate() - 7);
      const startToday = new Date();
      startToday.setHours(0, 0, 0, 0);

      let last7 = 0;
      let last30 = 0;
      let today = 0;

      orders.forEach((order: any) => {
        const price = order.price || 0;
        const created = new Date(order.created_at);
        if (created >= start30) last30 += price;
        if (created >= start7) last7 += price;
        if (created >= startToday) today += price;
      });

      setStats({ last7, last30, today });

      const [totalRes, confirmedRes, failedRes, pendingRes] = await Promise.all([
        supabase.from("direct_orders").select("id", { count: "exact", head: true }),
        supabase.from("direct_orders").select("id", { count: "exact", head: true }).eq("status", "confirmed"),
        supabase
          .from("direct_orders")
          .select("id", { count: "exact", head: true })
          .in("status", ["failed", "cancelled"]),
        supabase.from("direct_orders").select("id", { count: "exact", head: true }).eq("status", "pending")
      ]);

      setDirectOrderStats({
        total: totalRes.count ?? 0,
        confirmed: confirmedRes.count ?? 0,
        failed: failedRes.count ?? 0,
        pending: pendingRes.count ?? 0
      });
    };

    load();
  }, []);

  return (
    <div className="grid" style={{ gap: 24 }}>
      <div className="topbar">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="muted">Doanh thu theo giai đoạn.</p>
        </div>
      </div>

      <div className="grid stats">
        <div className="card">
          <p className="muted">Hôm nay</p>
          <h2>{stats.today.toLocaleString("vi-VN")}</h2>
        </div>
        <div className="card">
          <p className="muted">7 ngày</p>
          <h2>{stats.last7.toLocaleString("vi-VN")}</h2>
        </div>
        <div className="card">
          <p className="muted">30 ngày</p>
          <h2>{stats.last30.toLocaleString("vi-VN")}</h2>
        </div>
      </div>

      <div className="grid stats">
        <div className="card">
          <p className="muted">Tổng đơn hàng</p>
          <h2>{directOrderStats.total.toLocaleString("vi-VN")}</h2>
        </div>
        <div className="card">
          <p className="muted">Đơn hàng đã bán</p>
          <h2>{directOrderStats.confirmed.toLocaleString("vi-VN")}</h2>
        </div>
        <div className="card">
          <p className="muted">Đơn hàng thất bại</p>
          <h2>{directOrderStats.failed.toLocaleString("vi-VN")}</h2>
        </div>
        <div className="card">
          <p className="muted">Đơn hàng đang thực hiện</p>
          <h2>{directOrderStats.pending.toLocaleString("vi-VN")}</h2>
        </div>
      </div>
    </div>
  );
}
