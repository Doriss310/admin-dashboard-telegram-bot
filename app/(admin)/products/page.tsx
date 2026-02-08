"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface PriceTier {
  min_quantity: number;
  unit_price: number;
}

interface PriceTierRow {
  id: string;
  minQuantity: string;
  unitPrice: string;
}

interface Product {
  id: number;
  name: string;
  price: number;
  price_usdt: number;
  price_tiers: PriceTier[] | null;
  promo_buy_quantity: number | null;
  promo_bonus_quantity: number | null;
  description: string | null;
  format_data: string | null;
}

interface FormatTemplate {
  id: number;
  name: string;
  pattern: string;
}

const createTierRow = (tier?: PriceTier): PriceTierRow => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  minQuantity: tier?.min_quantity ? String(tier.min_quantity) : "",
  unitPrice: tier?.unit_price ? String(tier.unit_price) : ""
});

const normalizeTierRows = (rows: PriceTierRow[]): PriceTier[] => {
  const byQuantity = new Map<number, number>();
  for (const row of rows) {
    const minQuantity = Number(row.minQuantity);
    const unitPrice = Number(row.unitPrice);
    if (!Number.isFinite(minQuantity) || !Number.isFinite(unitPrice)) continue;
    if (minQuantity < 1 || unitPrice < 1) continue;
    byQuantity.set(Math.trunc(minQuantity), Math.trunc(unitPrice));
  }
  return Array.from(byQuantity.entries())
    .map(([min_quantity, unit_price]) => ({ min_quantity, unit_price }))
    .sort((a, b) => a.min_quantity - b.min_quantity);
};

const parseTierRows = (tiers: PriceTier[] | null | undefined): PriceTierRow[] => {
  if (!tiers?.length) return [createTierRow()];
  return tiers
    .filter((tier) => Number(tier.min_quantity) > 0 && Number(tier.unit_price) > 0)
    .sort((a, b) => a.min_quantity - b.min_quantity)
    .map((tier) => createTierRow(tier));
};

