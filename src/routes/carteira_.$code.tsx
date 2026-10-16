import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy, ExternalLink } from "lucide-react";
import { memberPublic } from "@/lib/membership";
import { hasNightListenerBadge } from "@/lib/frequency-api";
import selo from "@/assets/brand/sindicato-selo.png.asset.json";

export const Route = createFileRoute("/carteira_/$code")({
  loader: async ({ params }) => {
    const member = await memberPublic(params.code);
    if (!member) throw notFound();
    return { member };
  },
  head: ({ loaderData, params }) => {
    const alias = loaderData?.member?.alias ?? params.code.toUpperCase();
    const number = loaderData?.member?.memberNumber
      ? String(loaderData.member.memberNumber).padStart(4, "0")
      : "----";
    return {
      meta: [
        { title: "SINDICALIZADO Nº " + number + " — " + alias },
        { name: "description", content: "Verificação pública da Carteira de Sindicalizado do Sindicato do Trap." },
        { property: "og:title", content: "SINDICALIZADO Nº " + number + " — " + alias },
        { property: "og:description", content: "Carteira de Sindicalizado · O Sindicato do Trap" },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: PublicCarteira,
});

function PublicCarteira() {
  const { member } = Route.useLoaderData();
  const [copied, setCopied] = useState(false);
  const [nightBadge, setNightBadge] = useState(false);
  const publicUrl = typeof window === "undefined" ? "" : window.location.href;
  const since = new Date(member.since).toLocaleDateString("pt-PT");

  useEffect(() => {
    void hasNightListenerBadge(member.code).then(setNightBadge);
  }, [member.code]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="mx-auto max-w-4xl px-4 pb-28 pt-12 md:px-8">
      <div className="border-y border-border py-5">
        <p className="text-xs tracking-[0.28em] text-blood">VERIFICAÇÃO PÚBLICA</p>
        <h1 className="mt-2 font-gothic text-6xl leading-[0.82] md:text-8xl">Carteira</h1>
      </div>

      <section className="relative mt-10 overflow-hidden border-2 border-blood bg-card p-6 md:p-10">
        <img src={selo.url} alt="" aria-hidden className="pointer-events-none absolute -right-16 top-10 w-64 rotate-12 opacity-10" />
        <div className="hazard h-3 -mx-6 -mt-6 md:-mx-10 md:-mt-10" />

        <div className="mt-8 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-[10px] tracking-[0.24em] text-blood">SINDICALIZADO</p>
            <h2 className="mt-2 font-gothic text-6xl leading-none md:text-8xl">
              Nº {String(member.memberNumber).padStart(4, "0")}
            </h2>
            <p className="mt-4 font-stamp text-3xl">{member.alias}</p>
          </div>
          <div className="border border-border p-4 font-mono text-[9px] tracking-[0.16em] text-muted-foreground">
            <p>CÓDIGO</p>
            <p className="mt-1 text-foreground">{member.code}</p>
            <p className="mt-4">DESDE</p>
            <p className="mt-1 text-foreground">{since}</p>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-5 text-[10px] leading-6 text-muted-foreground">
          <p>Este registo confirma apenas código, número, codinome e data de filiação.</p>
          <p>Contacto privado. Não é exposto nesta página.</p>
        </div>

        {nightBadge && (
          <div className="mt-6 border border-blood bg-blood/5 p-4">
            <p className="font-mono text-[9px] tracking-[0.22em] text-blood">BADGE DE RÁDIO</p>
            <p className="mt-2 font-stamp text-2xl text-foreground">OUVINTE DA MADRUGADA</p>
            <p className="mt-1 font-mono text-[8px] tracking-[0.16em] text-muted-foreground">CONQUISTADO ENTRE 03:00 E 03:59 · ÁFRICA/MAPUTO</p>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={() => void copy()} className="inline-flex items-center gap-2 border border-blood px-4 py-3 font-mono text-[10px] tracking-[0.18em] hover:bg-blood hover:text-primary-foreground">
            <Copy size={14} /> {copied ? "COPIADO" : "COPIAR LINK"}
          </button>
          <a href="/filiar" className="inline-flex items-center gap-2 border border-border px-4 py-3 font-mono text-[10px] tracking-[0.18em] hover:border-blood">
            FILIAR OUTRO MEMBRO <ExternalLink size={13} />
          </a>
        </div>

        <div className="mt-8 h-3 hazard" />
      </section>
    </main>
  );
}
