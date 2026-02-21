"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface RevenueStats {
  today: number;
  yesterday: number;
  last7: number;
  previous7: number;
  last30: number;
}

interface OrderOpsStats {
  ordersToday: number;
  ordersLast7: number;
  ordersLast30: number;
  averageOrderValue30: number;
  averageQuantity30: number;
}

interface DirectOrderStats {
  total: number;
  confirmed: number;
  failed: number;
  cancelled: number;
  pending: number;
  pendingExpired: number;
  confirmedRate: number;
  failedRate: number;
}

interface DailyTrendRow {
  dateKey: string;
  label: string;
  orders: number;
  revenue: number;
}

interface TopProductRow {
  productId: string;
  productName: string;
  orders: number;
  quantity: number;
  revenue: number;
}

interface OrderMetricRow {
  product_id: number | string | null;
  price: number | null;
  quantity: number | null;
  created_at: string | null;
}

const TZ = "Asia/Ho_Chi_Minh";

const toDateKey = (value: Date | string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(typeof value === "string" ? new Date(value) : value);

const toShortDateLabel = (value: Date) =>
  new Intl.DateTimeFormat("vi-VN", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit"
  }).format(value);

const calcDeltaPercent = (current: number, previous: number) => {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

const formatDelta = (value: number) => {
  if (!Number.isFinite(value)) return "0%";
  const rounded = Math.round(value * 10) / 10;
  if (rounded > 0) return `+${rounded}%`;
  return `${rounded}%`;
};

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [revenue, setRevenue] = useState<RevenueStats>({
    today: 0,
    yesterday: 0,
    last7: 0,
    previous7: 0,
    last30: 0
  });
  const [orderOps, setOrderOps] = useState<OrderOpsStats>({
    ordersToday: 0,
    ordersLast7: 0,
    ordersLast30: 0,
    averageOrderValue30: 0,
    averageQuantity30: 0
  });
  const [directOrderStats, setDirectOrderStats] = useState<DirectOrderStats>({
    total: 0,
    confirmed: 0,
    failed: 0,
    cancelled: 0,
    pending: 0,
    pendingExpired: 0,
    confirmedRate: 0,
    failedRate: 0
  });
  const [dailyTrend, setDailyTrend] = useState<DailyTrendRow[]>([]);
  const [topProducts, setTopProducts] = useState<TopProductRow[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      const now = new Date();
      const startToday = new Date(now);
      startToday.setHours(0, 0, 0, 0);
      const startYesterday = new Date(startToday);
      startYesterday.setDate(startYesterday.getDate() - 1);

      const start7 = new Date(now);
      start7.setDate(start7.getDate() - 7);
      const startPrev7 = new Date(start7);
      startPrev7.setDate(startPrev7.getDate() - 7);
      const start30 = new Date(now);
      start30.setDate(start30.getDate() - 30);
      const start60 = new Date(now);
      start60.setDate(start60.getDate() - 60);

      const pendingExpiredBefore = new Date(now.getTime() - 10 * 60 * 1000).toISOString();

      const trendSeed = new Map<string, DailyTrendRow>();
      for (let i = 6; i >= 0; i -= 1) {
        const d = new Date(startToday);
        d.setDate(startToday.getDate() - i);
        const key = toDateKey(d);
        trendSeed.set(key, {
          dateKey: key,
          label: toShortDateLabel(d),
          orders: 0,
          revenue: 0
        });
      }

      const [
        ordersRes,
        directTotalRes,
        directConfirmedRes,
        directFailedRes,
        directCancelledRes,
        directPendingRes,
        directPendingExpiredRes
      ] = await Promise.all([
        supabase
          .from("orders")
          .select("product_id, price, quantity, created_at")
          .gte("created_at", start60.toISOString()),
        supabase.from("direct_orders").select("id", { count: "exact", head: true }),
        supabase.from("direct_orders").select("id", { count: "exact", head: true }).eq("status", "confirmed"),
        supabase.from("direct_orders").select("id", { count: "exact", head: true }).eq("status", "failed"),
        supabase.from("direct_orders").select("id", { count: "exact", head: true }).eq("status", "cancelled"),
        supabase.from("direct_orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase
          .from("direct_orders")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
          .lt("created_at", pendingExpiredBefore)
      ]);

      if (ordersRes.error) {
        setError(ordersRes.error.message);
        setLoading(false);
        return;
      }

      const rows = (ordersRes.data as OrderMetricRow[]) || [];

      let todayRevenue = 0;
      let yesterdayRevenue = 0;
      let last7Revenue = 0;
      let previous7Revenue = 0;
      let last30Revenue = 0;

      let ordersToday = 0;
      let ordersLast7 = 0;
      let ordersLast30 = 0;
      let quantityLast30 = 0;

      const topByProduct = new Map<
        string,
        { productId: string; orders: number; quantity: number; revenue: number }
      >();

      for (const row of rows) {
        if (!row.created_at) continue;
        const created = new Date(row.created_at);
        if (Number.isNaN(created.getTime())) continue;

        const price = Number(row.price || 0);
        const quantity = Number(row.quantity || 0);

        if (created >= startToday) {
          todayRevenue += price;
          ordersToday += 1;
        } else if (created >= startYesterday && created < startToday) {
          yesterdayRevenue += price;
        }

        if (created >= start7) {
          last7Revenue += price;
          ordersLast7 += 1;
        } else if (created >= startPrev7 && created < start7) {
          previous7Revenue += price;
        }

        if (created >= start30) {
          last30Revenue += price;
          ordersLast30 += 1;
          quantityLast30 += quantity;

          const productId = row.product_id !== null && row.product_id !== undefined ? String(row.product_id) : "-";
          const current = topByProduct.get(productId) || {
            productId,
            orders: 0,
            quantity: 0,
            revenue: 0
          };
          current.orders += 1;
          current.quantity += quantity;
          current.revenue += price;
          topByProduct.set(productId, current);
        }

        const trendKey = toDateKey(created);
        const trendRow = trendSeed.get(trendKey);
        if (trendRow) {
          trendRow.orders += 1;
          trendRow.revenue += price;
        }
      }

      setRevenue({
        today: todayRevenue,
        yesterday: yesterdayRevenue,
        last7: last7Revenue,
        previous7: previous7Revenue,
        last30: last30Revenue
      });

      setOrderOps({
        ordersToday,
        ordersLast7,
        ordersLast30,
        averageOrderValue30: ordersLast30 > 0 ? last30Revenue / ordersLast30 : 0,
        averageQuantity30: ordersLast30 > 0 ? quantityLast30 / ordersLast30 : 0
      });

      const total = directTotalRes.count ?? 0;
      const confirmed = directConfirmedRes.count ?? 0;
      const failed = directFailedRes.count ?? 0;
      const cancelled = directCancelledRes.count ?? 0;
      const pending = directPendingRes.count ?? 0;
      const pendingExpired = directPendingExpiredRes.count ?? 0;
      const processed = confirmed + failed + cancelled;
      const failedOverall = failed + cancelled;

      setDirectOrderStats({
        total,
        confirmed,
        failed,
        cancelled,
        pending,
        pendingExpired,
        confirmedRate: processed > 0 ? (confirmed / processed) * 100 : 0,
        failedRate: processed > 0 ? (failedOverall / processed) * 100 : 0
      });

      setDailyTrend(Array.from(trendSeed.values()));

      const sortedTop = Array.from(topByProduct.values())
        .sort((a, b) => {
          if (b.revenue !== a.revenue) return b.revenue - a.revenue;
          if (b.quantity !== a.quantity) return b.quantity - a.quantity;
          return b.orders - a.orders;
        })
        .slice(0, 8);

      const topIds = sortedTop
        .map((row) => row.productId)
        .filter((id) => id !== "-");

      const productNamesById: Record<string, string> = {};
      if (topIds.length) {
        const { data: productRows } = await supabase.from("products").select("id, name").in("id", topIds);
        for (const product of productRows ?? []) {
          const id = (product as { id: number | string }).id;
          const name = (product as { name: string }).name;
          if (id !== null && id !== undefined) {
            productNamesById[String(id)] = name;
          }
        }
      }

      const topRows: TopProductRow[] = sortedTop.map((row) => ({
        productId: row.productId,
        productName: productNamesById[row.productId] || `#${row.productId}`,
        orders: row.orders,
        quantity: row.quantity,
        revenue: row.revenue
      }));
      setTopProducts(topRows);

      setLoading(false);
    };

    load();
  }, []);

  const todayDelta = useMemo(
    () => calcDeltaPercent(revenue.today, revenue.yesterday),
    [revenue.today, revenue.yesterday]
  );
  const weekDelta = useMemo(
    () => calcDeltaPercent(revenue.last7, revenue.previous7),
    [revenue.last7, revenue.previous7]
  );

  return (
    <div className="grid" style={{ gap: 24 }}>
      <div className="topbar">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="muted">Báo cáo vận hành và hiệu suất bán hàng.</p>
        </div>
      </div>

      {error && (
        <div className="card">
          <p className="muted">Lỗi tải báo cáo: {error}</p>
        </div>
      )}

      <div className="grid stats">
        <div className="card">
          <p className="muted">Doanh thu hôm nay</p>
          <h2>{revenue.today.toLocaleString("vi-VN")}</h2>
          <p className="muted" style={{ marginTop: 4 }}>
            So với hôm qua: {formatDelta(todayDelta)}
          </p>
        </div>
        <div className="card">
          <p className="muted">Doanh thu 7 ngày</p>
          <h2>{revenue.last7.toLocaleString("vi-VN")}</h2>
          <p className="muted" style={{ marginTop: 4 }}>
            So với 7 ngày trước: {formatDelta(weekDelta)}
          </p>
        </div>
        <div className="card">
          <p className="muted">Doanh thu 30 ngày</p>
          <h2>{revenue.last30.toLocaleString("vi-VN")}</h2>
          <p className="muted" style={{ marginTop: 4 }}>
            AOV 30 ngày: {Math.round(orderOps.averageOrderValue30).toLocaleString("vi-VN")}
          </p>
        </div>
      </div>

      <div className="grid stats">
        <div className="card">
          <p className="muted">Số đơn hôm nay</p>
          <h2>{orderOps.ordersToday.toLocaleString("vi-VN")}</h2>
        </div>
        <div className="card">
          <p className="muted">Số đơn 7 ngày</p>
          <h2>{orderOps.ordersLast7.toLocaleString("vi-VN")}</h2>
        </div>
        <div className="card">
          <p className="muted">Số đơn 30 ngày</p>
          <h2>{orderOps.ordersLast30.toLocaleString("vi-VN")}</h2>
        </div>
        <div className="card">
          <p className="muted">SL account TB / đơn (30d)</p>
          <h2>{orderOps.averageQuantity30.toFixed(2)}</h2>
        </div>
      </div>

      <div className="grid stats">
        <div className="card">
          <p className="muted">Direct order đã duyệt</p>
          <h2>{directOrderStats.confirmed.toLocaleString("vi-VN")}</h2>
          <p className="muted" style={{ marginTop: 4 }}>
            Tỉ lệ duyệt: {directOrderStats.confirmedRate.toFixed(1)}%
          </p>
        </div>
        <div className="card">
          <p className="muted">Direct order thất bại + hủy</p>
          <h2>{(directOrderStats.failed + directOrderStats.cancelled).toLocaleString("vi-VN")}</h2>
          <p className="muted" style={{ marginTop: 4 }}>
            Tỉ lệ thất bại: {directOrderStats.failedRate.toFixed(1)}%
          </p>
        </div>
        <div className="card">
          <p className="muted">Direct order đang chờ</p>
          <h2>{directOrderStats.pending.toLocaleString("vi-VN")}</h2>
          <p className="muted" style={{ marginTop: 4 }}>
            Quá hạn 10 phút: {directOrderStats.pendingExpired.toLocaleString("vi-VN")}
          </p>
        </div>
        <div className="card">
          <p className="muted">Tổng direct order</p>
          <h2>{directOrderStats.total.toLocaleString("vi-VN")}</h2>
        </div>
      </div>

      <div className="card">
        <h3 className="section-title">Xu hướng 7 ngày gần nhất</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Số đơn</th>
              <th>Doanh thu (VND)</th>
            </tr>
          </thead>
          <tbody>
            {dailyTrend.map((row) => (
              <tr key={row.dateKey}>
                <td>{row.label}</td>
                <td>{row.orders.toLocaleString("vi-VN")}</td>
                <td>{row.revenue.toLocaleString("vi-VN")}</td>
              </tr>
            ))}
            {!dailyTrend.length && (
              <tr>
                <td colSpan={3} className="muted">
                  {loading ? "Đang tải..." : "Chưa có dữ liệu."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 className="section-title">Top sản phẩm 30 ngày (theo doanh thu)</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Sản phẩm</th>
              <th>Số đơn</th>
              <th>Tổng SL</th>
              <th>Doanh thu (VND)</th>
            </tr>
          </thead>
          <tbody>
            {topProducts.map((row) => (
              <tr key={row.productId}>
                <td>{row.productName}</td>
                <td>{row.orders.toLocaleString("vi-VN")}</td>
                <td>{row.quantity.toLocaleString("vi-VN")}</td>
                <td>{row.revenue.toLocaleString("vi-VN")}</td>
              </tr>
            ))}
            {!topProducts.length && (
              <tr>
                <td colSpan={4} className="muted">
                  {loading ? "Đang tải..." : "Chưa có dữ liệu sản phẩm."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
