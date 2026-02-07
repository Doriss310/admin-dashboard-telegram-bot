import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const botToken = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "";
const MAX_MESSAGE_LENGTH = 4096;

const buildSupabaseClient = (token?: string) =>
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    global: token
      ? {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      : undefined
  });

const sendTelegramMessage = async (chatId: number, text: string) => {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML"
    })
  });

  if (!response.ok) {
    return false;
  }

  const payload = await response.json();
  return payload.ok === true;
};

const sendTelegramDocument = async (chatId: number, filename: string, content: string, caption: string) => {
  const form = new FormData();
  form.append("chat_id", chatId.toString());
  form.append("caption", caption);
  form.append("document", new Blob([content], { type: "text/plain" }), filename);

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
    method: "POST",
    body: form
  });

  if (!response.ok) {
    return false;
  }

  const payload = await response.json();
  return payload.ok === true;
};

const formatDescriptionBlock = (description: string | null | undefined, label = "📝 Mô tả") => {
  if (!description) return "";
  const cleaned = description.toString().trim();
  if (!cleaned) return "";
  return `${label}:\n${cleaned}\n\n`;
};

const buildFormattedItems = (items: string[], formatData?: string | null, html = false) => {
  const labels = (formatData || "")
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean);
  if (!labels.length) {
    return items.map((item) => (html ? `<code>${item}</code>` : item));
  }
  return items.map((item) => {
    const values = item.split(",").map((value) => value.trim());
    const lines = labels.map((label, idx) => {
      const value = values[idx] ?? "";
      if (html) {
        return value ? `${label}: <code>${value}</code>` : `${label}:`;
      }
      return value ? `${label}: ${value}` : `${label}:`;
    });
    return lines.join("\n");
  });
};

export async function POST(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Supabase env missing." }, { status: 500 });
  }
  if (!botToken) {
    return NextResponse.json({ error: "BOT_TOKEN missing." }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: { orderId?: number | string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const orderId = body.orderId ? Number(body.orderId) : null;
  if (!orderId) {
    return NextResponse.json({ error: "orderId is required." }, { status: 400 });
  }

  const authClient = buildSupabaseClient();
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = buildSupabaseClient(token);
  const { data: adminRow, error: adminError } = await supabase
    .from("admin_users")
    .select("role")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (adminError || !adminRow) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { data: directOrder, error: directOrderError } = await supabase
    .from("direct_orders")
    .select("id, user_id, product_id, quantity, unit_price, amount, code, status, created_at")
    .eq("id", orderId)
    .maybeSingle();

  if (directOrderError || !directOrder) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  if (directOrder.status !== "pending") {
    return NextResponse.json({ error: "Order already processed." }, { status: 400 });
  }

  const { data: product } = await supabase
    .from("products")
    .select("id, name, description, format_data")
    .eq("id", directOrder.product_id)
    .maybeSingle();

  const { data: stockRows, error: stockError } = await supabase
    .from("stock")
    .select("id, content")
    .eq("product_id", directOrder.product_id)
    .eq("sold", false)
    .order("id", { ascending: true })
    .limit(directOrder.quantity);

  if (stockError || !stockRows || stockRows.length < directOrder.quantity) {
    await supabase
      .from("direct_orders")
      .update({ status: "failed" })
      .eq("id", directOrder.id);
    return NextResponse.json({ error: "Not enough stock." }, { status: 409 });
  }

  const stockIds = stockRows.map((row) => row.id);
  const items = stockRows.map((row) => row.content);

  const { error: updateStockError } = await supabase
    .from("stock")
    .update({ sold: true })
    .in("id", stockIds);

  if (updateStockError) {
    return NextResponse.json({ error: "Failed to update stock." }, { status: 500 });
  }

  const orderGroup = `MANUAL${directOrder.user_id}${new Date().toISOString().replace(/[-:.TZ]/g, "")}`;
  const totalPrice = (directOrder.unit_price || 0) * items.length;

  const { error: createOrderError } = await supabase.from("orders").insert({
    user_id: directOrder.user_id,
    product_id: directOrder.product_id,
    content: JSON.stringify(items),
    price: totalPrice,
    quantity: items.length,
    order_group: orderGroup,
    created_at: new Date().toISOString()
  });

  if (createOrderError) {
    return NextResponse.json({ error: "Failed to create order." }, { status: 500 });
  }

  const { error: updateDirectOrderError } = await supabase
    .from("direct_orders")
    .update({ status: "confirmed" })
    .eq("id", directOrder.id);

  if (updateDirectOrderError) {
    return NextResponse.json({ error: "Failed to update direct order." }, { status: 500 });
  }

  const productName = product?.name || `#${directOrder.product_id}`;
  const description = product?.description || "";
  const totalText = `${directOrder.amount?.toLocaleString?.() ?? directOrder.amount ?? totalPrice}đ`;
  const descriptionBlock = formatDescriptionBlock(description);

  const successText =
    `✅ Thanh toán thành công!\n\n` +
    `🧾 ${productName} | SL: ${items.length}\n` +
    `💰 Tổng: ${totalText}`;

  const itemsFormatted = buildFormattedItems(items, product?.format_data, true).join("\n\n");
  const messageText = `${successText}\n\n${descriptionBlock}🔐 Account:\n${itemsFormatted}`.slice(0, MAX_MESSAGE_LENGTH);

  let sent = false;
  if (items.length > 5 || messageText.length >= MAX_MESSAGE_LENGTH - 50) {
    const headerLines = [
      `Product: ${productName}`,
      `Qty: ${items.length}`,
      `Total: ${totalText}`
    ];
    if (description) {
      headerLines.push(`Description: ${description}`);
    }
    const fileItems = buildFormattedItems(items, product?.format_data, false);
    const fileContent = `${headerLines.join("\n")}\n${"=".repeat(40)}\n\n${fileItems.join("\n\n")}`;
    const filename = `${productName}_${items.length}.txt`;
    sent = await sendTelegramDocument(directOrder.user_id, filename, fileContent, successText);
  } else {
    sent = await sendTelegramMessage(directOrder.user_id, messageText);
  }

  if (!sent) {
    return NextResponse.json({ error: "Failed to send message." }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
