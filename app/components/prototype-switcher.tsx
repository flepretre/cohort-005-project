// PROTOTYPE: floating variant switcher. Never shown in production builds.
import { useEffect, useState } from "react";
import { useSearchParams, useFetcher } from "react-router";
import { ChevronLeft, ChevronRight, Send } from "lucide-react";

const STORAGE_KEY = "notification-feed-prototype-variant";

// URL ?variant= wins; otherwise remember the last one so clicking a Notification
// (which navigates away and drops the param) keeps the same variant.
export function usePrototypeVariant(variants: string[]) {
  const [params] = useSearchParams();
  const [stored, setStored] = useState<string | null>(null);
  useEffect(() => {
    try {
      setStored(localStorage.getItem(STORAGE_KEY));
    } catch {}
  }, []);
  const fromUrl = params.get("variant");
  const variant = fromUrl && variants.includes(fromUrl) ? fromUrl : stored && variants.includes(stored) ? stored : variants[0];
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, variant);
    } catch {}
  }, [variant]);
  return variant;
}

export function PrototypeSwitcher({
  variants,
  current,
}: {
  variants: { key: string; name: string }[];
  current: string;
}) {
  const [params, setParams] = useSearchParams();
  const fetcher = useFetcher<{ results: { kind: string; status: number; body: string | null }[] }>();
  const idx = variants.findIndex((v) => v.key === current);

  function go(delta: number) {
    const next = variants[(idx + delta + variants.length) % variants.length];
    const p = new URLSearchParams(params);
    p.set("variant", next.key);
    try {
      localStorage.setItem(STORAGE_KEY, next.key);
    } catch {}
    setParams(p, { replace: true });
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, [contenteditable]")) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (process.env.NODE_ENV === "production") return null;

  const failed = fetcher.data?.results.filter((r) => r.status >= 300) ?? [];

  return (
    <div className="fixed bottom-4 left-1/2 z-[100] -translate-x-1/2">
      {failed.length > 0 && (
        <div className="mb-2 max-w-md rounded-md bg-red-600 px-3 py-2 text-xs text-white">
          Trigger failed ({failed[0].status}): {failed[0].body}
        </div>
      )}
      <div className="flex items-center gap-2 rounded-full bg-zinc-900 px-2 py-1.5 text-sm text-white shadow-lg ring-2 ring-yellow-400">
        <button onClick={() => go(-1)} className="rounded-full p-1 hover:bg-white/20">
          <ChevronLeft className="size-4" />
        </button>
        <span className="min-w-44 text-center font-mono">
          {current} ({variants[idx]?.name})
        </span>
        <button onClick={() => go(1)} className="rounded-full p-1 hover:bg-white/20">
          <ChevronRight className="size-4" />
        </button>
        <fetcher.Form method="post" action="/api/notifications-prototype">
          <button
            type="submit"
            disabled={fetcher.state !== "idle"}
            className="flex items-center gap-1 rounded-full bg-yellow-400 px-3 py-1 text-xs font-semibold text-zinc-900 hover:bg-yellow-300 disabled:opacity-50"
            title="Trigger one of each catalogue Notification to the current user via Knock"
          >
            <Send className="size-3" />
            {fetcher.state !== "idle" ? "Sending…" : "Send 5 samples"}
          </button>
        </fetcher.Form>
      </div>
    </div>
  );
}
