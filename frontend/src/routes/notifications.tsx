import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, CheckCheck, RotateCcw, ArrowUpRight } from "lucide-react";
import { TopBar } from "@/components/copilot/TopBar";
import { LeftNav } from "@/components/copilot/LeftNav";
import { useNotifications, KIND_STYLES, type NotifKind } from "@/lib/notifications";

export const Route = createFileRoute("/notifications")({
  component: NotificationsPage,
  head: () => ({
    meta: [
      { title: "Notifications · OCP Maroc Copilot" },
      { name: "description", content: "Live alert center for pump P-104: critical conditions, degradation warnings, spare part stock alerts and logged interventions." },
      { property: "og:title", content: "Notifications · OCP Maroc Copilot" },
      { property: "og:description", content: "Live alert center for pump P-104: critical conditions, stock alerts and logged interventions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const FILTERS: { id: "all" | NotifKind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "critical", label: "Critical" },
  { id: "warning", label: "Warnings" },
  { id: "stock", label: "Inventory" },
  { id: "maintenance", label: "Maintenance" },
];

function NotificationsPage() {
  const { items, unreadCount, isRead, markRead, markAllRead, reset } = useNotifications();
  const [filter, setFilter] = React.useState<"all" | NotifKind>("all");

  const shown = items.filter(n => filter === "all" || n.kind === filter);

  return (
    <div className="min-h-screen w-full flex flex-col bg-background text-foreground">
      <TopBar />
      <div className="flex-1 flex min-h-0">
        <LeftNav />
        <main className="flex-1 min-w-0 overflow-y-auto scrollbar-thin p-6">
          <div className="max-w-4xl mx-auto space-y-5">
            <header className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold flex items-center gap-2">
                  <Bell className="h-5 w-5" strokeWidth={1.6} /> Notification center
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {unreadCount} unread of {items.length} alerts, derived live from asset health, inventory and intervention logs.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-md border border-border hover:bg-accent transition-colors"
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                </button>
                <button
                  onClick={reset}
                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Reset
                </button>
              </div>
            </header>

            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    filter === f.id
                      ? "border-border-strong bg-accent text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f.label}
                  <span className="ml-1.5 text-[10px] font-mono text-muted-foreground">
                    {f.id === "all" ? items.length : items.filter(n => n.kind === f.id).length}
                  </span>
                </button>
              ))}
            </div>

            <div className="rounded-xl border border-border bg-surface-1 divide-y divide-border overflow-hidden">
              {shown.length === 0 && (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">No notifications in this category.</div>
              )}
              {shown.map(n => {
                const s = KIND_STYLES[n.kind];
                const read = isRead(n.id);
                return (
                  <div key={n.id} className={`px-4 py-3.5 flex gap-3 ${read ? "opacity-55" : ""}`}>
                    <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${s.dot}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{n.title}</span>
                        <span className={`text-[10px] uppercase font-mono ${s.text}`}>{s.label}</span>
                        <span className="text-[10px] font-mono text-muted-foreground/70">{n.time}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{n.body}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {n.target && (
                        <Link
                          to="/equipment"
                          className="text-[11px] px-2 py-1 rounded-md border border-border hover:bg-accent flex items-center gap-1"
                        >
                          Inspect <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      )}
                      {!read && (
                        <button
                          onClick={() => markRead(n.id)}
                          className="text-[11px] px-2 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
