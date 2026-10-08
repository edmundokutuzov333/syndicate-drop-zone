import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import { TacticalNav } from "@/components/TacticalNav";
import phantomImg from "@/assets/brand/phantom-clean.png";
import { CodeGate } from "@/components/CodeGate";
import { MiniPlayer } from "@/components/MiniPlayer";
import { Classificado } from "@/components/NotFound";
import { Toaster } from "@/components/ui/sonner";
import xoyens from "@/assets/brand/xoyens.png.asset.json";
import appCss from "@/styles.css?url";
import { GATE_BOOT, isGateOpen } from "@/lib/gate";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import { getLiveSiteConfig } from "@/lib/site-content";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  loader: async () => ({ site: await getLiveSiteConfig() }),
  head: ({ loaderData }) => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: loaderData?.site?.heroTitle || "O Sindicato do Trap" },
      { name: "description", content: loaderData?.site?.heroSubtitle || "Portal clandestino do Sindicato do Trap." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#0f0f0f" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Pirata+One&family=Space+Mono:wght@400;700&family=Special+Elite&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      {
        rel: "icon",
        href: "/__l5e/assets-v1/8d1c8b73-1330-4900-8723-85f98946699a/sindicato-logo.png",
        type: "image/png",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: () => <Classificado />,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-MZ" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: GATE_BOOT }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <Classificado
      code="500"
      line="SINAL CORROMPIDO"
      sub="O arquivo não respondeu correctamente. Tenta novamente ou regressa ao hub."
      retry={() => {
        router.invalidate();
        reset();
      }}
    />
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const isCameraSurface = useRouterState({
    select: (state) => state.location.pathname.startsWith("/camera"),
  });
  const [open, setOpen] = useState(() => isGateOpen());

  return (
    <QueryClientProvider client={queryClient}>
      {!open && <CodeGate onOpen={() => setOpen(true)} />}
      <div
        id="site"
        className={
          isCameraSurface
            ? "camera-root relative min-h-screen overflow-hidden bg-black"
            : "grain scanlines relative min-h-screen overflow-x-hidden bg-background"
        }
      >
        {!isCameraSurface && <TacticalNav />}
        <Outlet />
        {!isCameraSurface && (
          <footer className="border-t border-border px-4 py-10 pb-28 text-center">
            <p className="text-[10px] tracking-widest text-muted-foreground">IDEALIZADO POR</p>
            <div className="mt-4 flex items-center justify-center gap-10">
              <img src={phantomImg} alt="PHANTOM" className="h-8 w-auto opacity-80" />
              <span className="text-blood">✕</span>
              <img src={xoyens.url} alt="XOYENS" className="h-10 w-auto opacity-80" />
            </div>
          </footer>
        )}
        <MiniPlayer />
        <Toaster />
      </div>
    </QueryClientProvider>
  );
}
