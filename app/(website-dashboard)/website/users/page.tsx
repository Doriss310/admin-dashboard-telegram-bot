"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface WebsiteUserBaseRow {
  id: number;
  auth_user_id: string;
  email: string | null;
  display_name: string | null;
  created_at: string | null;
  updated_at: string | null;
  last_sign_in_at: string | null;
}

interface WebsiteOrderStatRow {
  auth_user_id: string | null;
  price: number | null;
}

interface WebsiteUserRow extends WebsiteUserBaseRow {
  order_count: number;
  total_paid: number;
}

export default function WebsiteUsersPage() {
  const [users, setUsers] = useState<WebsiteUserRow[]>([]);
  const [search, setSearch] = useState("");
  const [warning, setWarning] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("website_users")
      .select("id, auth_user_id, email, display_name, created_at, updated_at, last_sign_in_at")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      setWarning(
        "Thiếu bảng website_users hoặc chưa có quyền. User Website chỉ xuất hiện sau khi user đăng ký/đăng nhập trên Website."
      );
      setUsers([]);
      return;
    }
    setWarning(null);

    const baseUsers = (data as WebsiteUserBaseRow[]) || [];
    if (!baseUsers.length) {
      setUsers([]);
      return;
    }

    const authIds = baseUsers.map((row) => row.auth_user_id);
    const { data: orderData } = await supabase
      .from("website_orders")
      .select("auth_user_id, price")
      .in("auth_user_id", authIds);

    const statsByUser = new Map<string, { orderCount: number; totalPaid: number }>();
    ((orderData as WebsiteOrderStatRow[]) || []).forEach((order) => {
      const key = String(order.auth_user_id || "");
      if (!key) return;
      const current = statsByUser.get(key) || { orderCount: 0, totalPaid: 0 };
      current.orderCount += 1;
      current.totalPaid += Number(order.price || 0);
      statsByUser.set(key, current);
    });

    setUsers(
      baseUsers.map((user) => {
        const stats = statsByUser.get(user.auth_user_id);
        return {
          ...user,
          order_count: stats?.orderCount ?? 0,
          total_paid: stats?.totalPaid ?? 0
        };
      })
    );
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return users;
    return users.filter((user) => {
      const authId = (user.auth_user_id || "").toLowerCase();
      const email = (user.email || "").toLowerCase();
      const displayName = (user.display_name || "").toLowerCase();
      return authId.includes(keyword) || email.includes(keyword) || displayName.includes(keyword);
    });
  }, [search, users]);

  return (
    <div className="grid" style={{ gap: 24 }}>
      <div className="topbar">
        <div>
          <h1 className="page-title">Website Users</h1>
          <p className="muted">Danh sách user account đã đăng nhập trên Website.</p>
        </div>
      </div>

      <div className="card">
        <div className="form-grid">
          <input
            className="input"
            placeholder="Tìm theo auth_user_id / email / tên hiển thị"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      {warning && (
        <div className="card">
          <p className="muted" style={{ color: "var(--danger)" }}>
            {warning}
          </p>
        </div>
      )}

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Auth User ID</th>
              <th>Email</th>
              <th>Tên hiển thị</th>
              <th>Đơn đã mua</th>
              <th>Tổng đã mua (VND)</th>
              <th>Đăng ký lúc</th>
              <th>Lần đăng nhập gần nhất</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => (
              <tr key={user.id}>
                <td>#{user.id}</td>
                <td>{user.auth_user_id}</td>
                <td>{user.email || "-"}</td>
                <td>{user.display_name || "-"}</td>
                <td>{user.order_count.toLocaleString("vi-VN")}</td>
                <td>{user.total_paid.toLocaleString("vi-VN")}</td>
                <td>{user.created_at ? new Date(user.created_at).toLocaleString("vi-VN") : "-"}</td>
                <td>{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString("vi-VN") : "-"}</td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={8} className="muted">
                  Chưa có user Website.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
