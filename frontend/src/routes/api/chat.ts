import { createFileRoute } from "@tanstack/react-router";
import { streamText, type ModelMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import {
  createLovableAiGatewayProvider,
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
} from "@/lib/ai-gateway.server";
import { callRagCopilot, RagClientError, textToSimulatedStream } from "@/lib/rag-client.server";
import { components } from "@/lib/pump-data";
import { AI_MODELS, DEFAULT_MODEL } from "@/lib/ai-models";

function buildSystemPrompt(focusId?: string | null) {
  const summary = Object.values(components)
    .map(
      (c) =>
        `- ${c.name} (id: ${c.id}) | status: ${c.status} | material: ${c.material} | dims: ${c.dimensions} | life: ${c.lifeExpectancy} | failure modes: ${c.failureModes.join(", ")}`,
    )
    .join("\n");

  const focus = focusId && components[focusId];
  const focusBlock = focus
    ? `\n\nThe technician is currently inspecting: ${focus.name}.\nDescription: ${focus.description}\nMaintenance steps: ${focus.maintenance.steps.join(" | ")}\nSafety LOTO: ${focus.safety.loto.join(" | ")}\nSpare parts: ${focus.parts.map((p) => `${p.name} (${p.ref}, stock ${p.stock})`).join(", ")}`
    : "";

  return `You are the OCP Maroc Industrial Copilot, an expert maintenance engineer assistant for centrifugal pump P-104 (API 610 process pump).
Answer like a senior rotating-equipment engineer: precise, standards-aware (API 610, ISO 10816), metric units, no fluff.
Always mention safety/LOTO when a physical intervention is implied. Use short markdown-ish structure (bold labels, dashes) but no heavy headings.

Asset context:
${summary}${focusBlock}`;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as {
          messages?: { role: "user" | "assistant"; content: string }[];
          model?: string;
          focusId?: string | null;
        };

        const picked = AI_MODELS.find((m) => m.id === body.model && m.available);
        const modelId = picked?.id ?? DEFAULT_MODEL;
        const messages = (body.messages ?? []).slice(-20) as ModelMessage[];

        if (modelId.startsWith("rag/")) {
          const lastUser = [...messages].reverse().find((m) => m.role === "user");
          const query = typeof lastUser?.content === "string" ? lastUser.content : "";
          if (!query.trim()) {
            return new Response("No question provided.", { status: 400 });
          }
          try {
            const answer = await callRagCopilot(query, body.focusId);
            return new Response(textToSimulatedStream(answer), {
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            });
          } catch (error) {
            const status = error instanceof RagClientError ? error.status : 500;
            const message = error instanceof Error ? error.message : "RAG request failed";
            return new Response(message, { status });
          }
        }

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          return new Response(
            'This model requires LOVABLE_API_KEY, which isn\'t set. Switch to "Industrial Knowledge Copilot" in the model picker to use the local rag/ + Ollama backend instead.',
            { status: 500 },
          );
        }
        const initialRunId = getLovableAiGatewayRunId(request);

        try {
          if (modelId.startsWith("openai/")) {
            const runIdFetch = createLovableAiGatewayRunIdFetch(initialRunId);
            const openai = createOpenAI({
              baseURL: "https://ai.gateway.lovable.dev/v1",
              apiKey,
              headers: {
                "Lovable-API-Key": apiKey,
                "X-Lovable-AIG-SDK": "vercel-ai-sdk",
              },
              fetch: runIdFetch.fetch as typeof fetch,
            });
            const result = streamText({
              model: openai.responses(modelId),
              system: buildSystemPrompt(body.focusId),
              messages,
              abortSignal: request.signal,
              providerOptions: { openai: { store: false } },
            });
            return result.toTextStreamResponse();
          }

          const gateway = createLovableAiGatewayProvider(apiKey, initialRunId);
          const result = streamText({
            model: gateway(modelId),
            system: buildSystemPrompt(body.focusId),
            messages,
            abortSignal: request.signal,
          });
          return result.toTextStreamResponse();
        } catch (error) {
          const message = error instanceof Error ? error.message : "AI request failed";
          const status = /rate/i.test(message) ? 429 : /credit|402/.test(message) ? 402 : 500;
          return new Response(message, { status });
        }
      },
    },
  },
});
