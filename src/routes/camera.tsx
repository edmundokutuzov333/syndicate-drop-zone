import { createFileRoute } from "@tanstack/react-router";
import { CameraPage } from "@/features/camera/CameraPage";

export const Route = createFileRoute("/camera")({
  head: () => ({
    meta: [
      { title: "Camera — O Sindicato do Trap" },
      { name: "description", content: "Camera experimental do Sindicato do Trap." },
      { property: "og:title", content: "Camera — O Sindicato do Trap" },
      { property: "og:description", content: "Superfície de captura experimental do Sindicato do Trap." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CameraPage,
});
