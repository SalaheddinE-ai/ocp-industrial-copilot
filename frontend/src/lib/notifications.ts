import * as React from "react";
import { useEquipment, type Equipment } from "@/lib/equipment-store";

export type NotifKind = "critical" | "warning" | "stock" | "maintenance" | "info";

export interface Notification {
  id: string;
  kind: NotifKind;
  title: string;
  body: string;
  target?: string;
  time: string;
}

const READ_KEY = "ocp.notifications.read";

function readIds(): string[] {
  try {
    return JSON.parse(window.localStorage.getItem(READ_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function derive(list: Equipment[]): Notification[] {
  const out: Notification[] = [];

  for (const c of list) {
    if (c.status === "critical") {
      out.push({
        id: `status-${c.id}-critical`,
        kind: "critical",
        title: `${c.name} — critical condition`,
        body: c.symptoms?.[0] ?? c.failureModes?.[0] ?? "Immediate inspection required.",
        target: c.id,
        time: "now",
      });
    } else if (c.status === "warning") {
      out.push({
        id: `status-${c.id}-warning`,
        kind: "warning",
        title: `${c.name} — degradation detected`,
        body: c.symptoms?.[0] ?? c.failureModes?.[0] ?? "Schedule an inspection.",
        target: c.id,
        time: "today",
      });
    }

    for (const p of c.parts ?? []) {
      if (p.stock === 0) {
        out.push({
          id: `stock-${c.id}-${p.ref}`,
          kind: "stock",
          title: `Out of stock · ${p.name}`,
          body: `${p.ref} — required for ${c.name}. Raise a purchase request.`,
          target: c.id,
          time: "today",
        });
      } else if (p.stock <= 2) {
        out.push({
          id: `stock-low-${c.id}-${p.ref}`,
          kind: "stock",
          title: `Low stock · ${p.name}`,
          body: `${p.ref} — only ${p.stock} unit(s) left for ${c.name}.`,
          target: c.id,
          time: "this week",
        });
      }
    }
  }

  const latest = list
    .flatMap(c => (c.history ?? []).map(h => ({ ...h, owner: c.name, id: c.id })))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 3);

  for (const h of latest) {
    out.push({
      id: `hist-${h.id}-${h.date}`,
      kind: "maintenance",
      title: `Intervention logged · ${h.owner}`,
      body: `${h.date} — ${h.tech}: ${h.notes}`,
      target: h.id,
      time: h.date,
    });
  }

  const order: NotifKind[] = ["critical", "warning", "stock", "maintenance", "info"];
  return out.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
}

export function useNotifications() {
  const { list } = useEquipment();
  const [read, setRead] = React.useState<string[]>([]);

  React.useEffect(() => setRead(readIds()), []);

  const persist = React.useCallback((ids: string[]) => {
    setRead(ids);
    try {
      window.localStorage.setItem(READ_KEY, JSON.stringify(ids));
    } catch {
      /* storage full — read state is non-critical */
    }
  }, []);

  const items = React.useMemo(() => derive(list), [list]);
  const unread = items.filter(n => !read.includes(n.id));

  return {
    items,
    read,
    unread,
    unreadCount: unread.length,
    isRead: (id: string) => read.includes(id),
    markRead: (id: string) => persist([...new Set([...read, id])]),
    markAllRead: () => persist(items.map(n => n.id)),
    reset: () => persist([]),
  };
}

export const KIND_STYLES: Record<NotifKind, { label: string; dot: string; text: string }> = {
  critical: { label: "Critical", dot: "bg-critical", text: "text-critical" },
  warning: { label: "Warning", dot: "bg-warning", text: "text-warning" },
  stock: { label: "Inventory", dot: "bg-[color:var(--cyan)]", text: "text-[color:var(--cyan)]" },
  maintenance: { label: "Maintenance", dot: "bg-success", text: "text-success" },
  info: { label: "Info", dot: "bg-muted-foreground", text: "text-muted-foreground" },
};
