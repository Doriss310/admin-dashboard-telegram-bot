"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const SETTINGS_KEYS = [
  "bank_name",
  "account_number",
  "account_name",
  "sepay_token",
  "binance_pay_id",
  "admin_contact",
  "payment_mode",
  "show_shop",
  "show_balance",
  "show_deposit",
  "show_withdraw",
  "show_usdt",
  "show_history",
  "show_language"
];

const TOGGLE_FIELDS = [
  { key: "show_shop", label: 'Hiện "Danh mục"' },
  { key: "show_balance", label: 'Hiện "Số dư"' },
  { key: "show_deposit", label: 'Hiện "Nạp tiền"' },
  { key: "show_withdraw", label: 'Hiện "Rút tiền"' },
  { key: "show_usdt", label: 'Hiện "Nạp USDT"' },
  { key: "show_history", label: 'Hiện "Lịch sử"' },
  { key: "show_language", label: 'Hiện "Ngôn ngữ"' },
];
const TOGGLE_KEYS = TOGGLE_FIELDS.map((field) => field.key);

export default function SettingsPage() {
  const [values, setValues] = useState<Record<string, string>>({});

  const load = async () => {
    const { data } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", SETTINGS_KEYS);
    const map: Record<string, string> = {};
    (data || []).forEach((row: any) => {
      map[row.key] = row.value;
    });
    setValues(map);
  };

  useEffect(() => {
    load();
  }, []);

  const updateField = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const saveSettings = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload = SETTINGS_KEYS.map((key) => {
      const value = TOGGLE_KEYS.includes(key) ? (values[key] ?? "true") : (values[key] || "");
      return { key, value };
    });
    await supabase.from("settings").upsert(payload);
    await load();
  };

  return (
    <div className="grid" style={{ gap: 24 }}>
      <div className="topbar">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="muted">Cập nhật cấu hình ngân hàng và hệ thống.</p>
        </div>
      </div>

      <div className="card">
        <form className="form-grid" onSubmit={saveSettings}>
          <input
            className="input"
            placeholder="Bank name"
            value={values.bank_name || ""}
            onChange={(e) => updateField("bank_name", e.target.value)}
          />
          <input
            className="input"
            placeholder="Account number"
            value={values.account_number || ""}
            onChange={(e) => updateField("account_number", e.target.value)}
          />
          <input
            className="input"
            placeholder="Account name"
            value={values.account_name || ""}
            onChange={(e) => updateField("account_name", e.target.value)}
          />
          <input
            className="input"
            placeholder="SePay token"
            value={values.sepay_token || ""}
            onChange={(e) => updateField("sepay_token", e.target.value)}
          />
          <input
            className="input"
            placeholder="Binance Pay ID"
            value={values.binance_pay_id || ""}
            onChange={(e) => updateField("binance_pay_id", e.target.value)}
          />
          <input
            className="input"
            placeholder="Admin contact"
            value={values.admin_contact || ""}
            onChange={(e) => updateField("admin_contact", e.target.value)}
          />
          <select
            className="select"
            value={values.payment_mode || "hybrid"}
            onChange={(e) => updateField("payment_mode", e.target.value)}
          >
            <option value="direct">Thanh toán VietQR luôn</option>
            <option value="hybrid">Thiếu balance thì VietQR</option>
            <option value="balance">Chỉ mua bằng balance</option>
          </select>
          <div className="form-section">
            <div className="section-title">Hiển thị menu</div>
            <div className="toggle-grid">
              {TOGGLE_FIELDS.map((field) => {
                const isOn = (values[field.key] ?? "true") !== "false";
                return (
                  <label className="toggle" key={field.key}>
                    <input
                      type="checkbox"
                      checked={isOn}
                      onChange={(e) => updateField(field.key, e.target.checked ? "true" : "false")}
                    />
                    <span>{field.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <button className="button" type="submit">Lưu cấu hình</button>
        </form>
      </div>
    </div>
  );
}
