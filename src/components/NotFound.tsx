import { Link } from "@tanstack/react-router";
import selo from "@/assets/brand/sindicato-selo.png.asset.json";

export function Classificado({
  code = "404",
  line = "ARQUIVO CLASSIFICADO",
  sub = "Esta página não existe ou foi retirada.",
  retry,
}: {
  code?: string;
  line?: string;
  sub?: string;
  retry?: () => void;
}) {
  return (
    <main className="relative grid min-h-[70vh] place-items-center overflow-hidden px-4">
      <img src={selo.url} alt="" aria-hidden className="pointer-events-none absolute -right-10 top-10 w-72 rotate-12 opacity-10" />
      <div className="w-full max-w-xl border-2 border-blood">
        <div className="hazard h-3" />
        <div className="p-8 text-center">
          <p className="text-xs tracking-widest text-blood">ACESSO NEGADO · {code}</p>
          <h1 className="mt-3 font-gothic text-6xl leading-[0.85] md:text-8xl">{line}</h1>
          <p className="mt-4 font-stamp text-muted-foreground">{sub}</p>
          <div className="mt-8 flex justify-center gap-3">
            {retry && (
              <button
                type="button"
                onClick={retry}
                className="border border-blood px-4 py-2 text-sm text-blood hover:bg-blood hover:text-primary-foreground"
              >
                TENTAR DE NOVO
              </button>
            )}
            <Link to="/" className="bg-blood px-4 py-2 text-sm text-primary-foreground">
              VOLTAR AO HUB
            </Link>
          </div>
        </div>
        <div className="hazard h-3" />
      </div>
    </main>
  );
}
