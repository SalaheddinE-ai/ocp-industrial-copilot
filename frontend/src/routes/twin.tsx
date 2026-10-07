import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { TopBar } from "@/components/copilot/TopBar";
import { LeftNav } from "@/components/copilot/LeftNav";
import { AIAssistant } from "@/components/copilot/AIAssistant";
import { Viewer3D } from "@/components/copilot/Viewer3D";
import { InfoPanel } from "@/components/copilot/InfoPanel";
import { BottomTerminal } from "@/components/copilot/BottomTerminal";
import { components } from "@/lib/pump-data";
import type { SceneOp } from "@/lib/scene-ops";

export const Route = createFileRoute("/twin")({
  component: Copilot,
  head: () => ({
    meta: [
      { title: "Digital Twin · OCP Maroc Industrial Copilot" },
      {
        name: "description",
        content:
          "Interactive 3D digital twin of centrifugal pump P-104 with AI-assisted maintenance guidance.",
      },
      { property: "og:title", content: "Digital Twin · OCP Maroc Industrial Copilot" },
      {
        property: "og:description",
        content:
          "Interactive 3D digital twin of centrifugal pump P-104 with AI-assisted maintenance guidance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Copilot() {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [sceneCommand, setSceneCommand] = React.useState<{ nonce: number; ops: SceneOp[] } | null>(
    null,
  );
  const selected = selectedId ? (components[selectedId] ?? null) : null;

  // AIAssistant's onSceneOps hands us the ops the RAG agent planned for
  // this turn (see rag/agentic/nodes/plan_scene_ops.py); Viewer3D applies
  // them via its sceneCommand prop. The nonce guarantees the effect fires
  // even if two consecutive turns happen to produce the identical ops.
  const nonceRef = React.useRef(0);
  const handleSceneOps = React.useCallback((ops: SceneOp[]) => {
    nonceRef.current += 1;
    setSceneCommand({ nonce: nonceRef.current, ops });
  }, []);

  return (
    <div className="min-h-screen lg:h-screen w-full flex flex-col bg-background text-foreground lg:overflow-hidden">
      <TopBar />
      <div className="flex-1 flex min-h-0">
        <LeftNav />
        <main className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 p-3">
            <div className="order-2 lg:order-1 lg:col-span-3 min-h-[420px] lg:min-h-0">
              <AIAssistant
                onFocusComponent={setSelectedId}
                focusId={selectedId}
                onSceneOps={handleSceneOps}
              />
            </div>
            <div className="order-1 lg:order-2 lg:col-span-6 min-h-[420px] lg:min-h-0">
              <Viewer3D
                selectedId={selectedId}
                onSelect={setSelectedId}
                sceneCommand={sceneCommand}
              />
            </div>
            <div className="order-3 lg:col-span-3 min-h-[420px] lg:min-h-0">
              <InfoPanel component={selected} />
            </div>
          </div>
          <div className="hidden lg:block">
            <BottomTerminal selectedId={selectedId} />
          </div>
        </main>
      </div>
    </div>
  );
}
