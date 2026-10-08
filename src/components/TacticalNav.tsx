import { Link } from "@tanstack/react-router";
import { Radio } from "lucide-react";
import { useEffect, useState } from "react";
import { click, hiss } from "@/lib/sfx";
import { frequency } from "@/lib/frequency";
import { useMember } from "@/components/use-member";
import logo from "@/assets/brand/sindicato-logo.png.asset.json";

const LINKS = [
  { to: "/", label: "HUB", k: "00" },
  { to: "/camping", label: "CAMPING", k: "01" },
  { to: "/membros", label: "ARTISTAS", k: "02" },
  { to: "/revelacao", label: "REVELAÇÃO", k: "03" },
  { to: "/camera", label: "CAMERA", k: "04" },
  { to: "/merch", label: "MERCH", k: "05" },
  { to: "/filiar", label: "FILIAR", k: "06" },
] as const;

export function TacticalNav() {
  const [time, setTime] = useState("--:--:--");
  const [open, setOpen] = useState(false);
  const { member } = useMember();
  useEffect(() => {
    const f = () => setTime(new Date().toLocaleTimeString("pt-BR"));
    f();
    const i = setInterval(f, 1000);
    const onDown = (e: PointerEvent) => {
      const el = (e.target as HTMLElement).closest("button, a");
      if (el && !(el as HTMLButtonElement).disabled) click();
    };
    window.addEventListener("pointerdown", onDown);
    return () => { clearInterval(i); window.removeEventListener("pointerdown", onDown); };
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
      <div className="flex items-center justify-between px-4 py-3 text-xs md:px-8">
        <Link to="/" className="flex items-center gap-2 font-gothic text-2xl leading-none"><img src={logo.url} alt="" className="h-9 w-auto" />Sindicato</Link>
        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to} onMouseEnter={() => hiss(0.15)} activeOptions={{ exact: true }}
              className="border border-transparent px-3 py-1.5 text-muted-foreground transition-colors hover:border-border hover:text-foreground"
              activeProps={{ className: "!border-blood !text-blood" }}>
              <span className="mr-1 opacity-50">{l.k}</span>[{l.label}]
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Link to="/frequencia" onClick={() => { void frequency.start(); setOpen(false); }} className="flex min-h-11 items-center gap-2 border-b border-border px-4 py-3 text-sm text-blood"><Radio size={14} /> FREQUÊNCIA 808</Link>
          {member && (
            <Link to="/carteira/$code" params={{ code: member.code }} className="hidden border border-blood px-2 py-1 font-mono text-[8px] tracking-[0.14em] text-blood lg:inline">
              SINDICALIZADO Nº {String(member.memberNumber).padStart(4, "0")}
            </Link>
          )}
          <span className="hidden text-muted-foreground sm:inline"><span className="text-blood" style={{ animation: "blink 1s steps(1) infinite" }}>●</span> {time}</span>
          <Link to="/frequencia" onClick={() => { void frequency.start(); }} aria-label="Sintonizar Frequência 808" className="inline-flex min-h-11 min-w-11 items-center justify-center border border-blood text-blood transition hover:bg-blood hover:text-primary-foreground"><Radio size={16} /></Link>
          <button className="border border-border px-3 py-1.5 md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu">{open ? "✕" : "≡"}</button>
        </div>
      </div>
      {open && (
        <nav className="grid border-t border-border md:hidden">
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to} onClick={() => setOpen(false)} activeOptions={{ exact: true }} className="border-b border-border px-4 py-3 text-sm" activeProps={{ className: "text-blood" }}>
              {l.k} // {l.label}
            </Link>
          ))}
          {member && (
            <Link to="/carteira/$code" params={{ code: member.code }} onClick={() => setOpen(false)} className="border-b border-border px-4 py-3 text-sm text-blood">
              SINDICALIZADO Nº {String(member.memberNumber).padStart(4, "0")}
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}
