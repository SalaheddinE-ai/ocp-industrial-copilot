/**
 * src/lib/rag-client.server.ts
 *
 * Server-only adapter between the OCP Industrial Copilot frontend and the
 * rag/ Agentic RAG FastAPI service (POST /chat). Runs on the TanStack Start
 * server, so the call to the Python service is server-to-server -- no CORS
 * exposure and no API key sitting in browser-reachable code.
 */

import { encodeSceneOpsMarker, type SceneOp } from "@/lib/scene-ops";

// pump-data.ts component ids -> the component vocabulary the RAG's
// analyze_query prompt / knowledge-base folder structure uses (see
// rag/config/prompts.py and rag/ingestion/metadata/path_metadata.py).
const RAG_COMPONENT_HINTS: Record<string, string> = {
  casing: "casing",
  impeller: "impeller",
  shaft: "shaft",
  bearingDE: "bearings",
  bearingNDE: "bearings",
  seal: "mechanical_seal",
  wearRing: "wear_ring",
  coupling: "coupling",
  basePlate: "base_plate",
  motor: "motor",
  dischargeFlange: "discharge_flange",
  suctionFlange: "suction_flange",
};

// Inverse of the above, for scene ops coming BACK from the RAG (e.g. the
// agent decides to focus a component on its own). "bearings" is
// inherently ambiguous in the RAG's vocabulary -- it doesn't distinguish
// drive-end/non-drive-end -- so it resolves to the drive-end bearing by
// default. If that distinction matters later, the fix belongs in the
// RAG's component vocabulary (rag/models/scene_ops.py), not here.
const FRONTEND_COMPONENT_ID: Record<string, string> = {
  casing: "casing",
  impeller: "impeller",
  shaft: "shaft",
  bearings: "bearingDE",
  mechanical_seal: "seal",
  wear_ring: "wearRing",
  coupling: "coupling",
  base_plate: "basePlate",
  motor: "motor",
  discharge_flange: "dischargeFlange",
  suction_flange: "suctionFlange",
};

interface RagSourceRef {
  document_name: string;
  page?: number | null;
  chunk_id: string;
  document_category?: string | null;
}

interface RagSceneOp {
  type: "focus_component" | "set_view_mode" | "set_component_state";
  component_id?: string | null;
  mode?: "normal" | "exploded" | "section" | null;
  state?: "healthy" | "warning" | "critical" | null;
}

interface RagChatResponse {
  answer: string;
  sources: RagSourceRef[];
  query_type: string;
  retrieval_grade?: Record<string, unknown> | null;
  answer_validation?: Record<string, unknown> | null;
  retry_count: number;
  scene_ops?: RagSceneOp[];
}

export class RagClientError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

function ragApiUrl(): string {
  return process.env["RAG_API_URL"] ?? "http://localhost:8000";
}

function formatSources(sources: RagSourceRef[]): string {
  if (!sources.length) return "";
  const lines = sources.map((s, i) => {
    const page = s.page ? `, p.${s.page}` : "";
    const category = s.document_category ? ` [${s.document_category}]` : "";
    return `${i + 1}. ${s.document_name}${page} — chunk ${s.chunk_id}${category}`;
  });
  return `\n\n---\n**Sources**\n${lines.join("\n")}`;
}

/** Translates the RAG's component vocabulary back to pump-data.ts ids
 * and drops any op that's missing a required field or uses an
 * unrecognized component -- fail-closed on the frontend too, matching
 * execute_scene_ops.py's own validation on the way in. */
function mapSceneOps(ops: RagSceneOp[] | undefined): SceneOp[] {
  if (!ops?.length) return [];
  const mapped: SceneOp[] = [];

  for (const op of ops) {
    if (op.type === "focus_component" && op.component_id) {
      const id = FRONTEND_COMPONENT_ID[op.component_id];
      if (id) mapped.push({ type: "focus_component", component_id: id });
    } else if (op.type === "set_view_mode" && op.mode) {
      mapped.push({ type: "set_view_mode", mode: op.mode });
    } else if (op.type === "set_component_state" && op.component_id && op.state) {
      const id = FRONTEND_COMPONENT_ID[op.component_id];
      if (id) mapped.push({ type: "set_component_state", component_id: id, state: op.state });
    }
  }

  return mapped;
}

/** Calls the rag/ FastAPI /chat endpoint and returns the answer, with a
 * formatted sources block and an invisible scene-ops marker (see
 * src/lib/scene-ops.ts) appended. Throws RagClientError on failure. */
export async function callRagCopilot(query: string, focusId?: string | null): Promise<string> {
  const componentHint = focusId ? RAG_COMPONENT_HINTS[focusId] : undefined;

  let res: Response;
  try {
    res = await fetch(`${ragApiUrl()}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, component_hint: componentHint ?? null }),
    });
  } catch {
    throw new RagClientError(
      "Could not reach the Industrial Knowledge Copilot service. " +
        `Is the rag/ API running at ${ragApiUrl()} (uvicorn api.main:app)?`,
      503,
    );
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new RagClientError(detail || `RAG service returned ${res.status}`, res.status);
  }

  const data = (await res.json()) as RagChatResponse;
  const sceneOps = mapSceneOps(data.scene_ops);
  return `${data.answer}${formatSources(data.sources)}${encodeSceneOpsMarker(sceneOps)}`;
}

/**
 * Wraps a finished string as a gradually-flushed text stream. The rag/ API
 * is not a streaming endpoint (it returns one JSON object once the LangGraph
 * run completes), but AssistantWorkspace.tsx reads /api/chat as an
 * incrementally-appended text stream -- this keeps that UX consistent
 * across every model in the picker instead of the answer appearing all at
 * once.
 */
export function textToSimulatedStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const WORDS_PER_FLUSH = 6;
  const tokens = text.split(/(\s+)/); // keep whitespace tokens so re-join is exact
  let i = 0;
  let cancelled = false;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (cancelled || i >= tokens.length) {
        try {
          controller.close();
        } catch {
          // Already closed/errored (e.g. the client disconnected) -- nothing to do.
        }
        return;
      }
      const piece = tokens.slice(i, i + WORDS_PER_FLUSH).join("");
      i += WORDS_PER_FLUSH;
      try {
        controller.enqueue(encoder.encode(piece));
      } catch {
        // The client disconnected between the cancelled check above and this
        // enqueue (common during dev hot-reloads, or a page navigation) --
        // stop quietly instead of throwing, which would otherwise surface as
        // an unhandled "Error: aborted" 500 in the server log.
        cancelled = true;
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 15));
    },
    cancel() {
      // Called when the consumer stops reading (client disconnect, dev
      // server reload mid-request, etc.) -- any pending pull() exits
      // cleanly on its next tick instead of trying to enqueue further.
      cancelled = true;
    },
  });
}
