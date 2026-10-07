import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ControlRoomShell } from "@/components/control-room/ControlRoomShell";

export const Route = createFileRoute("/control-room")({
  component: ControlRoomLayout,
});

function ControlRoomLayout() {
  return (
    <ControlRoomShell />
  );
}
