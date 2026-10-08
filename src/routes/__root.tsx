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
import { getDelegates } from "@/lib/membership";
import { buildRouteSeo } from "@/lib/seo";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  loader: async () => ({ site: await getLiveSiteConfig() }),
  head: ({ loaderData, location }) => {
    const seo = buildRouteSeo(location.pathname, loaderData?.site?.heroTitle || undefined);
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: seo.title },
        { name: "description", content: seo.description },
        { property: "og:type", content: seo.ogType },
        { property: "og:title", content: seo.title },
        { property: "og:description", content: seo.description },
        { property: "og:image", content: seo.ogImage },
        { property: "og:url", content: seo.canonical },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: seo.title },
        { name: "twitter:description", content: seo.description },
        { name: "twitter:image", content: seo.ogImage },
        { name: "theme-color", content: "#0f0f0f" },
        { name: "color-scheme", content: "dark" },
        ...(seo.noIndex ? [{ name: "robots", content: "noindex,nofollow" }] : []),
      ],
      links: [
        { rel: "canonical", href: seo.canonical },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Pirata+One&family=Space+Mono:wght@400;700&family=Special+Elite&display=swap",
        },
        { rel: "stylesheet", href: appCss },
        { rel: "manifest", href: "/manifest.webmanifest" },
        { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
        { rel: "icon", href: "/icons/sdt-192.png", sizes: "192x192", type: "image/png" },
      ],
    };
  },
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

function DelegatesFooter() {
  const [rows, setRows] = useState<Array<{ alias: string; referrals: number }>>([]);

  useEffect(() => {
    void getDelegates().then(setRows);
  }, []);

  if (!rows.length) return null;

  return (
    <div className="mx-auto mt-8 max-w-2xl border-t border-border pt-5 text-left">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[9px] tracking-[0.2em] text-blood">DELEGADOS</p>
        <span className="font-mono text-[8px] text-muted-foreground">TOP 10 RECRUTADORES</span>
      </div>
      <div className="mt-3 grid gap-1 sm:grid-cols-2">
        {rows.map((row, index) => (
          <div key={row.alias + index} className="flex items-center justify-between border border-border px-3 py-2 font-mono text-[8px]">
            <span><span className="text-blood">#{String(index + 1).padStart(2, "0")}</span> {row.alias}</span>
            <span className="text-muted-foreground">{row.referrals}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SocialLinks({ social }: { social?: { whatsapp?: string; instagram?: string } }) {
  const links: Array<[string, string]> = [];
  const whatsapp = String(social?.whatsapp ?? "").trim();
  const instagram = String(social?.instagram ?? "").trim();
  if (whatsapp) {
    const digits = whatsapp.replace(/\\D/g, "");
    if (digits) links.push(["WHATSAPP", "https://wa.me/" + digits]);
  }
  if (instagram) {
    const handle = instagram.replace(/^@/, "").replace(/^https?:\\/\\/instagram\\.com\\/?/i, "").replace(/\\/$/, "");
    if (handle) links.push(["INSTAGRAM", "https://instagram.com/" + handle]);
  }
  return links.map(([label, href]) => (
    <a key={label} href={href} target="_blank" rel="noreferrer" className="min-h-11 inline-flex items-center border border-border px-3 text-muted-foreground transition hover:border-blood hover:text-blood">
      {label}
    </a>
  ));
}

function LightModeToggle() {
  const [lite, setLite] = useState(false);
  useEffect(() => {
    let initial = false;
    try {
      initial = localStorage.getItem("sdt-lite") === "1";
    } catch {}
    if (!initial && "connection" in navigator) {
      initial = Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
    }
    setLite(initial);
    document.documentElement.toggleAttribute("data-lite", initial);
    return () => document.documentElement.removeAttribute("data-lite");
  }, []);
  useEffect(() => {
    document.documentElement.toggleAttribute("data-lite", lite);
    try { localStorage.setItem("sdt-lite", lite ? "1" : "0"); } catch {}
  }, [lite]);
  return (
    <button
      type="button"
      aria-pressed={lite}
      onClick={() => setLite((value) => !value)}
      className="min-h-11 border border-border px-3 text-muted-foreground transition hover:border-blood hover:text-blood"
    >
      MODO LEVE {lite ? "· ON" : "· OFF"}
    </button>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const isCameraSurface = useRouterState({
    select: (state) => state.location.pathname.startsWith("/camera"),
  });
  const [open, setOpen] = useState(() => isGateOpen());
  const { site } = Route.useLoaderData();

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
              <img src={phantomImg} alt="PHANTOM" loading="lazy" decoding="async" className="h-8 w-auto opacity-80" />
              <span className="text-blood" aria-hidden>✕</span>
              <img src={xoyens.url} alt="XOYENS" loading="lazy" decoding="async" className="h-10 w-auto opacity-80" />
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2 font-mono text-[8px] tracking-[0.14em]">
              <SocialLinks social={site?.social} />
              <LightModeToggle />
            </div>
            <DelegatesFooter />
          </footer>
        )}
        <MiniPlayer />
        <Toaster />
      </div>
    </QueryClientProvider>
  );
}
