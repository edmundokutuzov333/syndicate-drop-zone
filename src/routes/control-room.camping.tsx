import { createFileRoute } from "@tanstack/react-router";
import { CampingControlRoom } from "@/components/control-room/CampingControlRoom";

export const Route = createFileRoute("/control-room/camping")({
  component: CampingControlRoom,
});
