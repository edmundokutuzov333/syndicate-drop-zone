import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import { TacticalNav } from "../components/TacticalNav";
import phantomImg from "@/assets/brand/phantom-clean.png";
import { CodeGate } from "../components/CodeGate";
import xoyens from "@/assets/brand/xoyens.png.asset.json";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { getLiveSiteConfig } from "../lib/site-content";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

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
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Pirata+One&family=Space+Mono:wght@400;700&family=Special+Elite&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/__l5e/assets-v1/8d1c8b73-1330-4900-8723-85f98946699a/sindicato-logo.png", type: "image/png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-PT">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const isCameraSurface = useRouterState({
    select: (state) => state.location.pathname.startsWith("/camera"),
  });
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => setOpen(sessionStorage.getItem("sdt-open") === "1"), []);

  return (
    <QueryClientProvider client={queryClient}>
      <div className={isCameraSurface ? "camera-root relative min-h-screen overflow-hidden bg-black" : "grain scanlines relative min-h-screen overflow-x-hidden bg-background"}>
        {open === false && <CodeGate onOpen={() => setOpen(true)} />}
        {!isCameraSurface && <TacticalNav />}
        <Outlet />
        {!isCameraSurface && (
          <footer className="border-t border-border px-4 py-10 text-center">
            <p className="text-[10px] tracking-widest text-muted-foreground">IDEALIZADO POR</p>
            <div className="mt-4 flex items-center justify-center gap-10">
              <img src={phantomImg} alt="PHANTOM" className="h-8 w-auto opacity-80" />
              <span className="text-blood">✕</span>
              <img src={xoyens.url} alt="XOYENS" className="h-10 w-auto opacity-80" />
            </div>
          </footer>
        )}
      </div>
    </QueryClientProvider>
  );
}
