import { useEffect, useState } from "react";
import { click, hiss } from "@/lib/sfx";
import selo from "@/assets/brand/sindicato-selo.png.asset.json";
import logo from "@/assets/brand/sindicato-logo.png.asset.json";

const CODE = "808";
const buzz = (p: number | number[]) => { try { navigator.vibrate?.(p); } catch { /* sem suporte */ } };
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "OK"];

export function CodeGate({ onOpen }: { onOpen: () => void }) {
  const [v, setV] = useState("");
  const [err, setErr] = useState(false);
  const [ok, setOk] = useState(false);

  const press = (k: string) => {
    if (ok) return;
    click();
    buzz(12);
    setErr(false);
    if (k === "C") return setV("");
    if (k === "OK") {
      if (v === CODE) {
        setOk(true);
        buzz([60, 40, 60, 40, 220]);
        hiss(0.6);
        sessionStorage.setItem("sdt-open", "1");
        setTimeout(onOpen, 900);
      } else { buzz([180, 60, 180]); setErr(true); setV(""); }
      return;
    }
    setV((s) => (s + k).slice(0, 3));
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === "Enter") press("OK");
      else if (e.key === "Backspace" || e.key === "Escape") press("C");
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  return (
    <div className="grain scanlines fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-background p-4">
      <img src={selo.url} alt="" aria-hidden className="pointer-events-none absolute -left-24 -top-24 w-[28rem] rotate-12 opacity-10" />
      <img src={selo.url} alt="" aria-hidden className="pointer-events-none absolute -bottom-32 -right-24 w-[34rem] -rotate-6 opacity-[0.07]" />

      <div className={`relative w-full max-w-sm border-2 border-ash bg-card p-5 shadow-[inset_0_2px_0_oklch(1_0_0/0.06),0_30px_60px_oklch(0_0_0/0.7)] transition-transform ${err ? "animate-[shake_0.3s]" : ""}`}>
        {/* screws */}
        {["left-2 top-2", "right-2 top-2", "left-2 bottom-2", "right-2 bottom-2"].map((p) => (
          <span key={p} className={`absolute ${p} h-2 w-2 rounded-full bg-ash`} />
        ))}
        <div className="flex items-center justify-between">
          <img src={logo.url} alt="O Sindicato do Trap" className="h-10 w-auto" />
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground">SDT-808</span>
        </div>

        {/* display */}
        <div className="relative mt-4 border-4 border-background bg-background px-4 py-5">
          <div className={`text-center font-mono text-5xl font-bold tracking-[0.5em] ${err ? "text-blood" : ok ? "text-primary-foreground" : "text-blood"}`}
            style={{ textShadow: "0 0 12px var(--blood)" }}>
            {ok ? "ON" : err ? "ERR" : v.padEnd(3, "_")}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
            <span>{ok ? "ENTRA." : "CÓDIGO"}</span>
            <span className={ok ? "text-blood" : "flicker text-blood"}>●</span>
          </div>
        </div>

        {/* keypad */}
        <div className="mt-5 grid grid-cols-3 gap-2">
          {KEYS.map((k) => (
            <button key={k} onClick={() => press(k)}
              className={`border-b-4 py-4 font-mono text-lg font-bold transition-all active:translate-y-1 active:border-b-0 ${
                k === "OK" ? "border-background bg-blood text-primary-foreground" : k === "C" ? "border-background bg-ash" : "border-background bg-secondary hover:bg-muted"
              }`}>
              {k}
            </button>
          ))}
        </div>

        {/* stamp on device body */}
        <img src={selo.url} alt="" aria-hidden className="pointer-events-none absolute -bottom-10 -right-10 w-32 -rotate-[18deg] opacity-80 mix-blend-screen" />
      </div>
    </div>
  );
}
