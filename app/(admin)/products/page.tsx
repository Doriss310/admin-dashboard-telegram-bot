"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface Product {
  id: number;
  name: string;
  price: number;
  price_usdt: number;
  description: string | null;
  format_data: string | null;
}

interface FormatTemplate {
  id: number;
  name: string;
  pattern: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [formatTemplates, setFormatTemplates] = useState<FormatTemplate[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [priceUsdt, setPriceUsdt] = useState("");
  const [description, setDescription] = useState("");
  const [formatData, setFormatData] = useState("");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editPriceUsdt, setEditPriceUsdt] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editFormatData, setEditFormatData] = useState("");
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templatePattern, setTemplatePattern] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("products")
      .select("id, name, price, price_usdt, description, format_data")
      .order("id");
    setProducts((data as Product[]) || []);
  };

  const loadFormats = async () => {
    const { data } = await supabase.from("format_templates").select("id, name, pattern").order("id");
    setFormatTemplates((data as FormatTemplate[]) || []);
  };

  const loadRole = async () => {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) return;
    const { data: adminRow } = await supabase
      .from("admin_users")
      .select("role")
      .eq("user_id", session.user.id)
      .maybeSingle();
    setRole(adminRow?.role ?? null);
  };

  useEffect(() => {
    load();
    loadFormats();
    loadRole();
  }, []);

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    await supabase.from("products").insert({
      name,
      price: parseInt(price || "0", 10),
      price_usdt: parseFloat(priceUsdt || "0"),
      description,
      format_data: formatData || null
    });
    setName("");
    setPrice("");
    setPriceUsdt("");
    setDescription("");
    setFormatData("");
    await load();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteProduct) return;
    await supabase.from("products").delete().eq("id", deleteProduct.id);
    setDeleteProduct(null);
    await load();
  };

  const startEdit = (product: Product) => {
    setEditingProduct(product);
    setEditName(product.name);
    setEditPrice(product.price.toString());
    setEditPriceUsdt(product.price_usdt?.toString() ?? "");
    setEditDescription(product.description ?? "");
    setEditFormatData(product.format_data ?? "");
  };

  const cancelEdit = () => {
    setEditingProduct(null);
    setEditName("");
    setEditPrice("");
    setEditPriceUsdt("");
    setEditDescription("");
    setEditFormatData("");
  };

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingProduct) return;
    await supabase
      .from("products")
      .update({
        name: editName,
        price: parseInt(editPrice || "0", 10),
        price_usdt: parseFloat(editPriceUsdt || "0"),
        description: editDescription,
        format_data: editFormatData || null
      })
      .eq("id", editingProduct.id);
    cancelEdit();
    await load();
  };

  const handleAddTemplate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!templateName || !templatePattern) return;
    await supabase.from("format_templates").insert({
      name: templateName,
      pattern: templatePattern
    });
    setTemplateName("");
    setTemplatePattern("");
    await loadFormats();
  };

  const handleDeleteTemplate = async (templateId: number) => {
    await supabase.from("format_templates").delete().eq("id", templateId);
    await loadFormats();
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
          <input className="input" placeholder="Mô tả (gửi trước Account sau thanh toán)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <select
            className="select"
            value=""
            onChange={(e) => setFormatData(e.target.value)}
          >
            <option value="">Chọn format mẫu (tự điền vào Format data)</option>
            {formatTemplates.map((format) => (
              <option key={format.id} value={format.pattern}>
                {format.name} | {format.pattern}
              </option>
            ))}
          </select>
          <input
            className="input"
            placeholder="Format data (VD: Mail|Pass|Token)"
            value={formatData}
            onChange={(e) => setFormatData(e.target.value)}
          />
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
              <th>Format data</th>
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
                <td>{product.format_data ?? ""}</td>
                <td>
                  <button className="button secondary" onClick={() => startEdit(product)}>Chỉnh sửa</button>
                  <button className="button secondary" style={{ marginLeft: 8 }} onClick={() => handleUpdateUsdt(product)}>USDT</button>
                  <button className="button danger" style={{ marginLeft: 8 }} onClick={() => setDeleteProduct(product)}>Xóa</button>
                </td>
              </tr>
            ))}
            {!products.length && (
              <tr>
                <td colSpan={7} className="muted">Chưa có sản phẩm.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {role === "superadmin" && (
        <div className="card">
          <h3 className="section-title">Format templates</h3>
          <form className="form-grid" onSubmit={handleAddTemplate}>
            <input
              className="input"
              placeholder="Tên format (VD: Adobe)"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              required
            />
            <input
              className="input"
              placeholder="Format data (VD: Mail|Pass|Token)"
              value={templatePattern}
              onChange={(e) => setTemplatePattern(e.target.value)}
              required
            />
            <button className="button" type="submit">Thêm format</button>
          </form>
          <table className="table" style={{ marginTop: 16 }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Tên</th>
                <th>Pattern</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {formatTemplates.map((format) => (
                <tr key={format.id}>
                  <td>#{format.id}</td>
                  <td>{format.name}</td>
                  <td>{format.pattern}</td>
                  <td>
                    <button className="button danger" onClick={() => handleDeleteTemplate(format.id)}>Xóa</button>
                  </td>
                </tr>
              ))}
              {!formatTemplates.length && (
                <tr>
                  <td colSpan={4} className="muted">Chưa có format nào.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editingProduct && (
        <div className="modal-backdrop" onClick={cancelEdit}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h3 className="section-title">Chỉnh sửa sản phẩm #{editingProduct.id}</h3>
            <form className="form-grid" onSubmit={handleUpdate}>
              <input className="input" placeholder="Tên sản phẩm" value={editName} onChange={(e) => setEditName(e.target.value)} required />
              <input className="input" placeholder="Giá (VND)" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} required />
              <input className="input" placeholder="Giá (USDT)" value={editPriceUsdt} onChange={(e) => setEditPriceUsdt(e.target.value)} />
              <textarea className="textarea form-section" placeholder="Mô tả (gửi trước Account sau thanh toán)" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
              <select
                className="select"
                value=""
                onChange={(e) => setEditFormatData(e.target.value)}
              >
                <option value="">Chọn format mẫu (tự điền vào Format data)</option>
                {formatTemplates.map((format) => (
                  <option key={format.id} value={format.pattern}>
                    {format.name} | {format.pattern}
                  </option>
                ))}
              </select>
              <input
                className="input"
                placeholder="Format data (VD: Mail|Pass|Token)"
                value={editFormatData}
                onChange={(e) => setEditFormatData(e.target.value)}
              />
              <div className="modal-actions">
                <button className="button" type="submit">Lưu</button>
                <button className="button secondary" type="button" onClick={cancelEdit}>Hủy</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteProduct && (
        <div className="modal-backdrop" onClick={() => setDeleteProduct(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h3 className="section-title">Xóa sản phẩm #{deleteProduct.id}</h3>
            <p className="muted" style={{ marginTop: 8 }}>
              Bạn có chắc muốn xóa <strong>{deleteProduct.name}</strong>?
            </p>
            <div className="modal-actions">
              <button className="button danger" type="button" onClick={handleDeleteConfirm}>Xóa</button>
              <button className="button secondary" type="button" onClick={() => setDeleteProduct(null)}>Hủy</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
