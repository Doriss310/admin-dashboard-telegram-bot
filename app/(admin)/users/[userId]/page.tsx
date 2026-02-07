"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type TelegramDirection = "in" | "out";

type TelegramMessageRow = {
  id: number;
  chat_id: number;
  message_id: number;
  direction: TelegramDirection;
  message_type: string;
  text: string | null;
  payload: any;
  sent_at: string;
};

type UserBrief = {
  user_id: number;
  username: string | null;
};

const TZ = "Asia/Ho_Chi_Minh";

const formatChatTime = (isoString: string) => {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit"
  }).format(date);
};

const renderMessageText = (msg: TelegramMessageRow) => {
  const cleaned = (msg.text ?? "").toString().trim();
  if (cleaned) return cleaned;

  if (msg.message_type === "document") {
    const fileName = msg.payload?.file_name ? String(msg.payload.file_name) : null;
    return fileName ? `[Tệp] ${fileName}` : "[Tệp]";
  }

  if (msg.message_type === "photo") {
    return "[Ảnh]";
  }

  return `[${msg.message_type || "message"}]`;
};

const sortMessages = (rows: TelegramMessageRow[]) =>
  rows
    .slice()
    .sort((a, b) => {
      const ta = new Date(a.sent_at).getTime();
      const tb = new Date(b.sent_at).getTime();
      if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
      return (a.message_id || 0) - (b.message_id || 0);
    });

const mergeMessages = (prev: TelegramMessageRow[], incoming: TelegramMessageRow[]) => {
  // Prevent transient duplicates when multiple fetches overlap (e.g. send-triggered refresh + polling).
  const map = new Map<number, TelegramMessageRow>();
  for (const row of prev) map.set(row.message_id, row);
  for (const row of incoming) map.set(row.message_id, row);
  return sortMessages(Array.from(map.values()));
};

