import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Search, LayoutGrid, List, Boxes, Wrench, Clock, Package, FileText,
  ShieldAlert, ArrowUpRight, Filter, Plus, Pencil, Trash2, Download, ExternalLink,
} from "lucide-react";
import { TopBar } from "@/components/copilot/TopBar";
import { LeftNav } from "@/components/copilot/LeftNav";
import { EquipmentForm } from "@/components/copilot/EquipmentForm";
import { useEquipment, type Equipment } from "@/lib/equipment-store";
import type { Status } from "@/lib/pump-data";

export const Route = createFileRoute("/equipment")({
  component: EquipmentExplorer,
  head: () => ({
    meta: [
      { title: "Equipment Explorer · OCP Maroc Industrial Copilot" },
      { name: "description", content: "Create, edit and inspect pump components — specs, failure modes, spare parts and attached manuals or procedures." },
      { property: "og:title", content: "Equipment Explorer · OCP Maroc Industrial Copilot" },
      { property: "og:description", content: "Create, edit and inspect pump components — specs, failure modes, spare parts and attached manuals or procedures." },
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

const FILTERS = ["all", "critical", "warning", "healthy"] as const;
type FilterKey = (typeof FILTERS)[number];

function EquipmentExplorer() {
  const { list, save, remove, exists } = useEquipment();
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<FilterKey>("all");
  const [view, setView] = React.useState<"grid" | "list">("grid");
  const [selectedId, setSelectedId] = React.useState<string>(list[0]?.id ?? "");
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Equipment | null>(null);

  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter(c => {
      if (filter !== "all" && c.status !== filter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.material.toLowerCase().includes(q) ||
        c.function.toLowerCase().includes(q) ||
        c.manufacturer.toLowerCase().includes(q)
      );
    });
  }, [query, filter, list]);

  const selected = list.find(c => c.id === selectedId) ?? list[0] ?? null;

  const handleSubmit = (item: Equipment) => {
    const ok = save(item);
    if (!ok) {
      toast.error("Storage full — remove some uploaded files and try again.");
      return;
    }
    setSelectedId(item.id);
    setFormOpen(false);
    toast.success(editing ? `${item.name} updated` : `${item.name} created`);
  };

  const handleDelete = (item: Equipment) => {
    if (!window.confirm(`Delete "${item.name}" from the equipment registry?`)) return;
    remove(item.id);
    setSelectedId("");
    toast.success(`${item.name} deleted`);
  };

  return (
    <div className="min-h-screen lg:h-screen w-full flex flex-col bg-background text-foreground lg:overflow-hidden">
      <TopBar />
      <div className="flex-1 flex min-h-0">
        <LeftNav />
        <main className="flex-1 min-w-0 flex flex-col">
          {/* Header + controls */}
          <div className="shrink-0 px-5 pt-5 pb-3 space-y-3">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Equipment Explorer</h1>
                <p className="text-[13px] text-muted-foreground mt-0.5">
                  Pump P-104 · {list.length} monitored components · Line 3, Jorf Lasfar
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setEditing(null); setFormOpen(true); }}
                  className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition-colors"
                >
                  <Plus className="h-4 w-4" strokeWidth={1.5} />
                  New component
                </button>
                <Link
                  to="/twin"
                  className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg border border-border bg-surface-2 hover:border-border-strong text-sm transition-colors"
                >
                  Open Digital Twin
                  <ArrowUpRight className="h-4 w-4" strokeWidth={1.5} />
                </Link>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Filter by name, material, manufacturer…"
                  className="w-full h-9 pl-9 pr-3 rounded-lg bg-surface-2 border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:border-border-strong transition-colors"
                />
              </div>

              <div className="flex items-center gap-1 p-0.5 rounded-lg border border-border bg-surface-2">
                <Filter className="h-3.5 w-3.5 text-muted-foreground mx-1.5" strokeWidth={1.5} />
                {FILTERS.map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`h-7 px-2.5 rounded-md text-[11px] font-mono uppercase transition-colors ${
                      filter === f ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <div className="ml-auto flex items-center gap-1 p-0.5 rounded-lg border border-border bg-surface-2">
                <button
                  onClick={() => setView("grid")}
                  title="Grid view"
                  className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors ${
                    view === "grid" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
                <button
                  onClick={() => setView("list")}
                  title="List view"
                  className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors ${
                    view === "list" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <List className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 px-4 sm:px-5 pb-5">
            <div className="lg:col-span-8 min-h-0 lg:overflow-y-auto pr-1">
              {results.length === 0 && (
                <div className="h-40 flex items-center justify-center text-sm text-muted-foreground border border-dashed border-border rounded-xl">
                  No component matches “{query}”.
                </div>
              )}

              {view === "grid" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-3">
                  {results.map(c => (
                    <CardItem key={c.id} c={c} active={c.id === selected?.id} onClick={() => setSelectedId(c.id)} />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-border overflow-hidden">
                  {results.map(c => {
                    const s = STATUS_STYLE[c.status];
                    return (
                      <button
                        key={c.id}
                        onClick={() => setSelectedId(c.id)}
                        className={`w-full text-left px-4 py-2.5 flex items-center gap-3 border-b border-border last:border-b-0 transition-colors ${
                          c.id === selected?.id ? "bg-accent" : "bg-surface-1 hover:bg-accent/50"
                        }`}
                      >
                        <span className={`h-2 w-2 rounded-full shrink-0 ${s.dot}`} />
                        <span className="text-[13px] font-medium w-48 truncate">{c.name}</span>
                        <span className="text-[11px] text-muted-foreground truncate flex-1">{c.material}</span>
                        <span className="text-[10px] font-mono text-muted-foreground">{c.dimensions}</span>
                        <span className={`text-[10px] font-mono uppercase w-16 text-right ${s.text}`}>{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Detail */}
            <aside className="lg:col-span-4 min-h-0 lg:overflow-y-auto rounded-xl border border-border bg-surface-1 overflow-y-auto">
              {selected && (
                <Detail
                  c={selected}
                  onEdit={() => { setEditing(selected); setFormOpen(true); }}
                  onDelete={() => handleDelete(selected)}
                />
              )}
            </aside>
          </div>
        </main>
      </div>

      <EquipmentForm
        open={formOpen}
        initial={editing}
        idTaken={exists}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

function CardItem({ c, active, onClick }: { c: Equipment; active: boolean; onClick: () => void }) {
  const s = STATUS_STYLE[c.status];
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl border p-3.5 transition-colors ${
        active ? "border-border-strong bg-accent" : "border-border bg-surface-1 hover:bg-accent/50"
      }`}
    >
      <div className="flex items-center gap-2">
        <Boxes className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
        <span className={`ml-auto text-[10px] font-mono uppercase ${s.text}`}>{s.label}</span>
        <span className={`h-2 w-2 rounded-full ${s.dot}`} />
      </div>
      <div className="mt-2.5 text-[13px] font-medium">{c.name}</div>
      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{c.function}</p>
      <div className="mt-3 pt-2.5 border-t border-border grid grid-cols-2 gap-1 text-[10px] font-mono text-muted-foreground">
        <span className="truncate">{c.dimensions}</span>
        <span className="truncate text-right">{c.lifeExpectancy}</span>
      </div>
    </button>
  );
}

function Detail({ c, onEdit, onDelete }: { c: Equipment; onEdit: () => void; onDelete: () => void }) {
  const s = STATUS_STYLE[c.status];
  const attachments = c.attachments ?? c.documents.map(d => ({ ...d, dataUrl: undefined, url: undefined }));
  return (
    <div>
      <div className="px-4 h-11 border-b border-border flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold truncate">{c.name}</h2>
        <div className="flex items-center gap-1">
          <span className={`text-[10px] font-mono uppercase mr-1 ${s.text}`}>{s.label}</span>
          <button onClick={onEdit} title="Edit component" className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
          <button onClick={onDelete} title="Delete component" className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-[color:var(--critical,#ef4444)] hover:bg-accent transition-colors">
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>
      <div className="p-4 space-y-4">
        <p className="text-[12px] text-muted-foreground leading-relaxed">{c.description}</p>

        <dl className="grid grid-cols-2 gap-y-2 gap-x-3 text-[11px]">
          <Spec k="Material" v={c.material} />
          <Spec k="Dimensions" v={c.dimensions} />
          <Spec k="Manufacturer" v={c.manufacturer} />
          <Spec k="Life expectancy" v={c.lifeExpectancy} />
        </dl>

        <Block icon={ShieldAlert} title="Failure modes">
          <ul className="space-y-1">
            {c.failureModes.map(f => (
              <li key={f} className="text-[11px] text-muted-foreground flex gap-2">
                <span className="text-muted-foreground/50">—</span>{f}
              </li>
            ))}
          </ul>
        </Block>

        <Block icon={Wrench} title="Maintenance">
          <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground mb-1.5">
            <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{c.maintenance.time}</span>
            <span>{c.maintenance.difficulty} effort</span>
            <span className="truncate">{c.maintenance.torque}</span>
          </div>
          <ol className="space-y-1">
            {c.maintenance.steps.map((st, i) => (
              <li key={st + i} className="text-[11px] text-muted-foreground flex gap-2">
                <span className="font-mono text-muted-foreground/60">{String(i + 1).padStart(2, "0")}</span>{st}
              </li>
            ))}
          </ol>
        </Block>

        <Block icon={Package} title="Spare parts">
          <ul className="space-y-1.5">
            {c.parts.map(p => (
              <li key={p.ref} className="flex items-center gap-2 text-[11px]">
                <span className="truncate flex-1">{p.name}</span>
                <span className="font-mono text-muted-foreground">{p.ref}</span>
                <span className={`font-mono ${p.stock === 0 ? "text-[color:var(--critical,#ef4444)]" : "text-muted-foreground"}`}>
                  ×{p.stock}
                </span>
              </li>
            ))}
            {c.parts.length === 0 && <li className="text-[11px] text-muted-foreground">No spare parts listed.</li>}
          </ul>
        </Block>

        <Block icon={FileText} title="Manuals & procedures">
          <ul className="space-y-1.5">
            {attachments.map((d, i) => (
              <li key={d.name + i} className="flex items-center gap-2 text-[11px]">
                <span className="truncate flex-1">{d.name}</span>
                <span className="font-mono text-muted-foreground text-[10px]">{d.type}</span>
                {d.dataUrl ? (
                  <a href={d.dataUrl} download={d.name} title="Download" className="text-muted-foreground hover:text-foreground">
                    <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </a>
                ) : d.url ? (
                  <a href={d.url} target="_blank" rel="noreferrer" title="Open link" className="text-muted-foreground hover:text-foreground">
                    <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </a>
                ) : (
                  <span className="font-mono text-muted-foreground text-[10px]">{d.size}</span>
                )}
              </li>
            ))}
            {attachments.length === 0 && <li className="text-[11px] text-muted-foreground">No documents attached.</li>}
          </ul>
        </Block>

        <Link
          to="/twin"
          className="w-full inline-flex items-center justify-center gap-2 h-9 rounded-lg border border-border bg-surface-2 hover:border-border-strong text-[12px] transition-colors"
        >
          Inspect in 3D
          <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
        </Link>
      </div>
    </div>
  );
}

function Spec({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[10px] font-mono uppercase text-muted-foreground">{k}</dt>
      <dd className="mt-0.5">{v}</dd>
    </div>
  );
}

function Block({ icon: Icon, title, children }: { icon: typeof Wrench; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface-2 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
        <h3 className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground">{title}</h3>
      </div>
      {children}
    </section>
  );
}
