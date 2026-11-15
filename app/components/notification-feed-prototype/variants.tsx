// PROTOTYPE: three structurally different Notification Feed variants.
//   A  Bell popover    — bell in the sidebar header, compact dropdown, badge = unseen
//   B  Drawer          — "Notifications" nav item, right slide-over, tabs + day groups, badge = unread
//   C  Inbox page      — "Notifications" nav item -> /notifications list+detail, toasts on arrival
import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router";
import {
  Bell,
  Receipt,
  UsersRound,
  MessageSquare,
  MessagesSquare,
  Gavel,
  Check,
  Archive,
  MailOpen,
  Mail,
  X,
  ArrowRight,
  Inbox,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { UserAvatar } from "~/components/user-avatar";
import { describe, timeAgo, useFeed, type FeedItem } from "./feed-store";

const kindIcon: Record<string, React.ReactNode> = {
  question: <MessageSquare className="size-4" />,
  reply: <MessagesSquare className="size-4" />,
  "seat-claimed": <UsersRound className="size-4" />,
  "refund-raised": <Receipt className="size-4" />,
  "refund-decided": <Gavel className="size-4" />,
};

const navItemClass =
  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors";

function CountBadge({ n, className }: { n: number; className?: string }) {
  if (n === 0) return null;
  return (
    <span
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-semibold leading-5 text-white",
        className
      )}
    >
      {n > 9 ? "9+" : n}
    </span>
  );
}

function FeedError() {
  const { error } = useFeed();
  if (!error) return null;
  return <div className="p-3 text-xs text-red-600 break-all">{error}</div>;
}

function useOpenRow() {
  const { markRead } = useFeed();
  const navigate = useNavigate();
  return (item: FeedItem, after?: () => void) => {
    if (!item.read_at) markRead([item.id]);
    after?.();
    navigate(item.data.url);
  };
}

/* ───────────────────────────── Variant A: Bell popover ───────────────────────────── */

