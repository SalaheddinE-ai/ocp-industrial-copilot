import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Search, FileText, Download, ExternalLink, Layers } from "lucide-react";
import { TopBar } from "@/components/copilot/TopBar";
import { LeftNav } from "@/components/copilot/LeftNav";
import { useEquipment } from "@/lib/equipment-store";

export const Route = createFileRoute("/manuals")({
  component: ManualLibrary,
  head: () => ({
    meta: [
      { title: "Manual Library · OCP Maroc Copilot" },
      { name: "description", content: "Searchable technical documentation library for pump P-104: manuals, drawings, datasheets and procedures attached to each component." },
      { property: "og:title", content: "Manual Library · OCP Maroc Copilot" },
      { property: "og:description", content: "Manuals, drawings, datasheets and procedures for every component of centrifugal pump P-104." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

interface Doc {
  name: string;
  type: string;
  size: string;
  url?: string;
  owner: string;
  ownerId: string;
}

function ManualLibrary() {
  const { list } = useEquipment();
  const [q, setQ] = React.useState("");
  const [type, setType] = React.useState("all");
  const [selected, setSelected] = React.useState<Doc | null>(null);

  const docs = React.useMemo<Doc[]>(
    () =>
      list.flatMap(c => {
        const attachments = c.attachments ?? [];
        const source = attachments.length > 0 ? attachments : (c.documents ?? []);
        return source.map(d => ({
          name: d.name,
          type: d.type,
          size: d.size,
          url: "url" in d ? (d as { url?: string }).url : undefined,
          owner: c.name,
          ownerId: c.id,
        }));
      }),
    [list],
  );

  const types = React.useMemo(() => ["all", ...new Set(docs.map(d => d.type))], [docs]);

  const filtered = docs.filter(d => {
    if (type !== "all" && d.type !== type) return false;
    if (!q) return true;
    return `${d.name} ${d.type} ${d.owner}`.toLowerCase().includes(q.toLowerCase());
  });

  return (
    <div className="min-h-screen w-full flex flex-col bg-background text-foreground">
      <TopBar />
      <div className="flex-1 flex min-h-0">
        <LeftNav />
        <main className="flex-1 min-w-0 flex min-h-0">
          <div className="flex-1 min-w-0 overflow-y-auto scrollbar-thin p-6">
            <div className="space-y-5">
              <header>
                <h1 className="text-xl font-semibold flex items-center gap-2">
                  <BookOpen className="h-5 w-5" strokeWidth={1.6} /> Manual library
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {docs.length} documents across {list.length} components — manuals, drawings, datasheets and field procedures.
                </p>
              </header>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  <input
                    value={q}
                    onChange={e => setQ(e.target.value)}
                    placeholder="Search documents, references, components…"
                    className="w-full h-10 pl-10 pr-3 rounded-lg bg-surface-2 border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:border-border-strong"
                  />
                </div>
                {types.map(t => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`text-xs px-3 py-2 rounded-md border transition-colors ${
                      type === t ? "border-border-strong bg-accent" : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t === "all" ? "All types" : t}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {filtered.length === 0 && (
                  <div className="col-span-full rounded-xl border border-border bg-surface-1 px-4 py-10 text-center text-sm text-muted-foreground">
                    No document matches this search.
                  </div>
                )}
                {filtered.map((d, i) => (
                  <button
                    key={`${d.ownerId}-${d.name}-${i}`}
                    onClick={() => setSelected(d)}
                    className={`text-left rounded-xl border bg-surface-1 p-4 flex gap-3 transition-colors ${
                      selected?.name === d.name && selected?.ownerId === d.ownerId
                        ? "border-border-strong"
                        : "border-border hover:border-border-strong"
                    }`}
                  >
                    <div className="h-9 w-9 rounded-md bg-surface-2 flex items-center justify-center shrink-0">
                      <FileText className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{d.name}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                        {d.type} · {d.size}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                        <Layers className="h-3 w-3" /> {d.owner}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <aside className="w-[340px] shrink-0 border-l border-border bg-surface-1 p-5 overflow-y-auto scrollbar-thin hidden lg:block">
            {!selected ? (
              <div className="text-sm text-muted-foreground">
                Select a document to see its metadata, source component and download options.
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="text-[10px] uppercase font-mono text-muted-foreground">Document</div>
                  <h2 className="text-base font-semibold mt-1 leading-snug">{selected.name}</h2>
                </div>
                <dl className="text-xs space-y-2">
                  <Row label="Type" value={selected.type} />
                  <Row label="Size" value={selected.size} />
                  <Row label="Component" value={selected.owner} />
                  <Row label="Source" value={selected.url ? (selected.url.startsWith("data:") ? "Uploaded file" : "External link") : "Reference only"} />
                </dl>
                <div className="flex flex-col gap-2 pt-1">
                  {selected.url && (
                    <a
                      href={selected.url}
                      download={selected.url.startsWith("data:") ? selected.name : undefined}
                      target={selected.url.startsWith("data:") ? undefined : "_blank"}
                      rel="noreferrer"
                      className="flex items-center justify-center gap-2 text-xs px-3 py-2 rounded-md border border-border-strong hover:bg-accent transition-colors"
                    >
                      {selected.url.startsWith("data:") ? <Download className="h-3.5 w-3.5" /> : <ExternalLink className="h-3.5 w-3.5" />}
                      {selected.url.startsWith("data:") ? "Download file" : "Open link"}
                    </a>
                  )}
                  <Link
                    to="/equipment"
                    className="flex items-center justify-center gap-2 text-xs px-3 py-2 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    Open component in explorer
                  </Link>
                  <Link
                    to="/assistant"
                    className="flex items-center justify-center gap-2 text-xs px-3 py-2 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    Ask the AI assistant about it
                  </Link>
                </div>
              </div>
            )}
          </aside>
        </main>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border pb-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
