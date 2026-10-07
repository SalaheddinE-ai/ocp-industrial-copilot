import * as React from "react";
import { MessageSquarePlus, Trash2, ChevronRight, Search, History } from "lucide-react";
import { formatWhen, type Conversation } from "@/lib/conversations";

interface Props {
  conversations: Conversation[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

export function ConversationSidebar({ conversations, activeId, onSelect, onNew, onDelete }: Props) {
  const [query, setQuery] = React.useState("");
  const [expanded, setExpanded] = React.useState<string | null>(activeId);

  React.useEffect(() => setExpanded(activeId), [activeId]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      c => c.title.toLowerCase().includes(q) || c.messages.some(m => m.content.toLowerCase().includes(q)),
    );
  }, [conversations, query]);

  return (
    <aside className="hidden xl:flex w-[280px] shrink-0 border-r border-border bg-surface-1 flex-col min-h-0">
      <div className="px-3 py-3 border-b border-border space-y-2.5">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <History className="h-3.5 w-3.5 text-muted-foreground" />
          Discussions
          <span className="ml-auto font-mono text-[10px] text-muted-foreground">{conversations.length}</span>
        </div>
        <button
          onClick={onNew}
          className="w-full h-8 rounded-md bg-foreground text-background text-xs font-medium flex items-center justify-center gap-1.5 hover:opacity-90"
        >
          <MessageSquarePlus className="h-3.5 w-3.5" /> New conversation
        </button>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search history…"
            className="w-full h-8 rounded-md bg-surface-2 border border-border pl-8 pr-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:border-border-strong"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin py-2 px-2 space-y-1">
        {filtered.length === 0 && (
          <p className="text-[11px] text-muted-foreground px-2 py-6 text-center leading-relaxed">
            No saved discussion yet. Ask a question to start the first one.
          </p>
        )}
        {filtered.map(c => {
          const isActive = c.id === activeId;
          const isOpen = expanded === c.id;
          return (
            <div
              key={c.id}
              className={`rounded-lg border transition-colors ${
                isActive ? "border-border-strong bg-surface-2" : "border-transparent hover:bg-surface-2/60"
              }`}
            >
              <div className="flex items-start gap-1 px-2 py-2">
                <button
                  onClick={() => setExpanded(o => (o === c.id ? null : c.id))}
                  className="mt-0.5 p-0.5 rounded text-muted-foreground hover:text-foreground"
                  title="Show messages"
                >
                  <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                </button>
                <button onClick={() => onSelect(c.id)} className="min-w-0 flex-1 text-left">
                  <span className="block text-xs font-medium truncate">{c.title}</span>
                  <span className="block text-[10px] text-muted-foreground font-mono mt-0.5">
                    {formatWhen(c.updatedAt)} · {c.messages.length} messages
                  </span>
                </button>
                <button
                  onClick={() => onDelete(c.id)}
                  title="Delete conversation"
                  className="p-1 rounded text-muted-foreground hover:text-[color:var(--danger,#ef4444)] hover:bg-accent"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>

              {isOpen && c.messages.length > 0 && (
                <ol className="pb-2 pl-7 pr-2 space-y-1">
                  {c.messages.map((m, i) => (
                    <li key={m.id}>
                      <button
                        onClick={() => onSelect(c.id)}
                        className="w-full text-left flex gap-1.5 text-[10.5px] leading-snug text-muted-foreground hover:text-foreground"
                      >
                        <span className="font-mono shrink-0 opacity-60">{String(i + 1).padStart(2, "0")}</span>
                        <span
                          className={`shrink-0 font-mono uppercase ${
                            m.role === "user" ? "text-[color:var(--cyan)]" : "opacity-70"
                          }`}
                        >
                          {m.role === "user" ? "you" : "ai"}
                        </span>
                        <span className="truncate">{m.content.replace(/\s+/g, " ").trim() || "…"}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
