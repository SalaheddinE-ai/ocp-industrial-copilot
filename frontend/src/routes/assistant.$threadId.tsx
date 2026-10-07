import { createFileRoute } from "@tanstack/react-router";
import { AssistantWorkspace } from "@/components/copilot/AssistantWorkspace";

export const Route = createFileRoute("/assistant/$threadId")({
  component: ThreadPage,
  head: () => ({
    meta: [
      { title: "AI Assistant · OCP Maroc Copilot" },
      { name: "description", content: "Multi-model industrial AI assistant with saved discussion history for centrifugal pump P-104 maintenance." },
      { property: "og:title", content: "AI Assistant · OCP Maroc Copilot" },
      { property: "og:description", content: "Saved AI discussions grounded on pump P-104 asset data, manuals and intervention history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function ThreadPage() {
  const { threadId } = Route.useParams();
  return <AssistantWorkspace key={threadId} threadId={threadId} />;
}
