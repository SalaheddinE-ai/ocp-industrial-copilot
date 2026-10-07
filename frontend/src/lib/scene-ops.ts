/**
 * src/lib/scene-ops.ts
 *
 * Scene-op types mirroring rag/models/scene_ops.py, plus a marker
 * encode/decode pair so LLM-planned scene ops can ride along inside
 * the plain-text stream /api/chat already returns (see
 * src/lib/rag-client.server.ts and AIAssistant.tsx), instead of
 * requiring a second endpoint or a richer streaming protocol.
 *
 * No ".server" suffix: this module has zero server-only dependencies
 * (no fetch, no env vars) so both the server-side adapter and the
 * client-side chat component can import it directly.
 */

export type ViewMode = "normal" | "exploded" | "section";
export type ComponentHealthState = "healthy" | "warning" | "critical";

export type SceneOp =
  | { type: "focus_component"; component_id: string }
  | { type: "set_view_mode"; mode: ViewMode }
  | { type: "set_component_state"; component_id: string; state: ComponentHealthState };

const MARKER_RE = /\n?<!--SCENE_OPS:(.*?)-->\s*$/s;

/** Appends an invisible trailing marker encoding the ops, or "" if
 * there are none -- concatenate directly onto the answer text. */
export function encodeSceneOpsMarker(ops: SceneOp[]): string {
  if (!ops.length) return "";
  return `\n<!--SCENE_OPS:${JSON.stringify(ops)}-->`;
}

/** Strips a trailing scene-ops marker out of streamed text, if
 * present, and returns the clean text plus the parsed ops. Safe to
 * call on partial/incomplete text (mid-stream) -- it only matches a
 * marker that's fully closed. */
export function extractSceneOpsMarker(text: string): { cleanText: string; ops: SceneOp[] } {
  const match = text.match(MARKER_RE);
  if (!match) return { cleanText: text, ops: [] };

  let ops: SceneOp[] = [];
  try {
    const parsed = JSON.parse(match[1]);
    if (Array.isArray(parsed)) ops = parsed as SceneOp[];
  } catch {
    ops = [];
  }

  return { cleanText: text.slice(0, match.index).trimEnd(), ops };
}
