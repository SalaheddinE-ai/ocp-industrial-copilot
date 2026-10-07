import * as React from "react";
import { Bell, CheckCheck, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useNotifications, KIND_STYLES } from "@/lib/notifications";

export function NotificationsMenu() {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const { items, unreadCount, isRead, markRead, markAllRead } = useNotifications();

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Notifications"
        title="Notifications"
        className="relative h-9 w-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-center transition-colors"
      >
        <Bell className="h-4 w-4" strokeWidth={1.5} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[15px] h-[15px] px-1 rounded-full bg-critical text-[9px] font-semibold text-background flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-[380px] rounded-xl border border-border bg-surface-1 shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div>
              <div className="text-sm font-semibold">Notifications</div>
              <div className="text-[11px] text-muted-foreground">
                {unreadCount} unread · {items.length} total
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={markAllRead}
                title="Mark all as read"
                className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-center"
              >
                <CheckCheck className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-center"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto scrollbar-thin divide-y divide-border">
            {items.length === 0 && (
              <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                No alerts. The fleet is nominal.
              </div>
            )}
            {items.map(n => {
              const s = KIND_STYLES[n.kind];
              const read = isRead(n.id);
              return (
                <button
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-accent/50 transition-colors ${read ? "opacity-55" : ""}`}
                >
                  <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${s.dot}`} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="text-[13px] font-medium truncate">{n.title}</span>
                      <span className={`text-[10px] uppercase font-mono ${s.text}`}>{s.label}</span>
                    </span>
                    <span className="block text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{n.body}</span>
                    <span className="block text-[10px] text-muted-foreground/70 font-mono mt-1">{n.time}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="border-t border-border p-2">
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="block text-center text-xs py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
