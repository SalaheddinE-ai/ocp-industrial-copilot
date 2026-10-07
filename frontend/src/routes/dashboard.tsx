import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity, AlertTriangle, CheckCircle2, Gauge, Thermometer, Waves,
  Wrench, Clock, ArrowUpRight, TrendingUp, TrendingDown,
} from "lucide-react";
import { TopBar } from "@/components/copilot/TopBar";
import { LeftNav } from "@/components/copilot/LeftNav";
import { componentList, type Status } from "@/lib/pump-data";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Fleet Dashboard · OCP Maroc Industrial Copilot" },
      { name: "description", content: "Live health, alerts and maintenance KPIs for centrifugal pump P-104 and its 12 monitored components." },
      { property: "og:title", content: "Fleet Dashboard · OCP Maroc Industrial Copilot" },
      { property: "og:description", content: "Live health, alerts and maintenance KPIs for centrifugal pump P-104 and its 12 monitored components." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const STATUS_STYLE: Record<Status, { dot: string; text: string; label: string }> = {
  healthy: { dot: "bg-[color:var(--healthy,#22c55e)]", text: "text-[color:var(--healthy,#22c55e)]", label: "Healthy" },
  warning: { dot: "bg-[color:var(--warning,#eab308)]", text: "text-[color:var(--warning,#eab308)]", label: "Warning" },
  critical: { dot: "bg-[color:var(--critical,#ef4444)]", text: "text-[color:var(--critical,#ef4444)]", label: "Critical" },
};

function Dashboard() {
  const counts = React.useMemo(() => {
    const c: Record<Status, number> = { healthy: 0, warning: 0, critical: 0 };
    componentList.forEach(x => { c[x.status] += 1; });
    return c;
  }, []);

  const health = Math.round(
    ((counts.healthy + counts.warning * 0.6) / componentList.length) * 100,
  );

  const attention = componentList.filter(c => c.status !== "healthy");

  const recent = React.useMemo(
    () =>
      componentList
        .flatMap(c => c.history.map(h => ({ ...h, part: c.name, id: c.id })))
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .slice(0, 6),
    [],
  );

  return (
    <div className="min-h-screen w-full flex flex-col bg-background text-foreground">
      <TopBar />
      <div className="flex-1 flex min-h-0">
        <LeftNav />
        <main className="flex-1 min-w-0 overflow-y-auto">
          <div className="p-5 space-y-4 max-w-[1600px]">
            {/* Header */}
            <div className="flex items-end justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Fleet Dashboard</h1>
                <p className="text-[13px] text-muted-foreground mt-0.5">
                  Centrifugal pump P-104 · Line 3 · Jorf Lasfar · live telemetry
                </p>
              </div>
              <Link
                to="/twin"
                className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg border border-border bg-surface-2 hover:border-border-strong text-sm transition-colors"
              >
                Open Digital Twin
                <ArrowUpRight className="h-4 w-4" strokeWidth={1.5} />
              </Link>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <Kpi
                icon={Activity}
                label="Asset health"
                value={`${health}%`}
                sub={`${counts.healthy}/${componentList.length} components nominal`}
                trend="up"
                trendText="+2.1% vs last week"
              />
              <Kpi
                icon={Gauge}
                label="Discharge pressure"
                value="8.6 bar"
                sub="Setpoint 8.5 bar · ±0.4"
                trend="up"
                trendText="stable 24h"
              />
              <Kpi
                icon={Waves}
                label="Vibration (RMS)"
                value="4.2 mm/s"
                sub="ISO 10816 zone B"
                trend="down"
                trendText="-0.3 mm/s after balancing"
              />
              <Kpi
                icon={Thermometer}
                label="Bearing temp"
                value="68 °C"
                sub="Alarm at 85 °C"
                trend="up"
                trendText="+3 °C in 12h"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              {/* Component health */}
              <section className="lg:col-span-8 rounded-xl border border-border bg-surface-1">
                <SectionHead
                  title="Component health"
                  meta={`${counts.critical} critical · ${counts.warning} warning · ${counts.healthy} healthy`}
                />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-border">
                  {componentList.map(c => {
                    const s = STATUS_STYLE[c.status];
                    return (
                      <Link
                        key={c.id}
                        to="/twin"
                        className="bg-surface-1 hover:bg-accent/50 transition-colors p-3 flex items-start gap-3"
                      >
                        <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${s.dot}`} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="text-[13px] font-medium truncate">{c.name}</span>
                            <span className={`text-[10px] font-mono uppercase ${s.text}`}>{s.label}</span>
                          </span>
                          <span className="block text-[11px] text-muted-foreground truncate mt-0.5">
                            {c.function}
                          </span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </section>

              {/* Alerts */}
              <section className="lg:col-span-4 rounded-xl border border-border bg-surface-1 flex flex-col">
                <SectionHead title="Needs attention" meta={`${attention.length} open`} />
                <div className="p-3 space-y-2 flex-1">
                  {attention.length === 0 && (
                    <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} /> All components nominal
                    </div>
                  )}
                  {attention.map(c => {
                    const s = STATUS_STYLE[c.status];
                    return (
                      <div key={c.id} className="rounded-lg border border-border bg-surface-2 p-3">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className={`h-3.5 w-3.5 ${s.text}`} strokeWidth={1.5} />
                          <span className="text-[13px] font-medium">{c.name}</span>
                          <span className={`ml-auto text-[10px] font-mono uppercase ${s.text}`}>{s.label}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
                          {c.symptoms[0] ?? c.failureModes[0]}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-[10px] font-mono text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Wrench className="h-3 w-3" /> {c.maintenance.time}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {c.maintenance.difficulty} effort
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Recent interventions */}
              <section className="lg:col-span-12 rounded-xl border border-border bg-surface-1">
                <SectionHead title="Recent interventions" meta="last 6 work orders" />
                <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-[12px]">
                  <thead>
                    <tr className="text-muted-foreground text-[10px] font-mono uppercase">
                      <th className="text-left font-normal px-4 py-2">Date</th>
                      <th className="text-left font-normal px-4 py-2">Component</th>
                      <th className="text-left font-normal px-4 py-2">Technician</th>
                      <th className="text-left font-normal px-4 py-2">Parts</th>
                      <th className="text-left font-normal px-4 py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((r, i) => (
                      <tr key={`${r.id}-${i}`} className="border-t border-border">
                        <td className="px-4 py-2.5 font-mono text-muted-foreground whitespace-nowrap">{r.date}</td>
                        <td className="px-4 py-2.5 font-medium whitespace-nowrap">{r.part}</td>
                        <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{r.tech}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{r.parts}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{r.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </section>

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function SectionHead({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="flex items-center justify-between px-4 h-11 border-b border-border">
      <h2 className="text-[13px] font-semibold">{title}</h2>
      <span className="text-[10px] font-mono uppercase text-muted-foreground">{meta}</span>
    </div>
  );
}

function Kpi({
  icon: Icon, label, value, sub, trend, trendText,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  sub: string;
  trend: "up" | "down";
  trendText: string;
}) {
  const T = trend === "up" ? TrendingUp : TrendingDown;
  return (
    <div className="rounded-xl border border-border bg-surface-1 p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" strokeWidth={1.5} />
        <span className="text-[11px] uppercase font-mono tracking-wide">{label}</span>
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>
      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground border-t border-border pt-2.5">
        <T className="h-3.5 w-3.5" strokeWidth={1.5} />
        {trendText}
      </div>
    </div>
  );
}
