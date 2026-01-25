"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface Deposit {
  id: number;
  user_id: number;
  amount: number;
  code: string;
  status: string;
  created_at: string;
}

export default function DepositsPage() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from("deposits")
      .select("id, user_id, amount, code, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setDeposits((data as Deposit[]) || []);
  };

  useEffect(() => {
    load();
  }, []);

  const confirmDeposit = async (deposit: Deposit) => {
    await supabase.from("deposits").update({ status: "confirmed" }).eq("id", deposit.id);

    const { data: userRow } = await supabase
      .from("users")
      .select("balance")
      .eq("user_id", deposit.user_id)
      .maybeSingle();
    const newBalance = (userRow?.balance || 0) + deposit.amount;
    await supabase.from("users").update({ balance: newBalance }).eq("user_id", deposit.user_id);
    await load();
  };

  const cancelDeposit = async (deposit: Deposit) => {
    await supabase.from("deposits").update({ status: "cancelled" }).eq("id", deposit.id);
    await load();
  };

  return (
    <div className="grid" style={{ gap: 24 }}>
      <div className="topbar">
        <div>
          <h1 className="page-title">Deposits</h1>
          <p className="muted">Duyệt các yêu cầu nạp tiền.</p>
        </div>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>User</th>
              <th>Số tiền</th>
              <th>Mã</th>
              <th>Thời gian</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {deposits.map((deposit) => (
              <tr key={deposit.id}>
                <td>#{deposit.id}</td>
                <td>{deposit.user_id}</td>
                <td>{deposit.amount.toLocaleString()}</td>
                <td>{deposit.code}</td>
                <td>{new Date(deposit.created_at).toLocaleString()}</td>
                <td>
                  <button className="button" onClick={() => confirmDeposit(deposit)}>Duyệt</button>
                  <button className="button secondary" style={{ marginLeft: 8 }} onClick={() => cancelDeposit(deposit)}>
                    Từ chối
                  </button>
                </td>
              </tr>
            ))}
            {!deposits.length && (
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
