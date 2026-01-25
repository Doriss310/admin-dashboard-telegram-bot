"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface Product {
  id: number;
  name: string;
  price: number;
  price_usdt: number;
  description: string | null;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [priceUsdt, setPriceUsdt] = useState("");
  const [description, setDescription] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("products")
      .select("id, name, price, price_usdt, description")
      .order("id");
    setProducts((data as Product[]) || []);
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    await supabase.from("products").insert({
      name,
      price: parseInt(price || "0", 10),
      price_usdt: parseFloat(priceUsdt || "0"),
      description
    });
    setName("");
    setPrice("");
    setPriceUsdt("");
    setDescription("");
    await load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Xóa sản phẩm này?")) return;
    await supabase.from("products").delete().eq("id", id);
    await load();
  };

  const handleUpdateUsdt = async (product: Product) => {
    const value = prompt("Giá USDT mới", product.price_usdt?.toString() || "0");
    if (value === null) return;
    const parsed = parseFloat(value);
    if (Number.isNaN(parsed)) return;
    await supabase.from("products").update({ price_usdt: parsed }).eq("id", product.id);
    await load();
  };

  return (
    <div className="grid" style={{ gap: 24 }}>
      <div className="topbar">
        <div>
          <h1 className="page-title">Products</h1>
          <p className="muted">Quản lý danh sách sản phẩm và giá bán.</p>
        </div>
      </div>

      <div className="card">
        <h3 className="section-title">Thêm sản phẩm mới</h3>
        <form className="form-grid" onSubmit={handleAdd}>
          <input className="input" placeholder="Tên sản phẩm" value={name} onChange={(e) => setName(e.target.value)} required />
          <input className="input" placeholder="Giá (VND)" value={price} onChange={(e) => setPrice(e.target.value)} required />
          <input className="input" placeholder="Giá (USDT)" value={priceUsdt} onChange={(e) => setPriceUsdt(e.target.value)} />
          <input className="input" placeholder="Mô tả" value={description} onChange={(e) => setDescription(e.target.value)} />
          <button className="button" type="submit">Thêm</button>
        </form>
      </div>

      <div className="card">
        <h3 className="section-title">Danh sách sản phẩm</h3>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Tên</th>
              <th>Giá (VND)</th>
              <th>Giá (USDT)</th>
              <th>Mô tả</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td>#{product.id}</td>
                <td>{product.name}</td>
                <td>{product.price.toLocaleString()}</td>
                <td>{product.price_usdt?.toString() ?? "0"}</td>
                <td>{product.description ?? ""}</td>
                <td>
                  <button className="button secondary" onClick={() => handleUpdateUsdt(product)}>USDT</button>
                  <button className="button danger" style={{ marginLeft: 8 }} onClick={() => handleDelete(product.id)}>Xóa</button>
                </td>
              </tr>
            ))}
            {!products.length && (
              <tr>
                <td colSpan={6} className="muted">Chưa có sản phẩm.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
