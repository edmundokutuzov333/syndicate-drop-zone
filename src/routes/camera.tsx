import { lazy, Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";

const CameraPage = lazy(() =>
  import("@/features/camera/CameraPage").then((module) => ({
    default: module.CameraPage,
  })),
);

function CameraRouteFallback() {
  return (
    <main
      className="camera-surface"
      aria-label="A preparar a câmara"
    >
      <section className="camera-stage-full camera-route-loading">
        <span>CAM INIT</span>
      </section>
    </main>
  );
}

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
  component: () => (
    <Suspense fallback={<CameraRouteFallback />}>
      <CameraPage />
    </Suspense>
  ),
});