export function VariantAHeader() {
  const { items, unseenCount, unreadCount, markSeen, markAllRead } = useFeed();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const openRow = useOpenRow();

  useEffect(() => {
    if (!open) return;
    markSeen();
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative ml-auto">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent"
        title="Notifications"
      >
        <Bell className="size-5" />
        <CountBadge n={unseenCount} className="absolute -right-1.5 -top-1.5" />
      </button>
      {open && (
        <div className="absolute left-0 top-10 z-50 w-96 rounded-lg border bg-popover text-popover-foreground shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <span className="text-sm font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-primary hover:underline">
                Mark all as read
              </button>
            )}
          </div>
          <FeedError />
          <div className="max-h-[28rem] overflow-y-auto">
            {items.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">You're all caught up.</div>
            )}
            {items.map((item) => {
              const { title } = describe(item);
              return (
                <button
                  key={item.id}
                  onClick={() => openRow(item, () => setOpen(false))}
                  className={cn(
                    "flex w-full items-start gap-3 border-b px-4 py-3 text-left text-sm last:border-0 hover:bg-accent",
                    !item.read_at && "bg-primary/5"
                  )}
                >
                  <span className="mt-0.5 text-muted-foreground">{kindIcon[item.data.kind]}</span>
                  <span className={cn("flex-1", !item.read_at && "font-medium")}>{title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(item.inserted_at)}</span>
                  {!item.read_at && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────── Variant B: Drawer ───────────────────────────── */

function dayGroup(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  const y = new Date(today);
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return "Earlier";
}

export function VariantBNav() {
  const { unreadCount } = useFeed();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          navItemClass,
          "w-full text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          open && "bg-sidebar-accent text-sidebar-accent-foreground"
        )}
      >
        <Bell className="size-4" />
        Notifications
        <CountBadge n={unreadCount} className="ml-auto" />
      </button>
      {open && <Drawer onClose={() => setOpen(false)} />}
    </>
  );
}

function Drawer({ onClose }: { onClose: () => void }) {
  const { items, unreadCount, markSeen, markAllRead, markRead, markUnread, archive } = useFeed();
  const [tab, setTab] = useState<"unread" | "all">("unread");
  const openRow = useOpenRow();

  useEffect(() => {
    markSeen();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const shown = items.filter((i) => !i.archived_at && (tab === "all" || !i.read_at));
  const groups: Record<string, FeedItem[]> = {};
  for (const i of shown) (groups[dayGroup(i.inserted_at)] ??= []).push(i);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className="relative flex h-full w-[28rem] flex-col border-l bg-background shadow-2xl">
        <div className="flex items-center gap-3 border-b px-5 py-4">
          <h2 className="text-base font-semibold">Notifications</h2>
          <button onClick={onClose} className="ml-auto rounded p-1 hover:bg-accent">
            <X className="size-4" />
          </button>
        </div>
        <div className="flex items-center gap-1 border-b px-5 py-2 text-sm">
          {(["unread", "all"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-md px-3 py-1 capitalize",
                tab === t ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/60"
              )}
            >
              {t}
              {t === "unread" && unreadCount > 0 && ` (${unreadCount})`}
            </button>
          ))}
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="ml-auto flex items-center gap-1 text-xs text-primary hover:underline">
              <Check className="size-3.5" /> Mark all as read
            </button>
          )}
        </div>
        <FeedError />
        <div className="flex-1 overflow-y-auto">
          {shown.length === 0 && (
            <div className="flex flex-col items-center gap-2 p-12 text-sm text-muted-foreground">
              <Inbox className="size-8" />
              {tab === "unread" ? "No unread Notifications." : "No Notifications yet."}
            </div>
          )}
          {Object.entries(groups).map(([label, group]) => (
            <section key={label}>
              <div className="sticky top-0 bg-background/95 px-5 pb-1 pt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {label}
              </div>
              {group.map((item) => {
                const { title, detail, context } = describe(item);
                const actor = item.actors[0]?.name ?? "?";
                return (
                  <div
                    key={item.id}
                    onClick={() => openRow(item, onClose)}
                    className="group relative flex cursor-pointer gap-3 px-5 py-3 hover:bg-accent/60"
                  >
                    {!item.read_at && <span className="absolute left-2 top-6 size-2 rounded-full bg-primary" />}
                    <div className="relative">
                      <UserAvatar name={actor} avatarUrl={null} />
                      <span className="absolute -bottom-1 -right-1 rounded-full border bg-background p-0.5 text-muted-foreground [&_svg]:size-3">
                        {kindIcon[item.data.kind]}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={cn("text-sm", !item.read_at ? "font-semibold" : "text-muted-foreground")}>
                        {title}
                      </div>
                      {detail && (
                        <div className="mt-1 line-clamp-2 border-l-2 pl-2 text-sm text-muted-foreground">{detail}</div>
                      )}
                      <div className="mt-1 text-xs text-muted-foreground">
                        {context} · {timeAgo(item.inserted_at)}
                      </div>
                    </div>
                    <div className="invisible flex flex-col gap-1 group-hover:visible" onClick={(e) => e.stopPropagation()}>
                      <button
                        title={item.read_at ? "Mark as unread" : "Mark as read"}
                        onClick={() => (item.read_at ? markUnread([item.id]) : markRead([item.id]))}
                        className="rounded p-1 hover:bg-background"
                      >
                        {item.read_at ? <Mail className="size-4" /> : <MailOpen className="size-4" />}
                      </button>
                      <button title="Dismiss" onClick={() => archive([item.id])} className="rounded p-1 hover:bg-background">
                        <Archive className="size-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      </aside>
    </div>
  );
}

/* ───────────────────────────── Variant C: Inbox page ───────────────────────────── */

export function VariantCNav() {
  const { unreadCount } = useFeed();
  return (
    <NavLink
      to="/notifications"
      className={({ isActive }) =>
        cn(
          navItemClass,
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )
      }
    >
      <Bell className="size-4" />
      Notifications
      <CountBadge n={unreadCount} className="ml-auto" />
    </NavLink>
  );
}

const filters = [
  { key: "all", label: "All", kinds: null },
  { key: "questions", label: "Questions & replies", kinds: ["question", "reply"] },
  { key: "refunds", label: "Refunds", kinds: ["refund-raised", "refund-decided"] },
  { key: "seats", label: "Seats", kinds: ["seat-claimed"] },
] as const;

const goLabel: Record<string, string> = {
  question: "Go to the question",
  reply: "Go to the thread",
  "seat-claimed": "Go to my Team",
  "refund-raised": "Review the Refund Request",
  "refund-decided": "Go to the course",
};

export function VariantCPage() {
  const { items, unreadCount, markSeen, markRead, markUnread, markAllRead } = useFeed();
  const [filter, setFilter] = useState<(typeof filters)[number]["key"]>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (items.some((i) => !i.seen_at)) markSeen();
  }, [items.length]);

  const kinds = filters.find((f) => f.key === filter)!.kinds as readonly string[] | null;
  const shown = items.filter((i) => !kinds || kinds.includes(i.data.kind));
  const selected = shown.find((i) => i.id === selectedId) ?? null;

  function select(item: FeedItem) {
    setSelectedId(item.id);
    if (!item.read_at) markRead([item.id]);
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-4 border-b px-8 py-5">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <span className="text-sm text-muted-foreground">{unreadCount} unread</span>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="ml-auto text-sm text-primary hover:underline">
            Mark all as read
          </button>
        )}
      </header>
      <div className="flex gap-2 border-b px-8 py-3">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm",
              filter === f.key ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      <FeedError />
      <div className="flex min-h-0 flex-1">
        <ul className="w-[26rem] shrink-0 overflow-y-auto border-r">
          {shown.length === 0 && <li className="p-8 text-sm text-muted-foreground">Nothing here.</li>}
          {shown.map((item) => {
            const { title, context } = describe(item);
            return (
              <li key={item.id}>
                <button
                  onClick={() => select(item)}
                  className={cn(
                    "flex w-full items-start gap-3 border-b px-5 py-4 text-left",
                    selected?.id === item.id ? "bg-accent" : "hover:bg-accent/50"
                  )}
                >
                  <span className={cn("mt-0.5", item.read_at ? "text-muted-foreground" : "text-primary")}>
                    {kindIcon[item.data.kind]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-sm", !item.read_at && "font-semibold")}>{title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{context}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{timeAgo(item.inserted_at)}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex-1 overflow-y-auto p-10">
          {!selected ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <Inbox className="size-10" />
              Select a Notification
            </div>
          ) : (
            (() => {
              const { title, detail, context } = describe(selected);
              const actor = selected.actors[0]?.name ?? "?";
              return (
                <article className="max-w-xl space-y-5">
                  <div className="flex items-center gap-3">
                    <UserAvatar name={actor} avatarUrl={null} className="size-10" />
                    <div>
                      <div className="font-medium">{actor}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(selected.inserted_at).toLocaleString()} · {context}
                      </div>
                    </div>
                  </div>
                  <h2 className="text-xl font-semibold">{title}</h2>
                  {detail && <blockquote className="rounded-md bg-muted p-4 text-sm">{detail}</blockquote>}
                  <div className="flex gap-3">
                    <button
                      onClick={() => navigate(selected.data.url)}
                      className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      {goLabel[selected.data.kind]} <ArrowRight className="size-4" />
                    </button>
                    <button
                      onClick={() => markUnread([selected.id])}
                      className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
                    >
                      Mark as unread
                    </button>
                  </div>
                </article>
              );
            })()
          )}
        </div>
      </div>
    </div>
  );
}
