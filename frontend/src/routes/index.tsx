import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Cpu, Bot, Boxes, BookOpen, ClipboardList, Package, ArrowRight,
  ShieldCheck, Activity, Gauge, Factory, LogIn,
} from "lucide-react";
import { componentList } from "@/lib/pump-data";
import { FalconLogo } from "@/components/brand/FalconLogo";
import { useAccount } from "@/lib/account";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "Falcon · Industrial Copilot for Pump Maintenance" },
      { name: "description", content: "Falcon is the industrial knowledge copilot for OCP Maroc pump maintenance: 3D digital twin, AI guidance, manuals, spare parts and intervention history. Create your account with Google or email." },
      { property: "og:title", content: "Falcon · Industrial Copilot" },
      { property: "og:description", content: "3D digital twin, AI maintenance guidance, manuals, spare parts and intervention history for centrifugal pump P-104." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const MODULES = [
  { icon: Cpu, title: "Digital Twin", to: "/twin", text: "Explore pump P-104 in 3D: section cuts, measurements, colored annotations." },
  { icon: Bot, title: "AI Assistant", to: "/assistant", text: "Ask about cavitation, LOTO or torque values — grounded on P-104 data." },
  { icon: Boxes, title: "Equipment Explorer", to: "/equipment", text: "Registry of 12 monitored components with specs, failure modes and parts." },
  { icon: BookOpen, title: "Manual Library", to: "/manuals", text: "Manuals, drawings and datasheets searchable by component and type." },
  { icon: ClipboardList, title: "Maintenance Reports", to: "/reports", text: "Intervention KPIs, technician filters and CSV export." },
  { icon: Package, title: "Spare Parts", to: "/parts", text: "Stock levels, references and reorder priorities across the asset." },
] as const;

function HomePage() {
  const { account, loading } = useAccount();

  const counts = React.useMemo(() => {
    const c = { healthy: 0, warning: 0, critical: 0 } as Record<string, number>;
    componentList.forEach((x) => { c[x.status] += 1; });
    return c;
  }, []);
  const health = Math.round(((counts.healthy + counts.warning * 0.6) / componentList.length) * 100);

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      {/* Public header */}
      <header className="sticky top-0 z-40 h-[64px] border-b border-border bg-surface-1/90 backdrop-blur flex items-center justify-between px-4 sm:px-8">
        <Link to="/">
          <FalconLogo size={38} tagline="Industrial Copilot" />
        </Link>
        <nav className="flex items-center gap-2">
          {loading ? null : account ? (
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-foreground text-background text-[13px] font-medium hover:opacity-90 transition-opacity"
            >
              Open workspace <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <>
              <Link
                to="/auth"
                search={{ mode: "login" }}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-[13px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <LogIn className="h-3.5 w-3.5" /> Sign in
              </Link>
              <Link
                to="/auth"
                search={{ mode: "register" }}
                className="inline-flex items-center h-9 px-4 rounded-lg bg-foreground text-background text-[13px] font-medium hover:opacity-90 transition-opacity"
              >
                Create account
              </Link>
            </>
          )}
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="border-b border-border bg-surface-1">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-16 lg:py-24 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-border text-[10px] uppercase tracking-widest text-muted-foreground">
                <Factory className="h-3 w-3" /> OCP Maroc · Jorf Lasfar
              </div>
              <h1 className="mt-5 text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight leading-[1.08]">
                Falcon — the industrial knowledge copilot for centrifugal pump maintenance
              </h1>
              <p className="mt-4 text-sm sm:text-base text-muted-foreground max-w-xl">
                One workspace joining the 3D digital twin of pump P-104, AI-assisted
                procedures, manuals, spare parts and every intervention ever logged.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                {account ? (
                  <Link
                    to="/twin"
                    className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    Open Digital Twin <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <Link
                    to="/auth"
                    search={{ mode: "register" }}
                    className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    Create your account <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
                <Link
                  to="/auth"
                  search={{ mode: "login" }}
                  className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  {account ? "Manage account" : "Sign in with Google or email"}
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Stat icon={Activity} label="Asset health" value={`${health}%`} sub="Pump P-104" />
              <Stat icon={Gauge} label="Components" value={String(componentList.length)} sub="Monitored" />
              <Stat icon={ShieldCheck} label="Healthy" value={String(counts.healthy)} sub="No action" />
              <Stat icon={Activity} label="Attention" value={String(counts.warning + counts.critical)} sub="Warning / critical" />
            </div>
          </div>
        </section>

        {/* Modules */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-16">
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight">Workspace modules</h2>
          <p className="mt-1 text-sm text-muted-foreground">Everything a maintenance team needs, in one place.</p>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {MODULES.map((m) => (
              <Link
                key={m.title}
                to={m.to}
                className="group rounded-xl border border-border bg-surface-1 p-4 sm:p-5 hover:border-border-strong transition-colors"
              >
                <div className="h-9 w-9 rounded-lg bg-surface-3 border border-border flex items-center justify-center">
                  <m.icon className="h-4 w-4" strokeWidth={1.5} />
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-sm font-medium">
                  {m.title}
                  <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </div>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{m.text}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Status strip */}
        <section className="border-t border-border bg-surface-1">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-10">
            <h2 className="text-lg sm:text-xl font-semibold tracking-tight">Component status</h2>
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {componentList.map((c) => (
                <Link
                  key={c.id}
                  to="/twin"
                  className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 hover:border-border-strong transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                        c.status === "critical" ? "bg-critical" : c.status === "warning" ? "bg-warning" : "bg-success"
                      }`}
                    />
                    <span className="text-[12.5px] truncate">{c.name}</span>
                  </div>
                  <div className="mt-1 text-[10.5px] uppercase tracking-wide text-muted-foreground">{c.status}</div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <footer className="border-t border-border px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <FalconLogo size={30} tagline="Industrial Copilot" />
          <p className="text-[11px] text-muted-foreground">
            Falcon · OCP Maroc internal maintenance platform — v2.4
          </p>
        </footer>
      </main>
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub }: { icon: typeof Activity; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2 p-4">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.5} /> {label}
      </div>
      <div className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight">{value}</div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}
