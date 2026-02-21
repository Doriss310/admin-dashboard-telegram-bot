import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const rawExpireMinutes = Number(process.env.DIRECT_ORDER_PENDING_EXPIRE_MINUTES || "10");
const DIRECT_ORDER_PENDING_EXPIRE_MINUTES = Number.isFinite(rawExpireMinutes)
  ? Math.max(1, rawExpireMinutes)
  : 10;
const DIRECT_ORDER_PENDING_EXPIRE_MS = DIRECT_ORDER_PENDING_EXPIRE_MINUTES * 60 * 1000;

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

const isDirectOrderExpired = (createdAt: string | null | undefined) => {
  if (!createdAt) return false;
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return false;
  return Date.now() - created.getTime() >= DIRECT_ORDER_PENDING_EXPIRE_MS;
};

export async function POST(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Supabase env missing." }, { status: 500 });
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
    .from("website_direct_orders")
    .select("id, auth_user_id, user_email, product_id, quantity, bonus_quantity, unit_price, amount, code, status, created_at")
    .eq("id", orderId)
    .maybeSingle();

  if (directOrderError || !directOrder) {
    return NextResponse.json({ error: "Website direct order not found." }, { status: 404 });
  }

  if (directOrder.status !== "pending") {
    return NextResponse.json({ error: "Order already processed." }, { status: 400 });
  }

  if (isDirectOrderExpired(directOrder.created_at)) {
    await supabase
      .from("website_direct_orders")
      .update({ status: "cancelled" })
      .eq("id", directOrder.id);
    return NextResponse.json(
      { error: `Order expired after ${DIRECT_ORDER_PENDING_EXPIRE_MINUTES} minutes.` },
      { status: 409 }
    );
  }

  const bonusQuantity = Number(directOrder.bonus_quantity || 0);
  const deliverQuantity = Math.max(1, Number(directOrder.quantity || 0) + Math.max(0, bonusQuantity));

  const { data: stockRows, error: stockError } = await supabase
    .from("stock")
    .select("id, content")
    .eq("product_id", directOrder.product_id)
    .eq("sold", false)
    .order("id", { ascending: true })
    .limit(deliverQuantity);

  if (stockError || !stockRows || stockRows.length < deliverQuantity) {
    await supabase
      .from("website_direct_orders")
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

  const orderGroup = `WEB${new Date().toISOString().replace(/[-:.TZ]/g, "")}`;
  const totalPrice =
    Number(directOrder.amount || 0) ||
    Number(directOrder.unit_price || 0) * Number(directOrder.quantity || 0);

  const websiteOrderPayload = {
    auth_user_id: directOrder.auth_user_id || null,
    user_email: directOrder.user_email || null,
    product_id: directOrder.product_id,
    content: JSON.stringify(items),
    price: totalPrice,
    quantity: items.length,
    order_group: orderGroup,
    source_direct_code: directOrder.code,
    created_at: new Date().toISOString()
  };

  const { data: insertedOrderRows, error: createOrderError } = await supabase
    .from("website_orders")
    .insert(websiteOrderPayload)
    .select("id")
    .limit(1);

  if (createOrderError) {
    return NextResponse.json({ error: "Failed to create website order." }, { status: 500 });
  }

  const fulfilledOrderId = insertedOrderRows?.[0]?.id ?? null;

  const { error: updateDirectOrderError } = await supabase
    .from("website_direct_orders")
    .update({
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
      fulfilled_order_id: fulfilledOrderId
    })
    .eq("id", directOrder.id);

  if (updateDirectOrderError) {
    return NextResponse.json({ error: "Failed to update website direct order." }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    fulfilled_order_id: fulfilledOrderId
  });
}
