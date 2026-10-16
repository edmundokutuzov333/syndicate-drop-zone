import { createFileRoute } from "@tanstack/react-router";
import { EditorialManager } from "@/components/control-room/EditorialManager";

export const Route = createFileRoute("/control-room/site")({
  component: Module,
});

function Module() {
  return <EditorialManager mode="site" />;
}
