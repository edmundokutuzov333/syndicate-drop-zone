import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { click, hiss } from "@/lib/sfx";

const LINKS = [
  { to: "/", label: "HUB", k: "00" },
  { to: "/camping", label: "CAMPING", k: "01" },
  { to: "/membros", label: "MEMBROS", k: "02" },
  { to: "/merch", label: "COFRE", k: "03" },
] as const;

export function TacticalNav() {
  const [time, setTime] = useState("--:--:--");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const f = () => setTime(new Date().toLocaleTimeString("pt-BR"));
    f();
    const i = setInterval(f, 1000);
    // mechanical click on every button/link press
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
        <Link to="/" className="font-gothic text-2xl leading-none">Sindicato</Link>
        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to} onMouseEnter={() => hiss(0.15)}
              activeOptions={{ exact: true }}
              className="border border-transparent px-3 py-1.5 text-muted-foreground transition-colors hover:border-border hover:text-foreground"
              activeProps={{ className: "!border-blood !text-blood" }}>
              <span className="mr-1 opacity-50">{l.k}</span>[{l.label}]
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <span className="hidden text-muted-foreground sm:inline"><span className="text-blood" style={{ animation: "blink 1s steps(1) infinite" }}>●</span> {time}</span>
          <button className="border border-border px-3 py-1.5 md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu">
            {open ? "✕" : "≡"}
          </button>
        </div>
      </div>
      {open && (
        <nav className="grid border-t border-border md:hidden">
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to} onClick={() => setOpen(false)} activeOptions={{ exact: true }}
              className="border-b border-border px-4 py-3 text-sm" activeProps={{ className: "text-blood" }}>
              {l.k} // {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
