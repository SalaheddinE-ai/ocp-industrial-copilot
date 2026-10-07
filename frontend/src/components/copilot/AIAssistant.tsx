import * as React from "react";
import { Mic, Paperclip, FileText, ArrowUp, Sparkles, Bot, User, Square } from "lucide-react";
import { toast } from "sonner";
import { findModel } from "@/lib/ai-models";
import { extractSceneOpsMarker, type SceneOp } from "@/lib/scene-ops";

// This assistant has one fixed persona/backend -- the rag/ Agentic RAG
// service, routed through /api/chat -- unlike AssistantWorkspace which
// exposes a full model picker. See src/lib/rag-client.server.ts for how
// this model id is resolved server-side.
const RAG_MODEL_ID = "rag/industrial-knowledge-copilot";

interface Msg {
  role: "user" | "assistant";
  content: React.ReactNode;
}

const SUGGESTIONS = [
  { q: "Explain cavitation", target: null },
  { q: "Show bearing", target: "bearingDE" },
  { q: "Replace mechanical seal", target: "seal" },
  { q: "What causes vibration?", target: "impeller" },
];

interface Props {
  onFocusComponent: (id: string) => void;
  /** Component currently focused in the 3D viewer, if any -- forwarded to
   * the RAG service as component_hint so answers are grounded in whatever
   * the user is looking at, not just what they last clicked in this chat. */
  focusId?: string | null;
  /** Called once per turn with any scene ops the agent planned (focus,
   * view-mode change, component health state) -- see
   * src/lib/scene-ops.ts and rag/agentic/nodes/plan_scene_ops.py. */
  onSceneOps?: (ops: SceneOp[]) => void;
}

export function AIAssistant({ onFocusComponent, focusId, onSceneOps }: Props) {
  const [messages, setMessages] = React.useState<Msg[]>([
    {
      role: "assistant",
      content: (
        <div className="space-y-2">
          <p className="text-sm leading-relaxed">
            Industrial Assistant online. I have full context on pump{" "}
            <span className="font-mono text-foreground">P-104</span>, its maintenance manuals, spare
            inventory, and 18 months of intervention history.
          </p>
          <p className="text-xs text-muted-foreground">
            Select a component in the 3D viewer, or start with a suggested prompt below.
          </p>
        </div>
      ),
    },
  ]);
  const [input, setInput] = React.useState("");
  const [streaming, setStreaming] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  };

  const send = async (text: string, target?: string | null) => {
    const prompt = text.trim();
    if (!prompt || streaming) return;

    if (target) onFocusComponent(target);

    const history = [...messages, { role: "user" as const, content: prompt }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Only plain-text turns so far -- safe to forward content as-is.
          messages: history.map((m) => ({ role: m.role, content: String(m.content) })),
          model: RAG_MODEL_ID,
          focusId: target ?? focusId ?? null,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const detail = await res.text().catch(() => "");
        toast.error(detail || "The Industrial Assistant could not answer.");
        setMessages(history);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        // Strip a marker even mid-stream so it never flashes on screen --
        // extractSceneOpsMarker only matches a fully-closed marker, so
        // this is a no-op until the trailing bytes have actually arrived.
        setMessages([
          ...history,
          { role: "assistant", content: extractSceneOpsMarker(acc).cleanText },
        ]);
      }

      const { cleanText, ops } = extractSceneOpsMarker(acc);
      const final = cleanText.trim() ? cleanText : "_No answer returned._";
      setMessages([...history, { role: "assistant", content: final }]);
      if (ops.length) onSceneOps?.(ops);
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        toast.error("Connection to the Industrial Assistant failed.");
        setMessages(history);
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface-1 border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-md bg-foreground text-background flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">Industrial Assistant</div>
            <div className="text-[11px] text-muted-foreground leading-tight">
              {findModel(RAG_MODEL_ID)?.label ?? "Industrial Knowledge Copilot"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span
            className={`h-1.5 w-1.5 rounded-full ${streaming ? "bg-[color:var(--warning)]" : "bg-[color:var(--success)]"}`}
          />
          {streaming ? "Thinking…" : "Online"}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4 space-y-4">
        {messages.map((m, i) => (
          <MessageBubble key={i} msg={m} />
        ))}
      </div>

      {/* Suggestions */}
      <div className="px-3 pb-2 flex flex-wrap gap-1.5 border-t border-border pt-3">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.q}
            onClick={() => send(s.q, s.target)}
            disabled={streaming}
            className="text-[11px] px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-border-strong hover:bg-accent transition-colors disabled:opacity-40"
          >
            {s.q}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="p-3 pt-2">
        <div className="rounded-lg border border-border bg-surface-2/50 focus-within:border-border-strong transition-colors">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Ask about maintenance, parts, procedures…"
            rows={2}
            className="w-full resize-none bg-transparent px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none"
          />
          <div className="flex items-center justify-between px-2 pb-2">
            <div className="flex items-center gap-0.5">
              {[Paperclip, FileText, Mic].map((Icon, i) => (
                <button
                  key={i}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              ))}
            </div>
            {streaming ? (
              <button
                onClick={stop}
                className="h-7 px-2.5 rounded-md border border-border text-[11px] flex items-center gap-1 hover:bg-accent"
              >
                <Square className="h-3 w-3" /> Stop
              </button>
            ) : (
              <button
                onClick={() => send(input)}
                disabled={!input.trim()}
                className="h-7 w-7 rounded-md bg-foreground text-background disabled:opacity-30 flex items-center justify-center hover:opacity-90 transition-opacity"
              >
                <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`h-6 w-6 rounded-md flex items-center justify-center shrink-0 ${
          isUser ? "bg-surface-3" : "bg-foreground text-background"
        }`}
      >
        {isUser ? (
          <User className="h-3 w-3" strokeWidth={1.8} />
        ) : (
          <Bot className="h-3 w-3" strokeWidth={1.8} />
        )}
      </div>
      <div className={`max-w-[85%] ${isUser ? "text-right" : ""}`}>
        {isUser ? (
          <div className="inline-block px-3 py-2 rounded-lg bg-surface-3 text-sm whitespace-pre-wrap text-left">
            {msg.content}
          </div>
        ) : (
          <div className="text-sm text-foreground/95 whitespace-pre-wrap">
            {msg.content || <span className="text-muted-foreground">Thinking…</span>}
          </div>
        )}
      </div>
    </div>
  );
}
