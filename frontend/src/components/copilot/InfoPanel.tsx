import * as React from "react";
import { MousePointerClick, AlertTriangle, Wrench, ShieldAlert, Package, FileText, Clock, CheckCircle2, ClipboardCheck } from "lucide-react";
import type { Component, Status } from "@/lib/pump-data";

interface Props { component: Component | null; }

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "inspection", label: "Inspection" },
  { id: "maintenance", label: "Maintenance" },
  { id: "safety", label: "Safety" },
  { id: "parts", label: "Spare Parts" },
  { id: "documents", label: "Documents" },
  { id: "history", label: "History" },
] as const;

type TabId = typeof TABS[number]["id"];

export function InfoPanel({ component }: Props) {
  const [tab, setTab] = React.useState<TabId>("overview");
  React.useEffect(() => { setTab("overview"); }, [component?.id]);

  if (!component) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-surface-1 border border-border rounded-xl p-8 text-center">
        <div className="h-14 w-14 rounded-full border border-border flex items-center justify-center mb-4">
          <MousePointerClick className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
        </div>
        <h3 className="text-sm font-semibold">Select a component</h3>
        <p className="text-xs text-muted-foreground mt-1.5 max-w-[220px]">
          Click any part in the 3D viewer to inspect its specifications, procedures and history.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-surface-1 border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-mono uppercase text-muted-foreground mb-0.5">
              {component.id} · Pump P-104
            </div>
            <h2 className="text-lg font-semibold tracking-tight">{component.name}</h2>
          </div>
          <StatusBadge status={component.status} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 px-2 pt-2 border-b border-border overflow-x-auto scrollbar-thin">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-xs rounded-md transition-colors whitespace-nowrap ${
              tab === t.id
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 text-sm">
        {tab === "overview" && <OverviewTab c={component} />}
        {tab === "inspection" && <InspectionTab c={component} />}
        {tab === "maintenance" && <MaintenanceTab c={component} />}
        {tab === "safety" && <SafetyTab c={component} />}
        {tab === "parts" && <PartsTab c={component} />}
        {tab === "documents" && <DocumentsTab c={component} />}
        {tab === "history" && <HistoryTab c={component} />}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const map = {
    healthy: { label: "Healthy", color: "var(--success)", icon: CheckCircle2 },
    warning: { label: "Warning", color: "var(--warning)", icon: AlertTriangle },
    critical: { label: "Critical", color: "var(--critical)", icon: ShieldAlert },
  } as const;
  const s = map[status];
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border text-[11px] font-medium">
      <s.icon className="h-3 w-3" style={{ color: s.color }} strokeWidth={2} />
      <span style={{ color: s.color }}>{s.label}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">{title}</h4>
      {children}
    </section>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-border last:border-0">
      <span className="text-xs text-muted-foreground">{k}</span>
      <span className="text-xs text-right font-medium">{v}</span>
    </div>
  );
}

