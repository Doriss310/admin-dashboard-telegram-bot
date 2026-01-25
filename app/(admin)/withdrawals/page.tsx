"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface Withdrawal {
  id: number;
  user_id: number;
  amount: number;
  momo_phone: string;
  status: string;
  created_at: string;
}

export default function WithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from("withdrawals")
      .select("id, user_id, amount, momo_phone, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setWithdrawals((data as Withdrawal[]) || []);
  };

  useEffect(() => {
    load();
  }, []);

  const confirmWithdrawal = async (withdrawal: Withdrawal) => {
    const { data: userRow } = await supabase
      .from("users")
      .select("balance")
      .eq("user_id", withdrawal.user_id)
      .maybeSingle();

    const balance = userRow?.balance || 0;
    if (balance < withdrawal.amount) {
      alert("Không đủ số dư.");
      return;
    }

    await supabase
      .from("users")
      .update({ balance: balance - withdrawal.amount })
      .eq("user_id", withdrawal.user_id);

    await supabase.from("withdrawals").update({ status: "confirmed" }).eq("id", withdrawal.id);
    await load();
  };

  const cancelWithdrawal = async (withdrawal: Withdrawal) => {
    await supabase.from("withdrawals").update({ status: "cancelled" }).eq("id", withdrawal.id);
    await load();
  };

  return (
    <div className="grid" style={{ gap: 24 }}>
      <div className="topbar">
        <div>
          <h1 className="page-title">Withdrawals</h1>
          <p className="muted">Duyệt các yêu cầu rút tiền.</p>
        </div>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>User</th>
              <th>Số tiền</th>
              <th>Momo</th>
              <th>Thời gian</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {withdrawals.map((withdrawal) => (
              <tr key={withdrawal.id}>
                <td>#{withdrawal.id}</td>
                <td>{withdrawal.user_id}</td>
                <td>{withdrawal.amount.toLocaleString()}</td>
                <td>{withdrawal.momo_phone}</td>
                <td>{new Date(withdrawal.created_at).toLocaleString()}</td>
                <td>
                  <button className="button" onClick={() => confirmWithdrawal(withdrawal)}>Duyệt</button>
                  <button className="button secondary" style={{ marginLeft: 8 }} onClick={() => cancelWithdrawal(withdrawal)}>
                    Từ chối
                  </button>
                </td>
              </tr>
            ))}
            {!withdrawals.length && (
              <tr>
                <td colSpan={6} className="muted">Không có yêu cầu pending.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
