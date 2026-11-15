// PROTOTYPE: headless Knock feed client, shared by every variant.
// Polls the real Knock feed API with a signed user token; no Knock SDK.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const KNOCK = "https://api.knock.app/v1";

export interface FeedConfig {
  publicKey: string;
  channelId: string;
  knockUserId: string;
  userToken: string;
}

export interface FeedItem {
  id: string;
  inserted_at: string;
  read_at: string | null;
  seen_at: string | null;
  archived_at: string | null;
  actors: { id: string; name?: string }[];
  data: Record<string, any>;
}

interface FeedState {
  items: FeedItem[];
  unreadCount: number;
  unseenCount: number;
  error: string | null;
  markSeen: (ids?: string[]) => void;
  markRead: (ids: string[]) => void;
  markUnread: (ids: string[]) => void;
  archive: (ids: string[]) => void;
  markAllRead: () => void;
  refresh: () => void;
}

const FeedContext = createContext<FeedState | null>(null);

export function useFeed() {
  const ctx = useContext(FeedContext);
  if (!ctx) throw new Error("useFeed outside FeedProvider");
  return ctx;
}

export function FeedProvider({
  config,
  toastOnArrival,
  children,
}: {
  config: FeedConfig | null;
  toastOnArrival: boolean;
  children: React.ReactNode;
}) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [unreadCount, setUnread] = useState(0);
  const [unseenCount, setUnseen] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const known = useRef<Set<string> | null>(null);

  const headers = config
    ? {
        Authorization: `Bearer ${config.publicKey}`,
        "X-Knock-User-Token": config.userToken,
        "Content-Type": "application/json",
      }
    : undefined;

  const refresh = useCallback(async () => {
    if (!config) return;
    const res = await fetch(
      `${KNOCK}/users/${config.knockUserId}/feeds/${config.channelId}?page_size=50`,
      { headers }
    );
    if (!res.ok) {
      setError(`Knock feed ${res.status}: ${await res.text()}`);
      return;
    }
    setError(null);
    const body = await res.json();
    const entries: FeedItem[] = body.entries;
    if (known.current && toastOnArrival) {
      for (const e of entries) {
        if (!known.current.has(e.id)) {
          const { title } = describe(e);
          toast(title, { action: { label: "Open", onClick: () => (window.location.href = e.data.url) } });
        }
      }
    }
    known.current = new Set(entries.map((e) => e.id));
    setItems(entries);
    setUnread(body.meta.unread_count);
    setUnseen(body.meta.unseen_count);
  }, [config?.userToken, toastOnArrival]);

  useEffect(() => {
    known.current = null;
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  const batch = useCallback(
    async (status: string, ids: string[]) => {
      if (!config || ids.length === 0) return;
      await fetch(`${KNOCK}/messages/batch/${status}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ message_ids: ids }),
      });
      refresh();
    },
    [config?.userToken, refresh]
  );

  const value: FeedState = {
    items,
    unreadCount,
    unseenCount,
    error,
    refresh,
    markSeen: (ids) => batch("seen", ids ?? items.filter((i) => !i.seen_at).map((i) => i.id)),
    markRead: (ids) => batch("read", ids),
    markUnread: (ids) => batch("unread", ids),
    archive: (ids) => batch("archived", ids),
    markAllRead: () => batch("read", items.filter((i) => !i.read_at).map((i) => i.id)),
  };

  return <FeedContext.Provider value={value}>{children}</FeedContext.Provider>;
}

// How each catalogue Notification reads. Rendered from trigger data, not Knock templates.
export function describe(item: FeedItem): { title: string; detail?: string; context: string } {
  const d = item.data;
  const actor = item.actors[0]?.name ?? "Someone";
  switch (d.kind) {
    case "question":
      return { title: `${actor} asked a question on ${d.lessonTitle}`, detail: d.excerpt, context: d.courseTitle };
    case "reply":
      return { title: `${actor} replied on ${d.lessonTitle}`, detail: d.excerpt, context: d.courseTitle };
    case "seat-claimed":
      return {
        title: `${actor} claimed a Seat on ${d.courseTitle}`,
        detail: `${d.seatsLeft} Seats left`,
        context: "Team",
      };
    case "refund-raised":
      return { title: `${actor} asked for a refund on ${d.courseTitle}`, detail: d.reason, context: "Refund Requests" };
    case "refund-decided":
      return {
        title: `Your refund on ${d.courseTitle} was ${d.outcome}`,
        detail: d.note,
        context: `Decided by ${actor}`,
      };
    default:
      return { title: "Unknown Notification", context: "" };
  }
}

export function timeAgo(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
