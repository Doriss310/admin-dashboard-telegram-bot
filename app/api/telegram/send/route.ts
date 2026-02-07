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

const fetchAllUserIds = async (client: any) => {
  const ids: number[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await client
      .from("users")
      .select("user_id")
      .order("user_id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      break;
    }

    ids.push(...data.map((row: { user_id: number }) => row.user_id));

    if (data.length < pageSize) {
      break;
    }
    from += pageSize;
  }

  return ids;
};

const sendTelegramMessage = async (chatId: number, text: string) => {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text
    })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || payload.ok !== true || !payload.result) {
    return { ok: false as const };
  }
  const result = payload.result as { message_id?: number; date?: number; text?: string };
  return {
    ok: true as const,
    message_id: typeof result.message_id === "number" ? result.message_id : null,
    date: typeof result.date === "number" ? result.date : null,
    text: typeof result.text === "string" ? result.text : text
  };
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

  let body: { message?: string; userId?: number | string; broadcast?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const message = (body.message ?? "").toString().trim();
  if (!message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const trimmedMessage = message.slice(0, MAX_MESSAGE_LENGTH);

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

  const broadcast = body.broadcast === true;
  const userId = body.userId ? Number(body.userId) : null;
  if (!broadcast && !userId) {
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }

  let targets: number[] = [];
  if (broadcast) {
    try {
      targets = await fetchAllUserIds(supabase);
    } catch (error) {
      return NextResponse.json({ error: "Failed to load users." }, { status: 500 });
    }
  } else if (userId) {
    targets = [userId];
  }

  if (!targets.length) {
    return NextResponse.json({ success: 0, failed: 0, total: 0 });
  }

  let success = 0;
  let failed = 0;
  for (const chatId of targets) {
    const result = await sendTelegramMessage(chatId, trimmedMessage);
    if (result.ok) {
      success += 1;

      // Best-effort logging to support admin 1-1 chat history UI.
      // Avoid logging broadcasts here to prevent huge inserts + extra latency.
      if (!broadcast && result.message_id) {
        const sentAt = result.date ? new Date(result.date * 1000).toISOString() : new Date().toISOString();
        await supabase.from("telegram_messages").upsert(
          {
            chat_id: chatId,
            message_id: result.message_id,
            direction: "out",
            message_type: "text",
            text: result.text ?? trimmedMessage,
            payload: null,
            sent_at: sentAt
          },
          { onConflict: "chat_id,message_id" }
        );
      }
    } else {
      failed += 1;
    }
  }

  return NextResponse.json({ success, failed, total: targets.length });
}
