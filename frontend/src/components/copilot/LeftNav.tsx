import * as React from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Boxes, Cpu, Bot, BookOpen, ClipboardList,
  Package, History, Settings, ChevronsLeft, ChevronsRight, Bell, Home, X,
} from "lucide-react";
import { useMobileNav } from "@/lib/nav-ui";

const NAV = [
  { icon: Home, label: "Home", to: "/" },
  { icon: LayoutDashboard, label: "Dashboard", to: "/dashboard" },
  { icon: Boxes, label: "Equipment Explorer", to: "/equipment" },
  { icon: Cpu, label: "Digital Twin", to: "/twin" },
  { icon: Bot, label: "AI Assistant", to: "/assistant" },
  { icon: BookOpen, label: "Manual Library", to: "/manuals" },
  { icon: ClipboardList, label: "Maintenance Reports", to: "/reports" },
  { icon: Package, label: "Spare Parts", to: "/parts" },
  { icon: History, label: "History", to: "/history" },
  { icon: Bell, label: "Notifications", to: "/notifications" },
  { icon: Settings, label: "Settings", to: "/settings" },
] as const;

function NavList({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = useRouterState({ select: s => s.location.pathname });
  return (
    <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto scrollbar-thin">
      {NAV.map(item => {
        const active = item.to === pathname;
        const cls = `w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-sm transition-colors ${
          active
            ? "bg-accent text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
        }`;
        return (
          <Link key={item.label} to={item.to} onClick={onNavigate} className={cls} title={item.label}>
            <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
            {!collapsed && <span className="truncate">{item.label}</span>}
            {!collapsed && active && (
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[color:var(--cyan)]" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function LeftNav() {
  const [collapsed, setCollapsed] = React.useState(false);
  const { open, setOpen } = useMobileNav();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setOpen]);

  return (
    <>
      {/* Desktop / tablet */}
      <aside
        className={`hidden md:flex shrink-0 border-r border-border bg-surface-1 flex-col transition-[width] duration-200 ${
          collapsed ? "w-[62px]" : "w-[220px]"
        }`}
      >
        <NavList collapsed={collapsed} />
        <div className="border-t border-border p-2">
          <button
            onClick={() => setCollapsed(c => !c)}
            className="w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside className="relative w-[260px] max-w-[80vw] h-full border-r border-border bg-surface-1 flex flex-col">
            <div className="h-[56px] shrink-0 px-3 flex items-center justify-between border-b border-border">
              <span className="text-[12px] font-semibold">OCP Maroc · Copilot</span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <NavList collapsed={false} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
