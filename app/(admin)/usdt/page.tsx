"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface BinanceDeposit {
  id: number;
  user_id: number;
  usdt_amount: number;
  vnd_amount: number;
  code: string;
  screenshot_file_id: string | null;
  status: string;
  created_at: string;
}

interface UsdtWithdrawal {
  id: number;
  user_id: number;
  usdt_amount: number;
  wallet_address: string;
  network: string;
  status: string;
  created_at: string;
}

export default function UsdtPage() {
  const [binanceDeposits, setBinanceDeposits] = useState<BinanceDeposit[]>([]);
  const [usdtWithdrawals, setUsdtWithdrawals] = useState<UsdtWithdrawal[]>([]);

  const load = async () => {
    const { data: deposits } = await supabase
      .from("binance_deposits")
      .select("id, user_id, usdt_amount, vnd_amount, code, screenshot_file_id, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setBinanceDeposits((deposits as BinanceDeposit[]) || []);

    const { data: withdrawals } = await supabase
      .from("usdt_withdrawals")
      .select("id, user_id, usdt_amount, wallet_address, network, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setUsdtWithdrawals((withdrawals as UsdtWithdrawal[]) || []);
  };

  useEffect(() => {
    load();
  }, []);

  const confirmBinance = async (deposit: BinanceDeposit) => {
    await supabase.from("binance_deposits").update({ status: "confirmed" }).eq("id", deposit.id);

    const { data: userRow } = await supabase
      .from("users")
      .select("balance_usdt")
      .eq("user_id", deposit.user_id)
      .maybeSingle();
    const newBalance = (userRow?.balance_usdt || 0) + deposit.usdt_amount;
    await supabase.from("users").update({ balance_usdt: newBalance }).eq("user_id", deposit.user_id);
    await load();
  };

  const cancelBinance = async (deposit: BinanceDeposit) => {
    await supabase.from("binance_deposits").update({ status: "cancelled" }).eq("id", deposit.id);
    await load();
  };

  const confirmUsdtWithdrawal = async (withdrawal: UsdtWithdrawal) => {
    const { data: userRow } = await supabase
      .from("users")
      .select("balance_usdt")
      .eq("user_id", withdrawal.user_id)
      .maybeSingle();
    const balance = userRow?.balance_usdt || 0;
    if (balance < withdrawal.usdt_amount) {
      alert("Không đủ số dư USDT.");
      return;
    }
    await supabase
      .from("users")
      .update({ balance_usdt: balance - withdrawal.usdt_amount })
      .eq("user_id", withdrawal.user_id);
    await supabase.from("usdt_withdrawals").update({ status: "confirmed" }).eq("id", withdrawal.id);
    await load();
  };

  const cancelUsdtWithdrawal = async (withdrawal: UsdtWithdrawal) => {
    await supabase.from("usdt_withdrawals").update({ status: "cancelled" }).eq("id", withdrawal.id);
    await load();
  };

  return (
    <div className="grid" style={{ gap: 24 }}>
      <div className="topbar">
        <div>
          <h1 className="page-title">USDT</h1>
          <p className="muted">Duyệt nạp USDT và rút USDT.</p>
        </div>
      </div>

      <div className="card">
        <h3 className="section-title">Nạp USDT (Binance)</h3>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>User</th>
              <th>USDT</th>
              <th>VND</th>
              <th>Code</th>
              <th>Time</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {binanceDeposits.map((deposit) => (
              <tr key={deposit.id}>
                <td>#{deposit.id}</td>
                <td>{deposit.user_id}</td>
                <td>{deposit.usdt_amount}</td>
                <td>{deposit.vnd_amount.toLocaleString()}</td>
                <td>{deposit.code}</td>
                <td>{new Date(deposit.created_at).toLocaleString()}</td>
                <td>
                  <button className="button" onClick={() => confirmBinance(deposit)}>Duyệt</button>
                  <button className="button secondary" style={{ marginLeft: 8 }} onClick={() => cancelBinance(deposit)}>
                    Từ chối
                  </button>
                </td>
              </tr>
            ))}
            {!binanceDeposits.length && (
              <tr>
                <td colSpan={7} className="muted">Không có yêu cầu.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 className="section-title">Rút USDT</h3>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>User</th>
              <th>USDT</th>
              <th>Wallet</th>
              <th>Network</th>
              <th>Time</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {usdtWithdrawals.map((withdrawal) => (
              <tr key={withdrawal.id}>
                <td>#{withdrawal.id}</td>
                <td>{withdrawal.user_id}</td>
                <td>{withdrawal.usdt_amount}</td>
                <td>{withdrawal.wallet_address}</td>
                <td>{withdrawal.network}</td>
                <td>{new Date(withdrawal.created_at).toLocaleString()}</td>
                <td>
                  <button className="button" onClick={() => confirmUsdtWithdrawal(withdrawal)}>Duyệt</button>
                  <button className="button secondary" style={{ marginLeft: 8 }} onClick={() => cancelUsdtWithdrawal(withdrawal)}>
                    Từ chối
                  </button>
                </td>
              </tr>
            ))}
            {!usdtWithdrawals.length && (
              <tr>
                <td colSpan={7} className="muted">Không có yêu cầu.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