function OverviewTab({ c }: { c: Component }) {
  return (
    <>
      <Section title="Function">
        <p className="text-sm leading-relaxed">{c.function}</p>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{c.description}</p>
      </Section>
      <Section title="Operating Principle">
        <p className="text-xs text-muted-foreground leading-relaxed">{c.principle}</p>
      </Section>
      <Section title="Specifications">
        <div className="rounded-lg border border-border px-3">
          <KV k="Material" v={c.material} />
          <KV k="Dimensions" v={c.dimensions} />
          <KV k="Manufacturer" v={c.manufacturer} />
          <KV k="Life expectancy" v={c.lifeExpectancy} />
        </div>
      </Section>
      <Section title="Failure Modes">
        <div className="flex flex-wrap gap-1.5">
          {c.failureModes.map(f => (
            <span key={f} className="text-[11px] px-2 py-1 rounded-md border border-border bg-surface-2 text-muted-foreground">{f}</span>
          ))}
        </div>
      </Section>
      <Section title="Common Symptoms">
        <ul className="space-y-1">
          {c.symptoms.map(s => (
            <li key={s} className="flex items-start gap-2 text-xs">
              <span className="mt-1 h-1 w-1 rounded-full bg-[color:var(--warning)]" />
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Possible Causes">
        <ul className="space-y-1">
          {c.causes.map(s => (
            <li key={s} className="flex items-start gap-2 text-xs text-muted-foreground">
              <span className="mt-1 h-1 w-1 rounded-full bg-border-strong" />
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

function InspectionTab({ c }: { c: Component }) {
  return (
    <>
      <Section title="Checklist">
        <div className="space-y-2">
          {c.inspection.checklist.map((s, i) => (
            <label key={i} className="flex items-center gap-2.5 p-2 rounded-md border border-border hover:bg-accent/60 cursor-pointer">
              <div className="h-4 w-4 rounded border border-border-strong flex items-center justify-center" />
              <span className="text-xs">{s}</span>
            </label>
          ))}
        </div>
      </Section>
      <Section title="Required Tools">
        <div className="flex flex-wrap gap-1.5">
          {c.inspection.tools.map(t => (
            <span key={t} className="text-[11px] px-2 py-1 rounded-md border border-border">{t}</span>
          ))}
        </div>
      </Section>
      <Section title="Tolerances">
        <div className="p-3 rounded-lg border border-border bg-surface-2 font-mono text-xs">
          {c.inspection.tolerances}
        </div>
      </Section>
    </>
  );
}

function MaintenanceTab({ c }: { c: Component }) {
  const [step, setStep] = React.useState(0);
  const pct = (step / (c.maintenance.steps.length - 1)) * 100;
  return (
    <>
      <div className="grid grid-cols-3 gap-2 mb-5">
        <Stat label="Time" value={c.maintenance.time} icon={Clock} />
        <Stat label="Difficulty" value={c.maintenance.difficulty} icon={Wrench} />
        <Stat label="Torque" value={c.maintenance.torque} icon={ClipboardCheck} mono />
      </div>
      <Section title="Required PPE">
        <div className="flex flex-wrap gap-1.5">
          {c.maintenance.ppe.map(p => (
            <span key={p} className="text-[11px] px-2 py-1 rounded-md border border-border bg-surface-2">{p}</span>
          ))}
        </div>
      </Section>
      <Section title={`Procedure · ${step + 1}/${c.maintenance.steps.length}`}>
        <div className="h-1 rounded-full bg-surface-3 overflow-hidden mb-3">
          <div className="h-full bg-foreground transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        <ol className="space-y-1.5">
          {c.maintenance.steps.map((s, i) => (
            <li
              key={i}
              onClick={() => setStep(i)}
              className={`flex items-start gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                i === step ? "bg-accent" : "hover:bg-accent/50"
              }`}
            >
              <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-mono shrink-0 ${
                i <= step ? "bg-foreground text-background" : "border border-border text-muted-foreground"
              }`}>{i + 1}</span>
              <span className={`text-xs leading-relaxed ${i === step ? "text-foreground" : "text-muted-foreground"}`}>{s}</span>
            </li>
          ))}
        </ol>
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => setStep(s => Math.max(0, s - 1))}
            className="flex-1 h-8 rounded-md border border-border text-xs hover:bg-accent transition-colors"
          >Previous</button>
          <button
            onClick={() => setStep(s => Math.min(c.maintenance.steps.length - 1, s + 1))}
            className="flex-1 h-8 rounded-md bg-foreground text-background text-xs font-medium hover:opacity-90 transition-opacity"
          >Next step</button>
        </div>
      </Section>
    </>
  );
}

function Stat({ label, value, icon: Icon, mono }: { label: string; value: string; icon: typeof Clock; mono?: boolean }) {
  return (
    <div className="p-2.5 rounded-lg border border-border bg-surface-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase text-muted-foreground tracking-wider">
        <Icon className="h-3 w-3" strokeWidth={1.5} />
        {label}
      </div>
      <div className={`mt-1 text-sm font-semibold ${mono ? "font-mono text-xs" : ""}`}>{value}</div>
    </div>
  );
}

function SafetyTab({ c }: { c: Component }) {
  return (
    <>
      <div className="p-3 mb-4 rounded-lg border border-[color:var(--warning)]/40 bg-[color:var(--warning)]/5 flex gap-2.5">
        <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "var(--warning)" }} strokeWidth={1.5} />
        <div className="text-xs">
          <div className="font-semibold text-foreground mb-0.5">Lockout / Tagout required</div>
          <div className="text-muted-foreground">Perform full LOTO before any intervention.</div>
        </div>
      </div>
      <Section title="LOTO Procedure">
        <ol className="space-y-1.5">
          {c.safety.loto.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-xs">
              <span className="h-4 w-4 rounded-full border border-border-strong flex items-center justify-center text-[9px] font-mono">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </Section>
      <Section title="Hazards">
        <div className="flex flex-wrap gap-1.5">
          {c.safety.hazards.map(h => (
            <span key={h} className="text-[11px] px-2 py-1 rounded-md border border-[color:var(--critical)]/40 text-[color:var(--critical)] bg-[color:var(--critical)]/5">{h}</span>
          ))}
        </div>
      </Section>
      <Section title="Safety Equipment">
        <div className="flex flex-wrap gap-1.5">
          {c.safety.equipment.map(e => (
            <span key={e} className="text-[11px] px-2 py-1 rounded-md border border-border bg-surface-2">{e}</span>
          ))}
        </div>
      </Section>
    </>
  );
}

function PartsTab({ c }: { c: Component }) {
  return (
    <>
      <Section title="Compatible parts">
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-surface-2 text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Part</th>
                <th className="text-left px-3 py-2 font-medium font-mono">Ref</th>
                <th className="text-right px-3 py-2 font-medium">Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {c.parts.map(p => (
                <tr key={p.ref} className="hover:bg-accent/40 transition-colors">
                  <td className="px-3 py-2.5 flex items-center gap-2">
                    <Package className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                    {p.name}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-muted-foreground">{p.ref}</td>
                  <td className="px-3 py-2.5 text-right">
                    <span className={`inline-flex px-1.5 py-0.5 rounded font-mono text-[10px] ${
                      p.stock < 3 ? "bg-[color:var(--critical)]/15 text-[color:var(--critical)]" :
                      p.stock < 6 ? "bg-[color:var(--warning)]/15 text-[color:var(--warning)]" :
                      "bg-[color:var(--success)]/15 text-[color:var(--success)]"
                    }`}>{p.stock} pcs</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Section title="Recommended supplier">
        <div className="p-3 rounded-lg border border-border bg-surface-2">
          <div className="text-sm font-medium">{c.manufacturer}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Lead time · 2–3 weeks · Casablanca warehouse</div>
        </div>
      </Section>
    </>
  );
}

function DocumentsTab({ c }: { c: Component }) {
  return (
    <div className="space-y-2">
      {c.documents.map(d => (
        <div key={d.name} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-border-strong hover:bg-accent/40 cursor-pointer transition-colors">
          <div className="h-9 w-9 rounded-md bg-surface-2 flex items-center justify-center">
            <FileText className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{d.name}</div>
            <div className="text-[11px] text-muted-foreground">{d.type} · {d.size}</div>
          </div>
          <button className="text-[11px] px-2 py-1 rounded-md border border-border hover:bg-accent">Open</button>
        </div>
      ))}
      {c.documents.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-8">No documents linked.</p>
      )}
    </div>
  );
}

function HistoryTab({ c }: { c: Component }) {
  if (c.history.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-8">No prior interventions recorded.</p>;
  }
  return (
    <div className="relative pl-4">
      <div className="absolute left-[7px] top-1 bottom-1 w-px bg-border" />
      {c.history.map((h, i) => (
        <div key={i} className="relative mb-4 last:mb-0">
          <div className="absolute -left-[13px] top-1.5 h-2.5 w-2.5 rounded-full bg-foreground ring-4 ring-surface-1" />
          <div className="text-[11px] font-mono text-muted-foreground">{h.date}</div>
          <div className="text-sm font-medium mt-0.5">{h.parts}</div>
          <div className="text-xs text-muted-foreground mt-0.5">by {h.tech}</div>
          <div className="text-xs mt-1.5 p-2 rounded-md border border-border bg-surface-2">{h.notes}</div>
        </div>
      ))}
    </div>
  );
}
