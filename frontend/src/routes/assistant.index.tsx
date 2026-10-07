import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createConversation, readConversations, upsertConversation } from "@/lib/conversations";

export const Route = createFileRoute("/assistant/")({
  component: AssistantEntry,
  head: () => ({
    meta: [
      { title: "AI Assistant · OCP Maroc Copilot" },
      { name: "description", content: "Multi-model industrial AI assistant for centrifugal pump maintenance, with saved discussion history." },
      { property: "og:title", content: "AI Assistant · OCP Maroc Copilot" },
      { property: "og:description", content: "Multi-model industrial AI assistant grounded on pump P-104 asset data, manuals and intervention history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function AssistantEntry() {
  const navigate = useNavigate();

  React.useEffect(() => {
    const existing = readConversations();
    const target = existing[0]?.id ?? (() => {
      const conv = createConversation();
      upsertConversation(conv);
      return conv.id;
    })();
    navigate({ to: "/assistant/$threadId", params: { threadId: target }, replace: true });
  }, [navigate]);

  return (
    <div className="h-screen w-full flex items-center justify-center bg-background text-muted-foreground text-sm">
      Opening assistant…
    </div>
  );
}
