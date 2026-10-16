import { createFileRoute } from "@tanstack/react-router";
import { ControlRoomModule } from "@/components/control-room/ControlRoomModule";

export const Route = createFileRoute("/control-room/actividade")({
  component: Module,
});

function Module() {
  return <ControlRoomModule module="actividade" />;
}
