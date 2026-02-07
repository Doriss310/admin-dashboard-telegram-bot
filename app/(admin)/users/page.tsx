"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

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

  const sendMessageRequest = async (payload: { message: string; userId?: number; broadcast?: boolean }) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setStatus("Chưa đăng nhập.");
      return;
    }
    setSending(true);
    setStatus(null);
    try {
      const res = await fetch("/api/telegram/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (!res.ok) {
        setStatus(result.error || "Gửi thất bại.");
        return;
      }
      if (payload.broadcast) {
        setStatus(`✅ Đã gửi ${result.success}/${result.total}.`);
      } else {
        setStatus(`✅ Đã gửi cho user ${payload.userId}.`);
      }
    } catch (error) {
      setStatus("Gửi thất bại.");
    } finally {
      setSending(false);
    }
  };

  const handleBroadcast = async () => {
    const message = broadcastMessage.trim();
    if (!message) return;
    if (!confirm("Gửi tin nhắn cho TẤT CẢ user đã nhắn bot?")) return;
    await sendMessageRequest({ message, broadcast: true });
    setBroadcastMessage("");
  };

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
        <h3 className="section-title">Gửi tin nhắn cho tất cả user</h3>
        <div className="form-grid">
          <textarea
            className="textarea"
            placeholder="Nhập nội dung gửi cho tất cả user đã nhắn bot"
            value={broadcastMessage}
            onChange={(event) => setBroadcastMessage(event.target.value)}
          />
          <button className="button" type="button" disabled={sending} onClick={handleBroadcast}>
            {sending ? "Đang gửi..." : "Gửi tất cả"}
          </button>
        </div>
        {status && <p className="muted" style={{ marginTop: 8 }}>{status}</p>}
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
              <th>Hành động</th>
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
                <td>
                  <Link className="button secondary" href={`/users/${user.user_id}`}>
                    Nhắn tin
                  </Link>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={7} className="muted">Chưa có dữ liệu.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