const formatTierSummary = (tiers: PriceTier[] | null | undefined) => {
  if (!tiers?.length) return "Mặc định theo giá cơ bản.";
  return tiers
    .slice()
    .sort((a, b) => a.min_quantity - b.min_quantity)
    .map((tier) => `Từ ${tier.min_quantity}: ${tier.unit_price.toLocaleString("vi-VN")}đ`)
    .join(" | ");
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [formatTemplates, setFormatTemplates] = useState<FormatTemplate[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [productError, setProductError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [priceUsdt, setPriceUsdt] = useState("");
  const [description, setDescription] = useState("");
  const [formatData, setFormatData] = useState("");
  const [priceTierRows, setPriceTierRows] = useState<PriceTierRow[]>([createTierRow()]);
  const [promoBuyQuantity, setPromoBuyQuantity] = useState("");
  const [promoBonusQuantity, setPromoBonusQuantity] = useState("");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editPriceUsdt, setEditPriceUsdt] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editFormatData, setEditFormatData] = useState("");
  const [editPriceTierRows, setEditPriceTierRows] = useState<PriceTierRow[]>([createTierRow()]);
  const [editPromoBuyQuantity, setEditPromoBuyQuantity] = useState("");
  const [editPromoBonusQuantity, setEditPromoBonusQuantity] = useState("");
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templatePattern, setTemplatePattern] = useState("");
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<FormatTemplate | null>(null);
  const [editTemplateName, setEditTemplateName] = useState("");
  const [editTemplatePattern, setEditTemplatePattern] = useState("");

  const load = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, price, price_usdt, price_tiers, promo_buy_quantity, promo_bonus_quantity, description, format_data")
      .order("id");
    if (error) {
      setProductError(error.message);
      return;
    }
    setProductError(null);
    setProducts((data as Product[]) || []);
  };

  const loadFormats = async () => {
    const { data, error } = await supabase
      .from("format_templates")
      .select("id, name, pattern")
      .order("id");
    if (error) {
      setTemplateError(error.message);
      return;
    }
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

  const addTierRow = () => {
    setPriceTierRows((prev) => [...prev, createTierRow()]);
  };

  const removeTierRow = (id: string) => {
    setPriceTierRows((prev) => {
      const next = prev.filter((row) => row.id !== id);
      return next.length ? next : [createTierRow()];
    });
  };

  const updateTierRow = (id: string, field: "minQuantity" | "unitPrice", value: string) => {
    setPriceTierRows((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const addEditTierRow = () => {
    setEditPriceTierRows((prev) => [...prev, createTierRow()]);
  };

  const removeEditTierRow = (id: string) => {
    setEditPriceTierRows((prev) => {
      const next = prev.filter((row) => row.id !== id);
      return next.length ? next : [createTierRow()];
    });
  };

  const updateEditTierRow = (id: string, field: "minQuantity" | "unitPrice", value: string) => {
    setEditPriceTierRows((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    const tiers = normalizeTierRows(priceTierRows);
    const buyQty = Number(promoBuyQuantity || "0");
    const bonusQty = Number(promoBonusQuantity || "0");
    const hasPromo = buyQty > 0 || bonusQty > 0;
    if (hasPromo && (!Number.isFinite(buyQty) || !Number.isFinite(bonusQty) || buyQty < 1 || bonusQty < 1)) {
      setProductError("Khuyến mãi cần đủ 2 giá trị hợp lệ: mua X và tặng Y đều phải lớn hơn 0.");
      return;
    }

    const { error } = await supabase.from("products").insert({
      name,
      price: parseInt(price || "0", 10),
      price_usdt: parseFloat(priceUsdt || "0"),
      description,
      format_data: formatData || null,
      price_tiers: tiers.length ? tiers : null,
      promo_buy_quantity: hasPromo ? Math.trunc(buyQty) : 0,
      promo_bonus_quantity: hasPromo ? Math.trunc(bonusQty) : 0
    });
    if (error) {
      setProductError(error.message);
      return;
    }
    setProductError(null);
    setName("");
    setPrice("");
    setPriceUsdt("");
    setDescription("");
    setFormatData("");
    setPriceTierRows([createTierRow()]);
    setPromoBuyQuantity("");
    setPromoBonusQuantity("");
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
    setEditPriceTierRows(parseTierRows(product.price_tiers));
    setEditPromoBuyQuantity(product.promo_buy_quantity ? product.promo_buy_quantity.toString() : "");
    setEditPromoBonusQuantity(product.promo_bonus_quantity ? product.promo_bonus_quantity.toString() : "");
  };

  const cancelEdit = () => {
    setEditingProduct(null);
    setEditName("");
    setEditPrice("");
    setEditPriceUsdt("");
    setEditDescription("");
    setEditFormatData("");
    setEditPriceTierRows([createTierRow()]);
    setEditPromoBuyQuantity("");
    setEditPromoBonusQuantity("");
  };

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingProduct) return;
    const tiers = normalizeTierRows(editPriceTierRows);
    const buyQty = Number(editPromoBuyQuantity || "0");
    const bonusQty = Number(editPromoBonusQuantity || "0");
    const hasPromo = buyQty > 0 || bonusQty > 0;
    if (hasPromo && (!Number.isFinite(buyQty) || !Number.isFinite(bonusQty) || buyQty < 1 || bonusQty < 1)) {
      setProductError("Khuyến mãi cần đủ 2 giá trị hợp lệ: mua X và tặng Y đều phải lớn hơn 0.");
      return;
    }

    const { error } = await supabase
      .from("products")
      .update({
        name: editName,
        price: parseInt(editPrice || "0", 10),
        price_usdt: parseFloat(editPriceUsdt || "0"),
        description: editDescription,
        format_data: editFormatData || null,
        price_tiers: tiers.length ? tiers : null,
        promo_buy_quantity: hasPromo ? Math.trunc(buyQty) : 0,
        promo_bonus_quantity: hasPromo ? Math.trunc(bonusQty) : 0
      })
      .eq("id", editingProduct.id);
    if (error) {
      setProductError(error.message);
      return;
    }
    setProductError(null);
    cancelEdit();
    await load();
  };

  const handleAddTemplate = async (event: React.FormEvent) => {
    event.preventDefault();
    const nameValue = templateName.trim();
    const patternValue = templatePattern.trim();
    if (!nameValue || !patternValue) return;
    setTemplateError(null);
    setTemplateSaving(true);
    const { error } = await supabase.from("format_templates").insert({
      name: nameValue,
      pattern: patternValue
    });
    setTemplateSaving(false);
    if (error) {
      setTemplateError(error.message);
      return;
    }
    setTemplateName("");
    setTemplatePattern("");
    await loadFormats();
  };

  const handleDeleteTemplate = async (templateId: number) => {
    setTemplateError(null);
    const { error } = await supabase.from("format_templates").delete().eq("id", templateId);
    if (error) {
      setTemplateError(error.message);
      return;
    }
    await loadFormats();
  };

  const startEditTemplate = (template: FormatTemplate) => {
    setEditingTemplate(template);
    setEditTemplateName(template.name);
    setEditTemplatePattern(template.pattern);
  };

  const cancelEditTemplate = () => {
    setEditingTemplate(null);
    setEditTemplateName("");
    setEditTemplatePattern("");
  };

  const handleUpdateTemplate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingTemplate) return;
    const nameValue = editTemplateName.trim();
    const patternValue = editTemplatePattern.trim();
    if (!nameValue || !patternValue) return;
    setTemplateError(null);
    setTemplateSaving(true);
    const { error } = await supabase
      .from("format_templates")
      .update({ name: nameValue, pattern: patternValue })
      .eq("id", editingTemplate.id);
    setTemplateSaving(false);
    if (error) {
      setTemplateError(error.message);
      return;
    }
    cancelEditTemplate();
    await loadFormats();
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
            placeholder="Format data (VD: Mail,Pass,Token)"
            value={formatData}
            onChange={(e) => setFormatData(e.target.value)}
          />
          <div className="form-section pricing-box">
            <div className="pricing-head">
              <h4>Giá theo số lượng (VND)</h4>
              <button className="button secondary" type="button" onClick={addTierRow}>+ Thêm mức</button>
            </div>
            <p className="muted">Nhập mốc số lượng và đơn giá mỗi account. Hệ thống tự lấy mốc cao nhất phù hợp.</p>
            <div className="tier-list">
              {priceTierRows.map((row) => (
                <div className="tier-row" key={row.id}>
                  <input
                    className="input"
                    placeholder="Từ số lượng (VD: 10)"
                    value={row.minQuantity}
                    onChange={(event) => updateTierRow(row.id, "minQuantity", event.target.value)}
                  />
                  <input
                    className="input"
                    placeholder="Đơn giá VND (VD: 15000)"
                    value={row.unitPrice}
                    onChange={(event) => updateTierRow(row.id, "unitPrice", event.target.value)}
                  />
                  <button className="button secondary" type="button" onClick={() => removeTierRow(row.id)}>Xóa</button>
                </div>
              ))}
            </div>
          </div>
          <div className="form-section promo-row">
            <input
              className="input"
              placeholder="Khuyến mãi: mua X (VD: 10)"
              value={promoBuyQuantity}
              onChange={(event) => setPromoBuyQuantity(event.target.value)}
            />
            <input
              className="input"
              placeholder="Khuyến mãi: tặng Y (VD: 1)"
              value={promoBonusQuantity}
              onChange={(event) => setPromoBonusQuantity(event.target.value)}
            />
          </div>
          <button className="button" type="submit">Thêm</button>
        </form>
        {productError && (
          <p className="muted" style={{ marginTop: 8 }}>
            Lỗi: {productError}
          </p>
        )}
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
              <th>Giá theo SL</th>
              <th>Khuyến mãi</th>
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
                <td>{formatTierSummary(product.price_tiers)}</td>
                <td>
                  {(product.promo_buy_quantity || 0) > 0 && (product.promo_bonus_quantity || 0) > 0
                    ? `Mua ${product.promo_buy_quantity} tặng ${product.promo_bonus_quantity}`
                    : "Không"}
                </td>
                <td>{product.description ?? ""}</td>
                <td>{product.format_data ?? ""}</td>
                <td>
                  <button className="button secondary" onClick={() => startEdit(product)}>Chỉnh sửa</button>
                  <button className="button danger" style={{ marginLeft: 8 }} onClick={() => setDeleteProduct(product)}>Xóa</button>
                </td>
              </tr>
            ))}
            {!products.length && (
              <tr>
                <td colSpan={9} className="muted">Chưa có sản phẩm.</td>
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
              placeholder="Format data (VD: Mail,Pass,Token)"
              value={templatePattern}
              onChange={(e) => setTemplatePattern(e.target.value)}
              required
            />
            <button className="button" type="submit" disabled={templateSaving}>
              {templateSaving ? "Đang thêm..." : "Thêm format"}
            </button>
          </form>
          {templateError && (
            <p className="muted" style={{ marginTop: 8 }}>
              Lỗi: {templateError}
            </p>
          )}
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
                    <button className="button secondary" onClick={() => startEditTemplate(format)}>Chỉnh sửa</button>
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
                placeholder="Format data (VD: Mail,Pass,Token)"
                value={editFormatData}
                onChange={(e) => setEditFormatData(e.target.value)}
              />
              <div className="form-section pricing-box">
                <div className="pricing-head">
                  <h4>Giá theo số lượng (VND)</h4>
                  <button className="button secondary" type="button" onClick={addEditTierRow}>+ Thêm mức</button>
                </div>
                <p className="muted">Giá mốc này sẽ ghi đè giá mặc định khi khách mua đạt ngưỡng số lượng.</p>
                <div className="tier-list">
                  {editPriceTierRows.map((row) => (
                    <div className="tier-row" key={row.id}>
                      <input
                        className="input"
                        placeholder="Từ số lượng"
                        value={row.minQuantity}
                        onChange={(event) => updateEditTierRow(row.id, "minQuantity", event.target.value)}
                      />
                      <input
                        className="input"
                        placeholder="Đơn giá VND"
                        value={row.unitPrice}
                        onChange={(event) => updateEditTierRow(row.id, "unitPrice", event.target.value)}
                      />
                      <button className="button secondary" type="button" onClick={() => removeEditTierRow(row.id)}>Xóa</button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="form-section promo-row">
                <input
                  className="input"
                  placeholder="Khuyến mãi: mua X"
                  value={editPromoBuyQuantity}
                  onChange={(event) => setEditPromoBuyQuantity(event.target.value)}
                />
                <input
                  className="input"
                  placeholder="Khuyến mãi: tặng Y"
                  value={editPromoBonusQuantity}
                  onChange={(event) => setEditPromoBonusQuantity(event.target.value)}
                />
              </div>
              {productError && (
                <p className="muted form-section" style={{ marginTop: 0 }}>
                  Lỗi: {productError}
                </p>
              )}
              <div className="modal-actions">
                <button className="button" type="submit">Lưu</button>
                <button className="button secondary" type="button" onClick={cancelEdit}>Hủy</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingTemplate && (
        <div className="modal-backdrop" onClick={cancelEditTemplate}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h3 className="section-title">Chỉnh sửa format #{editingTemplate.id}</h3>
            <form className="form-grid" onSubmit={handleUpdateTemplate}>
              <input
                className="input"
                placeholder="Tên format (VD: Adobe)"
                value={editTemplateName}
                onChange={(e) => setEditTemplateName(e.target.value)}
                required
              />
              <input
                className="input"
                placeholder="Format data (VD: Mail,Pass,Token)"
                value={editTemplatePattern}
                onChange={(e) => setEditTemplatePattern(e.target.value)}
                required
              />
              <div className="modal-actions">
                <button className="button" type="submit" disabled={templateSaving}>
                  {templateSaving ? "Đang lưu..." : "Lưu"}
                </button>
                <button className="button secondary" type="button" onClick={cancelEditTemplate}>
                  Hủy
                </button>
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
