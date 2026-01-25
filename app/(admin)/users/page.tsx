"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface UserRow {
  user_id: number;
  username: string | null;
  balance: number;
  balance_usdt: number;
  language: string | null;
  created_at: string | null;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("users")
      .select("user_id, username, balance, balance_usdt, language, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    setUsers((data as UserRow[]) || []);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!search) return users;
    return users.filter((user) => user.user_id.toString().includes(search));
  }, [search, users]);

  return (
    <div className="grid" style={{ gap: 24 }}>
      <div className="topbar">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="muted">Quản lý người dùng và số dư.</p>
        </div>
      </div>

      <div className="card">
        <div className="form-grid">
          <input
            className="input"
            placeholder="Tìm theo user_id"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>User ID</th>
              <th>Username</th>
              <th>Balance (VND)</th>
              <th>Balance (USDT)</th>
              <th>Lang</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => (
              <tr key={user.user_id}>
                <td>{user.user_id}</td>
                <td>{user.username ?? "-"}</td>
                <td>{(user.balance || 0).toLocaleString()}</td>
                <td>{user.balance_usdt?.toString() ?? "0"}</td>
                <td>{user.language ?? "vi"}</td>
                <td>{user.created_at ? new Date(user.created_at).toLocaleString() : "-"}</td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={6} className="muted">Chưa có dữ liệu.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
