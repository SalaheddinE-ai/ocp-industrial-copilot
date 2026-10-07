import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bot, User, ArrowUp, Sparkles, Square, Trash2, ChevronDown, Check, Lock, Cpu } from "lucide-react";
import { toast } from "sonner";
import { TopBar } from "@/components/copilot/TopBar";
import { LeftNav } from "@/components/copilot/LeftNav";
import { ConversationSidebar } from "@/components/copilot/ConversationSidebar";
import { AI_MODELS, DEFAULT_MODEL, findModel } from "@/lib/ai-models";
import { useEquipment } from "@/lib/equipment-store";
import {
  createConversation,
  deleteConversation,
  newId,
  readConversations,
  titleFrom,
  upsertConversation,
  useConversations,
  type ChatMsg,
  type Conversation,
} from "@/lib/conversations";

const PROMPTS = [
  "Diagnose rising vibration on P-104 and rank probable causes",
  "Write the LOTO procedure before replacing the mechanical seal",
  "Which spare parts are at risk for the next shutdown?",
  "Explain cavitation and how to verify NPSH margin on site",
];

const MODEL_KEY = "ocp.assistant.model";

export function AssistantWorkspace({ threadId }: { threadId: string }) {
  const navigate = useNavigate();
  const { list } = useEquipment();
  const { list: conversations, refresh } = useConversations();

  const [model, setModel] = React.useState(DEFAULT_MODEL);
  const [focusId, setFocusId] = React.useState<string>("");
  const [messages, setMessages] = React.useState<ChatMsg[]>([]);
  const [input, setInput] = React.useState("");
  const [streaming, setStreaming] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const metaRef = React.useRef<{ title: string; createdAt: number }>({
    title: "New conversation",
    createdAt: Date.now(),
  });

  React.useEffect(() => {
    const saved = window.localStorage.getItem(MODEL_KEY);
    if (saved && findModel(saved)?.available) setModel(saved);
  }, []);

  // Load the thread from the route id.
  React.useEffect(() => {
    const conv = readConversations().find(c => c.id === threadId);
    metaRef.current = { title: conv?.title ?? "New conversation", createdAt: conv?.createdAt ?? Date.now() };
    setMessages(conv?.messages ?? []);
    if (conv?.focusId !== undefined) setFocusId(conv.focusId ?? "");
    setInput("");
    inputRef.current?.focus();
  }, [threadId]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  const persist = React.useCallback(
    (msgs: ChatMsg[], patch?: Partial<Conversation>) => {
      if (msgs.length === 0 && !patch) return;
      const conv: Conversation = {
        id: threadId,
        title: metaRef.current.title,
        createdAt: metaRef.current.createdAt,
        updatedAt: Date.now(),
        model,
        focusId: focusId || null,
        messages: msgs,
        ...patch,
      };
      metaRef.current = { title: conv.title, createdAt: conv.createdAt };
      upsertConversation(conv);
      refresh();
    },
    [threadId, model, focusId, refresh],
  );

  const pickModel = (id: string) => {
    setModel(id);
    window.localStorage.setItem(MODEL_KEY, id);
  };

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  };

  const openThread = (id: string) => {
    if (id === threadId) return;
    stop();
    navigate({ to: "/assistant/$threadId", params: { threadId: id } });
  };

  const startNew = () => {
    stop();
    const conv = createConversation();
    upsertConversation(conv);
    refresh();
    navigate({ to: "/assistant/$threadId", params: { threadId: conv.id } });
  };

  const removeThread = (id: string) => {
    deleteConversation(id);
    const rest = readConversations();
    refresh();
    if (id === threadId) {
      if (rest.length > 0) navigate({ to: "/assistant/$threadId", params: { threadId: rest[0].id } });
      else startNew();
    }
    toast.success("Conversation deleted");
  };

  const send = async (text: string) => {
    const prompt = text.trim();
    if (!prompt || streaming) return;

    const userMsg: ChatMsg = { id: newId(), role: "user", content: prompt, at: Date.now() };
    const assistantMsg: ChatMsg = { id: newId(), role: "assistant", content: "", at: Date.now() };
    const history = [...messages, userMsg];

    if (messages.length === 0) metaRef.current.title = titleFrom(prompt);
    setMessages([...history, assistantMsg]);
    persist(history);
    setInput("");
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map(m => ({ role: m.role, content: m.content })),
          model,
          focusId: focusId || null,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const detail = await res.text().catch(() => "");
        if (res.status === 429) toast.error("Rate limit reached — wait a moment and retry.");
        else if (res.status === 402) toast.error("AI credits exhausted for this workspace.");
        else toast.error(detail || "The assistant could not answer.");
        setMessages(history);
        persist(history);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages([...history, { ...assistantMsg, content: acc }]);
      }
      const final = acc.trim() ? acc : "_No answer returned. Try another model._";
      const done = [...history, { ...assistantMsg, content: final, at: Date.now() }];
      setMessages(done);
      persist(done);
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        toast.error("Connection to the assistant failed.");
        setMessages(history);
        persist(history);
      } else {
        setMessages(m => {
          const kept = m.filter(x => x.content.trim().length > 0);
          persist(kept);
          return kept;
        });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  };

  const clearThread = () => {
    stop();
    setMessages([]);
    metaRef.current.title = "New conversation";
    persist([], { title: "New conversation", messages: [] });
  };

  const active = findModel(model);

  return (
    <div className="h-screen w-full flex flex-col bg-background text-foreground overflow-hidden">
      <TopBar />
      <div className="flex-1 flex min-h-0">
        <LeftNav />
        <ConversationSidebar
          conversations={conversations}
          activeId={threadId}
          onSelect={openThread}
          onNew={startNew}
          onDelete={removeThread}
        />
        <main className="flex-1 min-w-0 flex flex-col">
          {/* Header */}
          <div className="shrink-0 border-b border-border px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 rounded-md bg-foreground text-background flex items-center justify-center">
                <Sparkles className="h-4 w-4" strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-semibold leading-tight truncate">{metaRef.current.title}</h1>
                <p className="text-[11px] text-muted-foreground leading-tight truncate">
                  Grounded on pump P-104 · {list.length} components · {messages.length} messages in this thread
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={focusId}
                onChange={e => setFocusId(e.target.value)}
                className="h-9 rounded-md bg-surface-2 border border-border text-xs px-2 focus:outline-none focus:border-border-strong"
              >
                <option value="">No component focus</option>
                {list.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <ModelPicker value={model} onChange={pickModel} />
              <button
                onClick={clearThread}
                title="Clear this conversation"
                className="h-9 w-9 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-center"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin px-6 py-6">
            <div className="max-w-3xl mx-auto space-y-5">
              {messages.length === 0 && (
                <div className="space-y-5 pt-6">
                  <div className="rounded-xl border border-border bg-surface-1 p-5">
                    <div className="text-sm font-semibold">Ask anything about pump P-104</div>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                      Every discussion is saved on this device — reopen it from the history panel to replay each
                      message line by line. Pick the reasoning model that fits the task — lightweight for lookups,
                      frontier for root-cause analysis.
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                      <Cpu className="h-3.5 w-3.5" /> {active?.label} · {active?.vendor}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {PROMPTS.map(p => (
                      <button
                        key={p}
                        onClick={() => send(p)}
                        className="text-left text-xs px-3.5 py-3 rounded-lg border border-border bg-surface-1 hover:border-border-strong hover:bg-accent/40 transition-colors"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, i) => (
                <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div
                    className={`h-7 w-7 rounded-md flex items-center justify-center shrink-0 ${
                      m.role === "user" ? "bg-surface-3" : "bg-foreground text-background"
                    }`}
                  >
                    {m.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                  </div>
                  <div className={`max-w-[80%] ${m.role === "user" ? "text-right" : ""}`}>
                    <div className="text-[10px] font-mono text-muted-foreground mb-1">
                      #{String(i + 1).padStart(2, "0")} · {new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                    {m.role === "user" ? (
                      <div className="inline-block px-3.5 py-2.5 rounded-lg bg-surface-3 text-sm whitespace-pre-wrap text-left">
                        {m.content}
                      </div>
                    ) : (
                      <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/95">
                        {m.content || <span className="text-muted-foreground">Thinking…</span>}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Composer */}
          <div className="shrink-0 px-6 pb-5">
            <div className="max-w-3xl mx-auto rounded-xl border border-border bg-surface-1 focus-within:border-border-strong transition-colors">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={2}
                placeholder="Ask about diagnostics, procedures, spare parts, standards…"
                className="w-full resize-none bg-transparent px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none"
              />
              <div className="flex items-center justify-between px-3 pb-2.5">
                <span className="text-[11px] text-muted-foreground font-mono">
                  {active?.label} · Enter to send · Shift+Enter for a new line
                </span>
                {streaming ? (
                  <button
                    onClick={stop}
                    className="h-8 px-3 rounded-md border border-border text-xs flex items-center gap-1.5 hover:bg-accent"
                  >
                    <Square className="h-3 w-3" /> Stop
                  </button>
                ) : (
                  <button
                    onClick={() => send(input)}
                    disabled={!input.trim()}
                    className="h-8 w-8 rounded-md bg-foreground text-background disabled:opacity-30 flex items-center justify-center hover:opacity-90"
                  >
                    <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function ModelPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const active = findModel(value);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const vendors = ["Internal", "Google", "OpenAI", "Anthropic", "DeepSeek"] as const;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="h-9 px-3 rounded-md border border-border bg-surface-2 text-xs flex items-center gap-2 hover:border-border-strong transition-colors"
      >
        <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-medium">{active?.label ?? "Select model"}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-[330px] rounded-xl border border-border bg-surface-1 shadow-2xl overflow-hidden">
          <div className="max-h-[420px] overflow-y-auto scrollbar-thin py-1">
            {vendors.map(v => {
              const models = AI_MODELS.filter(m => m.vendor === v);
              if (models.length === 0) return null;
              return (
                <div key={v}>
                  <div className="px-3 pt-2.5 pb-1 text-[10px] uppercase tracking-wide font-mono text-muted-foreground">
                    {v}
                  </div>
                  {models.map(m => (
                    <button
                      key={m.id}
                      disabled={!m.available}
                      onClick={() => {
                        onChange(m.id);
                        setOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 flex items-start gap-2.5 transition-colors ${
                        m.available ? "hover:bg-accent" : "opacity-45 cursor-not-allowed"
                      }`}
                    >
                      <span className="mt-0.5 h-4 w-4 shrink-0 flex items-center justify-center">
                        {!m.available ? (
                          <Lock className="h-3 w-3" />
                        ) : m.id === value ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : null}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13px] font-medium">{m.label}</span>
                        <span className="block text-[11px] text-muted-foreground">{m.blurb}</span>
                      </span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
          <p className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground leading-relaxed">
            Claude and DeepSeek are listed for roadmap visibility — they are not yet routable through the workspace AI
            gateway, so they stay locked.
          </p>
        </div>
      )}
    </div>
  );
}
