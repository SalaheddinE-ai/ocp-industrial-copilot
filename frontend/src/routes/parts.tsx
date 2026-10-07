import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Package, Search, AlertTriangle, PackageCheck, PackageX, ArrowUpRight } from "lucide-react";
import { TopBar } from "@/components/copilot/TopBar";
import { LeftNav } from "@/components/copilot/LeftNav";
import { useEquipment } from "@/lib/equipment-store";

export const Route = createFileRoute("/parts")({
  component: SpareParts,
  head: () => ({
    meta: [
      { title: "Spare Parts Inventory · OCP Maroc Copilot" },
      { name: "description", content: "Searchable spare parts inventory for centrifugal pump P-104: stock levels, references and the components each part belongs to." },
      { property: "og:title", content: "Spare Parts Inventory · OCP Maroc Copilot" },
      { property: "og:description", content: "Searchable spare parts inventory for centrifugal pump P-104: stock levels, references and the components each part belongs to." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Row = { name: string; ref: string; stock: number; owner: string; ownerId: string };

function level(stock: number) {
  if (stock === 0) return { label: "Out of stock", cls: "text-critical", dot: "bg-critical" };
  if (stock <= 2) return { label: "Low", cls: "text-warning", dot: "bg-warning" };
  return { label: "In stock", cls: "text-success", dot: "bg-success" };
}

function SpareParts() {
  const { list } = useEquipment();
  const [q, setQ] = React.useState("");
  const [filter, setFilter] = React.useState<"all" | "low" | "out">("all");

  const rows = React.useMemo<Row[]>(
    () =>
      list.flatMap(c =>
        (c.parts ?? []).map(p => ({ ...p, owner: c.name, ownerId: c.id })),
      ),
    [list],
  );

  const filtered = rows.filter(r => {
    const t = `${r.name} ${r.ref} ${r.owner}`.toLowerCase();
    if (q && !t.includes(q.toLowerCase())) return false;
    if (filter === "low") return r.stock > 0 && r.stock <= 2;
    if (filter === "out") return r.stock === 0;
    return true;
  });

  const totals = {
    all: rows.length,
    units: rows.reduce((s, r) => s + r.stock, 0),
    low: rows.filter(r => r.stock > 0 && r.stock <= 2).length,
    out: rows.filter(r => r.stock === 0).length,
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-background text-foreground">
      <TopBar />
      <div className="flex-1 flex min-h-0">
        <LeftNav />
        <main className="flex-1 min-w-0 overflow-y-auto">
          <div className="p-5 space-y-4 max-w-[1600px]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-lg font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4 text-cyan" strokeWidth={1.5} /> Spare Parts
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Consolidated inventory across {list.length} monitored components.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              <Stat icon={Package} label="Distinct references" value={String(totals.all)} />
              <Stat icon={PackageCheck} label="Units on hand" value={String(totals.units)} />
              <Stat icon={AlertTriangle} label="Low stock" value={String(totals.low)} tone="text-warning" />
              <Stat icon={PackageX} label="Out of stock" value={String(totals.out)} tone="text-critical" />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                <input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="Search part, reference or component…"
                  className="w-full h-9 pl-9 pr-3 rounded-md bg-surface-2 border border-border text-sm focus:outline-none focus:border-border-strong"
                />
              </div>
              {(["all", "low", "out"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`h-9 px-3 rounded-md text-xs border transition-colors ${
                    filter === f
                      ? "border-border-strong bg-surface-3 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f === "all" ? "All" : f === "low" ? "Low stock" : "Out of stock"}
                </button>
              ))}
            </div>

            <div className="rounded-lg border border-border bg-surface-1 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-surface-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-4 py-2">Part</th>
                    <th className="text-left font-medium px-4 py-2">Reference</th>
                    <th className="text-left font-medium px-4 py-2">Component</th>
                    <th className="text-right font-medium px-4 py-2">Stock</th>
                    <th className="text-left font-medium px-4 py-2">Status</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => {
                    const l = level(r.stock);
                    return (
                      <tr key={`${r.ref}-${i}`} className="border-t border-border hover:bg-accent/40">
                        <td className="px-4 py-2.5">{r.name}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{r.ref}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{r.owner}</td>
                        <td className="px-4 py-2.5 text-right font-mono">{r.stock}</td>
                        <td className={`px-4 py-2.5 ${l.cls}`}>
                          <span className="inline-flex items-center gap-1.5 text-xs">
                            <span className={`h-1.5 w-1.5 rounded-full ${l.dot}`} />
                            {l.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <Link
                            to="/equipment"
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                          >
                            Open <ArrowUpRight className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                        No parts match your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone = "text-foreground",
}: {
  icon: typeof Package;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-1 p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
        {label}
      </div>
      <div className={`mt-2 text-2xl font-semibold ${tone}`}>{value}</div>
    </div>
  );
}
