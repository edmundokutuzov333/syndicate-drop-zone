import { createFileRoute } from "@tanstack/react-router";
import { EditorialManager } from "@/components/control-room/EditorialManager";

export const Route = createFileRoute("/control-room/seo")({
  component: Module,
});

function Module() {
  return <EditorialManager mode="seo" />;
}
