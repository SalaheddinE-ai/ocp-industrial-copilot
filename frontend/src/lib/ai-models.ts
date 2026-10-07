export interface AIModel {
  id: string;
  label: string;
  vendor: "Google" | "OpenAI" | "Anthropic" | "DeepSeek" | "Internal";
  blurb: string;
  available: boolean;
}

export const AI_MODELS: AIModel[] = [
  {
    id: "rag/industrial-knowledge-copilot",
    label: "Industrial Knowledge Copilot",
    vendor: "Internal",
    blurb:
      "Default · Agentic RAG over the manuals/procedures knowledge base (Qwen2.5-3B-Instruct via Ollama, local)",
    available: true,
  },
  {
    id: "google/gemini-3.6-flash",
    label: "Gemini 3.6 Flash",
    vendor: "Google",
    blurb: "Fast reasoning, best balance for field use — requires LOVABLE_API_KEY",
    available: true,
  },
  {
    id: "google/gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro",
    vendor: "Google",
    blurb: "Deep root-cause analysis, slower",
    available: true,
  },
  {
    id: "google/gemini-3.1-flash-lite",
    label: "Gemini 3.1 Flash Lite",
    vendor: "Google",
    blurb: "Cheapest · quick lookups and summaries",
    available: true,
  },
  {
    id: "openai/gpt-5.6-terra",
    label: "GPT-5.6 Terra",
    vendor: "OpenAI",
    blurb: "Balanced OpenAI model for procedures & diagnostics",
    available: true,
  },
  {
    id: "openai/gpt-5.6-luna",
    label: "GPT-5.6 Luna",
    vendor: "OpenAI",
    blurb: "Low latency, high volume questions",
    available: true,
  },
  {
    id: "openai/gpt-5.5",
    label: "GPT-5.5",
    vendor: "OpenAI",
    blurb: "Frontier reasoning for complex failure analysis",
    available: true,
  },
  {
    id: "anthropic/claude",
    label: "Claude (Anthropic)",
    vendor: "Anthropic",
    blurb: "Not available on this workspace gateway yet",
    available: false,
  },
  {
    id: "deepseek/deepseek-chat",
    label: "DeepSeek Chat",
    vendor: "DeepSeek",
    blurb: "Not available on this workspace gateway yet",
    available: false,
  },
];

export const DEFAULT_MODEL = "rag/industrial-knowledge-copilot";

export function findModel(id: string) {
  return AI_MODELS.find((m) => m.id === id);
}
