import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardList, Search, Download, Wrench, Calendar, User2 } from "lucide-react";
import { TopBar } from "@/components/copilot/TopBar";
import { LeftNav } from "@/components/copilot/LeftNav";
import { useEquipment } from "@/lib/equipment-store";

export const Route = createFileRoute("/reports")({
  component: Reports,
  head: () => ({
    meta: [
      { title: "Maintenance Reports · OCP Maroc Copilot" },
      { name: "description", content: "Maintenance report register for pump P-104: interventions by component and technician, parts consumed, findings and CSV export." },
      { property: "og:title", content: "Maintenance Reports · OCP Maroc Copilot" },
      { property: "og:description", content: "Intervention reports for pump P-104 with technician, parts consumed, findings and CSV export." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

interface Report {
  id: string;
  date: string;
  tech: string;
  parts: string;
  notes: string;
  owner: string;
  ownerId: string;
  difficulty: string;
  time: string;
}

function Reports() {
  const { list } = useEquipment();
  const [q, setQ] = React.useState("");
  const [tech, setTech] = React.useState("all");
  const [open, setOpen] = React.useState<string | null>(null);

  const reports = React.useMemo<Report[]>(
    () =>
      list
        .flatMap(c =>
          (c.history ?? []).map((h, i) => ({
            id: `${c.id}-${i}`,
            date: h.date,
            tech: h.tech,
            parts: h.parts,
            notes: h.notes,
            owner: c.name,
            ownerId: c.id,
            difficulty: c.maintenance?.difficulty ?? "Medium",
            time: c.maintenance?.time ?? "—",
          })),
        )
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [list],
  );

  const techs = React.useMemo(() => ["all", ...new Set(reports.map(r => r.tech))], [reports]);

  const filtered = reports.filter(r => {
    if (tech !== "all" && r.tech !== tech) return false;
    if (!q) return true;
    return `${r.owner} ${r.tech} ${r.parts} ${r.notes} ${r.date}`.toLowerCase().includes(q.toLowerCase());
  });

  const exportCsv = () => {
    const header = "date,component,technician,parts,difficulty,duration,notes";
    const rows = filtered.map(r =>
      [r.date, r.owner, r.tech, r.parts, r.difficulty, r.time, r.notes]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `p104-maintenance-reports-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const kpis = [
    { label: "Reports", value: reports.length },
    { label: "Components covered", value: new Set(reports.map(r => r.ownerId)).size },
    { label: "Technicians", value: new Set(reports.map(r => r.tech)).size },
    { label: "High-difficulty jobs", value: reports.filter(r => r.difficulty === "High").length },
  ];

  return (
    <div className="min-h-screen w-full flex flex-col bg-background text-foreground">
      <TopBar />
      <div className="flex-1 flex min-h-0">
        <LeftNav />
        <main className="flex-1 min-w-0 overflow-y-auto scrollbar-thin p-6">
          <div className="max-w-6xl mx-auto space-y-5">
            <header className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" strokeWidth={1.6} /> Maintenance reports
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Every intervention logged on pump P-104, consolidated from the component history registers.
                </p>
              </div>
              <button
                onClick={exportCsv}
                className="flex items-center gap-2 text-xs px-3 py-2 rounded-md border border-border-strong hover:bg-accent transition-colors"
              >
                <Download className="h-3.5 w-3.5" /> Export CSV
              </button>
            </header>

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              {kpis.map(k => (
                <div key={k.label} className="rounded-xl border border-border bg-surface-1 p-4">
                  <div className="text-[11px] uppercase font-mono text-muted-foreground">{k.label}</div>
                  <div className="text-2xl font-semibold mt-1">{k.value}</div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                <input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="Search reports by component, part, finding…"
                  className="w-full h-10 pl-10 pr-3 rounded-lg bg-surface-2 border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:border-border-strong"
                />
              </div>
              <select
                value={tech}
                onChange={e => setTech(e.target.value)}
                className="h-10 rounded-lg bg-surface-2 border border-border text-xs px-3 focus:outline-none focus:border-border-strong"
              >
                {techs.map(t => (
                  <option key={t} value={t}>{t === "all" ? "All technicians" : t}</option>
                ))}
              </select>
            </div>

            <div className="rounded-xl border border-border bg-surface-1 divide-y divide-border overflow-hidden">
              {filtered.length === 0 && (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">No report matches this filter.</div>
              )}
              {filtered.map(r => (
                <div key={r.id}>
                  <button
                    onClick={() => setOpen(open === r.id ? null : r.id)}
                    className="w-full text-left px-4 py-3 flex items-center gap-4 hover:bg-accent/40 transition-colors"
                  >
                    <span className="font-mono text-xs text-muted-foreground w-24 shrink-0">{r.date}</span>
                    <span className="text-sm font-medium flex-1 min-w-0 truncate">{r.owner}</span>
                    <span className="text-xs text-muted-foreground hidden md:flex items-center gap-1.5 w-40 truncate">
                      <User2 className="h-3 w-3" /> {r.tech}
                    </span>
                    <span
                      className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border ${
                        r.difficulty === "High"
                          ? "border-critical/40 text-critical"
                          : r.difficulty === "Medium"
                            ? "border-warning/40 text-warning"
                            : "border-border text-muted-foreground"
                      }`}
                    >
                      {r.difficulty}
                    </span>
                  </button>
                  {open === r.id && (
                    <div className="px-4 pb-4 pt-1 grid md:grid-cols-3 gap-4 bg-surface-2/40">
                      <Detail icon={Wrench} label="Parts consumed" value={r.parts || "None"} />
                      <Detail icon={Calendar} label="Standard duration" value={r.time} />
                      <Detail icon={User2} label="Technician" value={r.tech} />
                      <div className="md:col-span-3">
                        <div className="text-[10px] uppercase font-mono text-muted-foreground">Findings</div>
                        <p className="text-sm mt-1 leading-relaxed">{r.notes}</p>
                      </div>
                      <div className="md:col-span-3 flex gap-2">
                        <Link
                          to="/equipment"
                          className="text-[11px] px-2.5 py-1.5 rounded-md border border-border hover:bg-accent"
                        >
                          Open component
                        </Link>
                        <Link
                          to="/assistant"
                          className="text-[11px] px-2.5 py-1.5 rounded-md border border-border hover:bg-accent"
                        >
                          Analyse with AI
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function Detail({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase font-mono text-muted-foreground flex items-center gap-1.5">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="text-sm mt-1">{value}</div>
    </div>
  );
}
