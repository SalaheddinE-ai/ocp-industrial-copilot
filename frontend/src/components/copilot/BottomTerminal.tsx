import * as React from "react";
import { Terminal, ChevronUp, ChevronDown, Circle } from "lucide-react";

interface Props { selectedId: string | null; }

export function BottomTerminal({ selectedId }: Props) {
  const [open, setOpen] = React.useState(true);
  // Fixed on mount (client only) so SSR and hydration render identical text.
  const [baseTime, setBaseTime] = React.useState<number | null>(null);
  React.useEffect(() => { setBaseTime(Date.now()); }, []);
  const logs = React.useMemo(() => {
    const t = (s: number) =>
      baseTime === null ? "--:--:--" : new Date(baseTime - s * 1000).toISOString().substring(11, 19);
    const base = [
      { time: t(12), tag: "agent", text: "Router → industrial-copilot/v2.4" },
      { time: t(11), tag: "kb", text: "Loaded index: pump_P104 (2.1k chunks, 18 manuals)" },
      { time: t(9), tag: "context", text: "Attached: maintenance_history.csv (24 rows)" },
    ];
    if (selectedId) {
      base.push(
        { time: t(3), tag: "select", text: `component:${selectedId} — retrieving specs & procedures` },
        { time: t(2), tag: "retrieve", text: `top-5 docs: [manual.pdf, sop.pdf, drawing.pdf, datasheet.pdf, api682.pdf]` },
        { time: t(1), tag: "reason", text: "Composing structured response · 1.2s" },
        { time: t(0), tag: "ok", text: "Response ready · tokens=482 · latency=940ms" },
      );
    }
    return base;
  }, [selectedId, baseTime]);

  return (
    <div className="shrink-0 border-t border-border bg-surface-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Terminal className="h-3.5 w-3.5" strokeWidth={1.5} />
        <span className="font-medium">Copilot Trace</span>
        <span className="text-[10px] font-mono text-muted-foreground/70">· {logs.length} events</span>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Circle className="h-2 w-2 fill-[color:var(--success)] text-[color:var(--success)]" />
            <span className="font-mono text-[10px]">agent · industrial-copilot</span>
          </div>
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </div>
      </button>
      {open && (
        <div className="max-h-[180px] overflow-y-auto scrollbar-thin border-t border-border bg-[oklch(0.14_0.005_260)] font-mono text-[11px] leading-relaxed">
          {logs.map((l, i) => (
            <div key={i} className="flex gap-3 px-4 py-1 hover:bg-surface-2/30">
              <span className="text-muted-foreground/60 w-16 shrink-0">{l.time}</span>
              <span className={`w-16 shrink-0 uppercase ${tagColor(l.tag)}`}>{l.tag}</span>
              <span className="text-foreground/85">{l.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function tagColor(tag: string) {
  if (tag === "ok") return "text-[color:var(--success)]";
  if (tag === "select" || tag === "reason") return "text-[color:var(--cyan)]";
  if (tag === "kb" || tag === "retrieve") return "text-[color:var(--warning)]";
  return "text-muted-foreground";
}
