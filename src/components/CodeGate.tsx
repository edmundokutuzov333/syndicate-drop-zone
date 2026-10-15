import { useEffect, useState } from "react";
import { click, hiss, kick808 } from "@/lib/sfx";
import { openGate } from "@/lib/gate";
import { frequency } from "@/lib/frequency";
import { track } from "@/lib/track";
import selo from "@/assets/brand/sindicato-selo.png.asset.json";
import logo from "@/assets/brand/sindicato-logo.png.asset.json";

const CODE = "808";
const buzz = (pattern: number | number[]) => {
  try { navigator.vibrate?.(pattern); } catch { /* Optional browser API; continue without this enhancement. */ }
};
const KEYS = ["1","2","3","4","5","6","7","8","9","C","0","OK"];

export function CodeGate({ onOpen }: { onOpen: () => void }) {
  const [value,setValue]=useState("");
  const [error,setError]=useState(false);
  const [accepted,setAccepted]=useState(false);
  const [hydrated,setHydrated]=useState(false);
  const press=(key:string)=>{
    if(accepted)return;
    // Sound and analytics are optional enhancements. They must never block
    // the keypad state machine or leave the whole site trapped behind the gate.
    try { click(); } catch { /* Optional browser API; continue without this enhancement. */ }
    try { buzz(12); } catch { /* Optional browser API; continue without this enhancement. */ }
    setError(false);
    if(key==="C"){setValue("");return;}
    if(key==="OK"){
      if(value===CODE){
        setAccepted(true);
        openGate();
        // Schedule the unlock before any non-critical WebAudio or analytics
        // calls, which can throw synchronously in restricted browser contexts.
        onOpen();
        try { buzz([60,40,60,40,220]); } catch { /* Optional browser API; continue without this enhancement. */ }
        try { kick808(); } catch { /* Optional browser API; continue without this enhancement. */ }
        try { track("gate_open"); } catch { /* Optional browser API; continue without this enhancement. */ }
        try { hiss(0.6); } catch { /* Optional browser API; continue without this enhancement. */ }
        // RootComponent starts Frequência 808 when the global gate opens.
        // Avoid a second concurrent start here; it can race the parent lifecycle.
      }else{
        try { buzz([180,60,180]); } catch { /* Optional browser API; continue without this enhancement. */ }
        setError(true); setValue("");
      }
      return;
    }
    setValue((current)=>(current+key).slice(0,3));
  };
  useEffect(()=>{
    const handle=(event:KeyboardEvent)=>{
      if(/^[0-9]$/.test(event.key))press(event.key);
      else if(event.key==="Enter")press("OK");
      else if(event.key==="Backspace"||event.key==="Escape")press("C");
    };
    window.addEventListener("keydown",handle);
    setHydrated(true);
    return()=>window.removeEventListener("keydown",handle);
  },[accepted,value]);
  return (
    <div data-site-gate="locked" data-gate-hydrated={hydrated ? "true" : "false"} className="grain scanlines fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-background p-4">
      <img src={selo.url} alt="" aria-hidden className="pointer-events-none absolute -left-24 -top-24 w-[28rem] rotate-12 opacity-10"/>
      <img src={selo.url} alt="" aria-hidden className="pointer-events-none absolute -bottom-32 -right-24 w-[34rem] -rotate-6 opacity-[0.07]"/>
      <div className={"relative w-full max-w-sm border-2 border-ash bg-card p-5 shadow-[inset_0_2px_0_oklch(1_0_0/0.06),0_30px_60px_oklch(0_0_0/0.7)] transition-transform "+(error?"gate-error":"")}>
        {["left-2 top-2","right-2 top-2","left-2 bottom-2","right-2 bottom-2"].map((position)=><span key={position} className={"absolute "+position+" h-2 w-2 rounded-full bg-ash"}/>)}
        <div className="flex items-center justify-between">
          <img src={logo.url} alt="O Sindicato do Trap" className="h-10 w-auto"/>
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground">SDT-808</span>
        </div>
        <div className="relative mt-4 border-4 border-background bg-background px-4 py-5">
          <div aria-live="polite" aria-atomic="true" className={"text-center font-mono text-5xl font-bold tracking-[0.5em] "+(error?"text-blood":accepted?"text-primary-foreground":"text-blood")} style={{textShadow:"0 0 12px var(--blood)"}}>
            {accepted?"ON":error?"ERR":value.padEnd(3,"_")}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground"><span>{accepted?"ENTRA.":"CÓDIGO"}</span><span className="flicker text-blood">●</span></div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          {KEYS.map((key)=><button key={key} type="button" onClick={()=>press(key)} className={"border-b-4 py-4 font-mono text-lg font-bold transition-all active:translate-y-1 active:border-b-0 focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--blood)] "+(key==="OK"?"border-background bg-blood text-primary-foreground":key==="C"?"border-background bg-ash":"border-background bg-secondary hover:bg-muted")}>{key}</button>)}
        </div>
        <img src={selo.url} alt="" aria-hidden className="pointer-events-none absolute -bottom-10 -right-10 w-32 -rotate-[18deg] opacity-80 mix-blend-screen"/>
      </div>
    </div>
  );
}