export default function UserChatPage() {
  const params = useParams();
  const userIdParam = (params as any)?.userId as string | string[] | undefined;
  const userId = Array.isArray(userIdParam) ? userIdParam[0] : userIdParam;
  const chatId = userId ? Number(userId) : NaN;
  const validChatId = Number.isFinite(chatId) && chatId > 0 ? chatId : null;

  const [user, setUser] = useState<UserBrief | null>(null);
  const [messages, setMessages] = useState<TelegramMessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(true);

  const messagesRef = useRef<HTMLDivElement | null>(null);
  const latestIdRef = useRef<number>(0);
  const fetchingNewRef = useRef(false);

  useEffect(() => {
    latestIdRef.current = messages.reduce((max, row) => Math.max(max, row.id), 0);
  }, [messages]);

  const canSend = useMemo(() => {
    if (!validChatId) return false;
    return Boolean(draft.trim()) && !sending;
  }, [draft, sending, validChatId]);

  const loadUser = async () => {
    if (!validChatId) return;
    const { data, error } = await supabase
      .from("users")
      .select("user_id, username")
      .eq("user_id", validChatId)
      .maybeSingle();
    if (error) return;
    setUser((data as UserBrief) || null);
  };

  const loadInitialMessages = async () => {
    if (!validChatId) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("telegram_messages")
      .select("id, chat_id, message_id, direction, message_type, text, payload, sent_at")
      .eq("chat_id", validChatId)
      .order("id", { ascending: false })
      .limit(200);

    if (error) {
      const msg = error.message || "Không thể tải tin nhắn.";
      setError(
        msg.includes("telegram_messages")
          ? "Chưa có bảng telegram_messages trong Supabase (cần tạo schema/migration trước)."
          : msg
      );
      setMessages([]);
      setLoading(false);
      return;
    }

    const rows = (data as TelegramMessageRow[]) || [];
    setHasOlder(rows.length === 200);
    setMessages(sortMessages(rows));
    setLoading(false);

    // Scroll to bottom after first render of rows.
    requestAnimationFrame(() => {
      const el = messagesRef.current;
      if (!el) return;
      el.scrollTop = el.scrollHeight;
    });
  };

  const fetchNewMessages = async () => {
    if (!validChatId) return;
    if (fetchingNewRef.current) return;
    fetchingNewRef.current = true;
    const lastId = latestIdRef.current || 0;
    try {
      const { data, error } = await supabase
        .from("telegram_messages")
        .select("id, chat_id, message_id, direction, message_type, text, payload, sent_at")
        .eq("chat_id", validChatId)
        .gt("id", lastId)
        .order("id", { ascending: true })
        .limit(200);

      if (error || !data || data.length === 0) return;

      const el = messagesRef.current;
      const shouldStickToBottom = el
        ? el.scrollHeight - el.scrollTop - el.clientHeight < 140
        : true;

      setMessages((prev) => mergeMessages(prev, data as TelegramMessageRow[]));

      if (shouldStickToBottom) {
        requestAnimationFrame(() => {
          const nextEl = messagesRef.current;
          if (!nextEl) return;
          nextEl.scrollTop = nextEl.scrollHeight;
        });
      }
    } finally {
      fetchingNewRef.current = false;
    }
  };

  const loadOlderMessages = async () => {
    if (!validChatId) return;
    if (loadingOlder || !hasOlder) return;
    if (!messages.length) return;

    const beforeId = messages.reduce((min, row) => Math.min(min, row.id), Number.POSITIVE_INFINITY);
    if (!Number.isFinite(beforeId)) return;

    setLoadingOlder(true);
    setError(null);

    const el = messagesRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    const prevTop = el?.scrollTop ?? 0;

    const { data, error } = await supabase
      .from("telegram_messages")
      .select("id, chat_id, message_id, direction, message_type, text, payload, sent_at")
      .eq("chat_id", validChatId)
      .lt("id", beforeId)
      .order("id", { ascending: false })
      .limit(200);

    if (error) {
      setLoadingOlder(false);
      setError(error.message || "Không thể tải thêm tin nhắn.");
      return;
    }

    const rows = (data as TelegramMessageRow[]) || [];
    if (!rows.length) {
      setHasOlder(false);
      setLoadingOlder(false);
      return;
    }
    if (rows.length < 200) {
      setHasOlder(false);
    }

    setMessages((prev) => mergeMessages(rows, prev));

    requestAnimationFrame(() => {
      const nextEl = messagesRef.current;
      if (!nextEl) return;
      const nextHeight = nextEl.scrollHeight;
      nextEl.scrollTop = nextHeight - prevHeight + prevTop;
    });

    setLoadingOlder(false);
  };

  useEffect(() => {
    if (!validChatId) return;
    void loadUser();
    void loadInitialMessages();
  }, [validChatId]);

  useEffect(() => {
    if (!validChatId) return;
    const timer = setInterval(() => {
      void fetchNewMessages();
    }, 2000);
    return () => clearInterval(timer);
  }, [validChatId]);

  const sendMessageRequest = async (payload: { message: string; userId: number }) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setError("Chưa đăng nhập.");
      return false;
    }
    try {
      const res = await fetch("/api/telegram/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error || "Gửi thất bại.");
        return false;
      }
      return true;
    } catch {
      setError("Gửi thất bại.");
      return false;
    }
  };

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validChatId) return;
    const message = draft.trim();
    if (!message) return;
    if (sending) return;

    setSending(true);
    setError(null);
    const ok = await sendMessageRequest({ message, userId: validChatId });
    setSending(false);
    if (!ok) return;

    setDraft("");
    // Nudge refresh so the just-sent message appears even if DB insert takes a moment.
    setTimeout(() => {
      void fetchNewMessages();
    }, 500);
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter") return;
    if (event.shiftKey) return;
    event.preventDefault();
    if (!canSend) return;
    void handleSend(event as any);
  };

  if (!validChatId) {
    return (
      <div className="grid" style={{ gap: 24 }}>
        <div className="topbar">
          <div>
            <h1 className="page-title">Chat</h1>
            <p className="muted">User ID không hợp lệ.</p>
          </div>
          <Link className="button secondary" href="/users">
            Quay lại
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid" style={{ gap: 24 }}>
      <div className="topbar">
        <div>
          <h1 className="page-title">Chat 1-1</h1>
          <p className="muted">
            User {validChatId}
            {user?.username ? ` · @${user.username}` : ""}
          </p>
        </div>
        <Link className="button secondary" href="/users">
          Quay lại
        </Link>
      </div>

      <div className="card chat-card">
        <div className="chat-messages" ref={messagesRef}>
          <div className="chat-top">
            <button
              type="button"
              className="button secondary"
              onClick={() => void loadOlderMessages()}
              disabled={loading || loadingOlder || !hasOlder || !messages.length}
            >
              {loadingOlder ? "Đang tải..." : hasOlder ? "Tải thêm" : "Hết tin nhắn cũ"}
            </button>
          </div>
          {loading && <div className="muted">Đang tải tin nhắn...</div>}
          {!loading && !messages.length && <div className="muted">Chưa có tin nhắn.</div>}
          {messages.map((msg) => (
            <div key={msg.id} className={`chat-row ${msg.direction === "out" ? "out" : "in"}`}>
              <div className={`chat-bubble ${msg.direction === "out" ? "out" : "in"}`}>
                <div className="chat-text">{renderMessageText(msg)}</div>
                <div className="chat-meta">{formatChatTime(msg.sent_at)}</div>
              </div>
            </div>
          ))}
        </div>

        <form className="chat-compose" onSubmit={handleSend}>
          <textarea
            className="textarea chat-input"
            placeholder="Nhập tin nhắn... (Enter để gửi, Shift+Enter xuống dòng)"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleInputKeyDown}
          />
          <button className="button" type="submit" disabled={!canSend}>
            {sending ? "Đang gửi..." : "Gửi"}
          </button>
        </form>
        {error && (
          <p className="muted" style={{ marginTop: 10, color: "var(--danger)" }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
