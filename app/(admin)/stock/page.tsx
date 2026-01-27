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
  const PAGE_SIZE = 100;
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [content, setContent] = useState("");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const [editingStock, setEditingStock] = useState<StockItem | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editSold, setEditSold] = useState(false);
  const [deleteStock, setDeleteStock] = useState<StockItem | null>(null);

  const loadProducts = async () => {
    const { data } = await supabase.from("products").select("id, name").order("id");
    setProducts((data as Product[]) || []);
  };

  const loadStock = async (productId: string, pageIndex = page) => {
    if (!productId) return;
    const from = (pageIndex - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, count } = await supabase
      .from("stock")
      .select("id, product_id, content, sold", { count: "exact" })
      .eq("product_id", Number(productId))
      .order("sold", { ascending: true })
      .order("id", { ascending: false })
      .range(from, to);
    setStockItems((data as StockItem[]) || []);
    setTotalCount(count ?? 0);
  };

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (!selectedProductId) {
      setStockItems([]);
      setTotalCount(0);
      return;
    }
    setPage(1);
  }, [selectedProductId]);

  useEffect(() => {
    if (selectedProductId) {
      loadStock(selectedProductId, page);
    }
  }, [selectedProductId, page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

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
    if (page === 1) {
      await loadStock(selectedProductId, 1);
    } else {
      setPage(1);
    }
  };

  const startEdit = (item: StockItem) => {
    setEditingStock(item);
    setEditContent(item.content);
    setEditSold(item.sold);
  };

  const cancelEdit = () => {
    setEditingStock(null);
    setEditContent("");
    setEditSold(false);
  };

  const handleEditSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingStock) return;
    const cleaned = editContent.trim();
    if (!cleaned) return;
    await supabase
      .from("stock")
      .update({ content: cleaned, sold: editSold })
      .eq("id", editingStock.id);
    cancelEdit();
    await loadStock(selectedProductId, page);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteStock) return;
    await supabase.from("stock").delete().eq("id", deleteStock.id);
    const shouldGoPrev = stockItems.length === 1 && page > 1;
    setDeleteStock(null);
    if (shouldGoPrev) {
      setPage(page - 1);
    } else {
      await loadStock(selectedProductId, page);
    }
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
        <h3 className="section-title">Danh sách stock</h3>
        <table className="table fixed">
          <colgroup>
            <col style={{ width: 80 }} />
            <col />
            <col style={{ width: 110 }} />
            <col style={{ width: 220 }} />
          </colgroup>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nội dung</th>
              <th>Trạng thái</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {stockItems.map((item) => (
              <tr key={item.id}>
                <td>#{item.id}</td>
                <td>
                  <div className="cell-truncate" title={item.content}>
                    {item.content}
                  </div>
                </td>
                <td>{item.sold ? "Đã bán" : "Còn"}</td>
                <td>
                  <div className="table-actions">
                    <button className="button secondary" onClick={() => startEdit(item)}>Chỉnh sửa</button>
                    <button className="button danger" onClick={() => setDeleteStock(item)}>Xóa</button>
                  </div>
                </td>
              </tr>
            ))}
            {!stockItems.length && (
              <tr>
                <td colSpan={4} className="muted">Chưa có stock.</td>
              </tr>
            )}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 12 }}>
            <button className="button secondary" disabled={page === 1} onClick={() => setPage(Math.max(1, page - 1))}>
              Trang trước
            </button>
            <span className="muted">Trang {page}/{totalPages} · Tổng {totalCount}</span>
            <button className="button secondary" disabled={page === totalPages} onClick={() => setPage(Math.min(totalPages, page + 1))}>
              Trang sau
            </button>
          </div>
        )}
      </div>

      {editingStock && (
        <div className="modal-backdrop" onClick={cancelEdit}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h3 className="section-title">Chỉnh sửa stock #{editingStock.id}</h3>
            <form className="form-grid" onSubmit={handleEditSave}>
              <textarea
                className="textarea form-section"
                placeholder="Nội dung stock"
                value={editContent}
                onChange={(event) => setEditContent(event.target.value)}
              />
              <div className="toggle">
                <input
                  type="checkbox"
                  checked={editSold}
                  onChange={(event) => setEditSold(event.target.checked)}
                />
                Đã bán
              </div>
              <div className="modal-actions">
                <button className="button" type="submit">Lưu</button>
                <button className="button secondary" type="button" onClick={cancelEdit}>Hủy</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteStock && (
        <div className="modal-backdrop" onClick={() => setDeleteStock(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h3 className="section-title">Xóa stock #{deleteStock.id}</h3>
            <p className="muted" style={{ marginTop: 8 }}>
              Bạn có chắc muốn xóa stock này?
            </p>
            <div className="modal-actions">
              <button className="button danger" type="button" onClick={handleDeleteConfirm}>Xóa</button>
              <button className="button secondary" type="button" onClick={() => setDeleteStock(null)}>Hủy</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
