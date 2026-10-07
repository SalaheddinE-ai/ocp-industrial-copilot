import * as React from "react";

export interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  at: number;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  model?: string;
  focusId?: string | null;
  messages: ChatMsg[];
}

const KEY = "ocp.assistant.conversations";

export function newId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function readConversations(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Conversation[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(c => c && typeof c.id === "string" && Array.isArray(c.messages))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

function write(list: Conversation[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, 100)));
  } catch {
    /* quota */
  }
  window.dispatchEvent(new CustomEvent("ocp:conversations"));
}

export function titleFrom(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "New conversation";
  return clean.length > 52 ? clean.slice(0, 52) + "…" : clean;
}

export function upsertConversation(conv: Conversation) {
  const list = readConversations().filter(c => c.id !== conv.id);
  write([conv, ...list].sort((a, b) => b.updatedAt - a.updatedAt));
}

export function deleteConversation(id: string) {
  write(readConversations().filter(c => c.id !== id));
}

export function clearConversations() {
  write([]);
}

export function createConversation(): Conversation {
  const now = Date.now();
  return { id: newId(), title: "New conversation", createdAt: now, updatedAt: now, messages: [] };
}

export function useConversations() {
  const [list, setList] = React.useState<Conversation[]>([]);

  React.useEffect(() => {
    const sync = () => setList(readConversations());
    sync();
    window.addEventListener("ocp:conversations", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("ocp:conversations", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return { list, refresh: () => setList(readConversations()) };
}

export function formatWhen(ts: number) {
  const d = new Date(ts);
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`;
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}
