import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { History as HistoryIcon, Search, Wrench, User, Calendar, ArrowUpRight } from "lucide-react";
import { TopBar } from "@/components/copilot/TopBar";
import { LeftNav } from "@/components/copilot/LeftNav";
import { useEquipment } from "@/lib/equipment-store";

export const Route = createFileRoute("/history")({
  component: HistoryPage,
  head: () => ({
    meta: [
      { title: "Intervention History · OCP Maroc Copilot" },
      { name: "description", content: "Chronological maintenance log for pump P-104: interventions, technicians, parts replaced and field notes per component." },
      { property: "og:title", content: "Intervention History · OCP Maroc Copilot" },
      { property: "og:description", content: "Chronological maintenance log for pump P-104: interventions, technicians, parts replaced and field notes per component." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function HistoryPage() {
  const { list } = useEquipment();
  const [q, setQ] = React.useState("");
  const [comp, setComp] = React.useState("all");

  const entries = React.useMemo(
    () =>
      list
        .flatMap(c => (c.history ?? []).map(h => ({ ...h, comp: c.name, compId: c.id })))
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [list],
  );

  const filtered = entries.filter(e => {
    if (comp !== "all" && e.compId !== comp) return false;
    const t = `${e.comp} ${e.tech} ${e.parts} ${e.notes} ${e.date}`.toLowerCase();
    return !q || t.includes(q.toLowerCase());
  });

  const techs = new Set(entries.map(e => e.tech)).size;

  return (
    <div className="min-h-screen w-full flex flex-col bg-background text-foreground">
      <TopBar />
      <div className="flex-1 flex min-h-0">
        <LeftNav />
        <main className="flex-1 min-w-0 overflow-y-auto">
          <div className="p-5 space-y-4 max-w-[1400px]">
            <div>
              <h1 className="text-lg font-semibold flex items-center gap-2">
                <HistoryIcon className="h-4 w-4 text-cyan" strokeWidth={1.5} /> Intervention History
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {entries.length} recorded interventions · {techs} technicians
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                <input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="Search technician, part or note…"
                  className="w-full h-9 pl-9 pr-3 rounded-md bg-surface-2 border border-border text-sm focus:outline-none focus:border-border-strong"
                />
              </div>
              <select
                value={comp}
                onChange={e => setComp(e.target.value)}
                className="h-9 px-3 rounded-md bg-surface-2 border border-border text-sm focus:outline-none focus:border-border-strong"
              >
                <option value="all">All components</option>
                {list.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <ol className="relative border-l border-border ml-2 space-y-3 pl-5 py-1">
              {filtered.map((e, i) => (
                <li key={`${e.compId}-${i}`} className="relative">
                  <span className="absolute -left-[26px] top-3 h-2.5 w-2.5 rounded-full bg-cyan ring-4 ring-background" />
                  <div className="rounded-lg border border-border bg-surface-1 p-4">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5 font-mono">
                        <Calendar className="h-3.5 w-3.5" strokeWidth={1.5} /> {e.date}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" strokeWidth={1.5} /> {e.tech}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Wrench className="h-3.5 w-3.5" strokeWidth={1.5} /> {e.parts}
                      </span>
                      <Link
                        to="/equipment"
                        className="ml-auto inline-flex items-center gap-1 hover:text-foreground"
                      >
                        {e.comp} <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </div>
                    <p className="mt-2 text-sm">{e.notes}</p>
                  </div>
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="text-sm text-muted-foreground py-8">No interventions found.</li>
              )}
            </ol>
          </div>
        </main>
      </div>
    </div>
  );
}
