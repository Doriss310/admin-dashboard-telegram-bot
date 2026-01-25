"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface RevenueStats {
  last7: number;
  last30: number;
  today: number;
}

export default function ReportsPage() {
  const [stats, setStats] = useState<RevenueStats>({ last7: 0, last30: 0, today: 0 });

  useEffect(() => {
    const load = async () => {
      const now = new Date();
      const start30 = new Date();
      start30.setDate(now.getDate() - 30);
      const { data } = await supabase
        .from("orders")
        .select("price, created_at")
        .gte("created_at", start30.toISOString());

      const orders = data || [];
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
          <h2>{stats.today.toLocaleString()}</h2>
        </div>
        <div className="card">
          <p className="muted">7 ngày</p>
          <h2>{stats.last7.toLocaleString()}</h2>
        </div>
        <div className="card">
          <p className="muted">30 ngày</p>
          <h2>{stats.last30.toLocaleString()}</h2>
        </div>
      </div>
    </div>
  );
}
