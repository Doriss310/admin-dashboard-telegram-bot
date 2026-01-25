"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface Product {
  id: number;
  name: string;
}

interface StockItem {
  id: number;
  product_id: number;
  content: string;
  sold: boolean;
}

export default function StockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [content, setContent] = useState("");

  const loadProducts = async () => {
    const { data } = await supabase.from("products").select("id, name").order("id");
    setProducts((data as Product[]) || []);
  };

  const loadStock = async (productId: string) => {
    if (!productId) return;
    const { data } = await supabase
      .from("stock")
      .select("id, product_id, content, sold")
      .eq("product_id", Number(productId))
      .order("sold", { ascending: true })
      .order("id", { ascending: false })
      .limit(100);
    setStockItems((data as StockItem[]) || []);
  };

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (selectedProductId) {
      loadStock(selectedProductId);
    }
  }, [selectedProductId]);

  const handleAddStock = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedProductId) return;
    const lines = content
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) return;

    const payload = lines.map((line) => ({
      product_id: Number(selectedProductId),
      content: line
    }));

    await supabase.from("stock").insert(payload);
    setContent("");
    await loadStock(selectedProductId);
  };

  return (
    <div className="grid" style={{ gap: 24 }}>
      <div className="topbar">
        <div>
          <h1 className="page-title">Stock</h1>
          <p className="muted">Quản lý kho sản phẩm.</p>
        </div>
      </div>

      <div className="card">
        <h3 className="section-title">Chọn sản phẩm</h3>
        <div className="form-grid">
          <select
            className="select"
            value={selectedProductId}
            onChange={(event) => setSelectedProductId(event.target.value)}
          >
            <option value="">-- Chọn sản phẩm --</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card">
        <h3 className="section-title">Thêm stock mới</h3>
        <form onSubmit={handleAddStock} className="form-grid">
          <textarea
            className="textarea"
            placeholder="Mỗi dòng là 1 stock"
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
          <button className="button" type="submit">Thêm stock</button>
        </form>
      </div>

      <div className="card">
        <h3 className="section-title">Danh sách stock (tối đa 100 dòng)</h3>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nội dung</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {stockItems.map((item) => (
              <tr key={item.id}>
                <td>#{item.id}</td>
                <td>{item.content}</td>
                <td>{item.sold ? "Đã bán" : "Còn"}</td>
              </tr>
            ))}
            {!stockItems.length && (
              <tr>
                <td colSpan={3} className="muted">Chưa có stock.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
