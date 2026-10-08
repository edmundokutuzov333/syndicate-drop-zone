import { createFileRoute } from "@tanstack/react-router";
import { RadioManager } from "@/components/control-room/RadioManager";

export const Route = createFileRoute("/control-room/radio")({
  component: RadioRoute,
});

function RadioRoute() {
  return <RadioManager />;
}
