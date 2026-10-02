import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/camping")({
  head: () => ({
    meta: [
      { title: "Diário de Bordo do Bunker — O Sindicato do Trap" },
      { name: "description", content: "Logs das sessões fechadas do camping: notas de mixagem, 808s vazadas, letras rascunhadas e status das faixas." },
      { property: "og:title", content: "Diário de Bordo do Bunker — O Sindicato do Trap" },
      { property: "og:description", content: "Registros clandestinos das 72 horas de isolamento no Bunker Vermelho." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Camping,
});

const LOGS = [
  { t: "DIA 00 · 12:00", sala: "PORTÃO", txt: "Maletas blindadas lacradas com chumbo. 14 dispositivos recolhidos. Sinal de operadora: nulo." },
  { t: "DIA 01 · 18:00", sala: "SALA 01", txt: "VULTO liga a MPC. Primeiro 808 em Fá# grave, distorção no limite. Luz vermelha acesa nas 3 salas." },
  { t: "DIA 01 · 23:42", sala: "SALA 02", txt: "CORONEL MUDO grava a primeira guia sussurrada. Três takes descartados. O quarto fica." },
  { t: "DIA 02 · 04:11", sala: "PORÃO", txt: "Queda de energia por 6 minutos. Gravação continuou na fita de rolo. O ruído entrou na faixa." },
  { t: "DIA 02 · 09:00", sala: "BLOCO C", txt: "XEROX começa o zine. 400 cópias arrastadas no vidro. Toner acabou às 13h." },
  { t: "DIA 03 · 02:40", sala: "SALA 03", txt: "REVERSO chega sem aviso. Ad-libs invertidos gravados de costas para o microfone." },
  { t: "DIA 03 · 05:02", sala: "SALA 03", txt: "FANTASMA some do CCTV. A mix de LUZ DE CÂMARA ESCURA aparece pronta no console." },
];

const TRACKS = [
  { n: "01", t: "CONCRETO ÚMIDO", bpm: 142, key: "F#m", st: "MIX FINAL", p: 100 },
  { n: "02", t: "PAVILHÃO 808", bpm: 130, key: "Dm", st: "MASTER", p: 85 },
  { n: "03", t: "O PACTO", bpm: 150, key: "A#m", st: "VOZ GUIA", p: 45 },
  { n: "04", t: "LUZ DE CÂMARA ESCURA", bpm: 120, key: "Em", st: "MIX FINAL", p: 95 },
  { n: "05", t: "MALETA DE CHUMBO", bpm: 138, key: "Gm", st: "BEAT", p: 25 },
  { n: "06", t: "TUDO OU NADA", bpm: 145, key: "Cm", st: "CLASSIFICADO", p: 0 },
];

const MIX = [
  "808: saturação de fita 3dB, corte em 28Hz, sidechain zero — o grave tem que empurrar a parede.",
  "Voz: SM7B → pré valvulado sujo. Nada de tune corrigido; tune como textura.",
  "Hi-hats: gravados num prato quebrado do porão, sampleados e picotados.",
  "Reverb: o próprio corredor de concreto. Microfone a 12m da caixa.",
  "Master: sem limitador. Se clipar, clipou.",
];

const LYRICS = [
  { l: "quando a luz da cidade apaga", x: false },
  { l: "o concreto lembra meu nome", x: false },
  { l: "eles querem dancinha de quinze segundos", x: true },
  { l: "eu quero o silêncio que consome", x: false },
  { l: "assinei o pacto no escuro do bunker", x: false },
  { l: "sem tela, sem sinal, sem perdão", x: true },
  { l: "tudo ou nada — a arte volta a queimar", x: false },
];

function Camping() {
  const [open, setOpen] = useState(0);
  return (
    <main className="mx-auto max-w-7xl px-4 pb-24 pt-12 md:px-8">
      <p className="text-xs tracking-widest text-blood">// ARQUIVO 01 — ACESSO RESTRITO</p>
      <h1 className="mt-2 font-gothic text-6xl leading-[0.85] md:text-8xl">Diário de Bordo<br />do Bunker</h1>
      <p className="mt-4 max-w-2xl font-stamp text-muted-foreground">
        Propriedade industrial fora do perímetro urbano. 72 horas de isolamento. Câmeras monocromáticas em todos os cantos.
      </p>

      <div className="mt-12 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <section className="border border-border bg-card">
          <div className="flex justify-between border-b border-border px-4 py-2 text-xs text-muted-foreground">
            <span>LOG_SESSÕES.TXT</span><span className="text-blood">● CCTV ATIVO</span>
          </div>
          <ol>
            {LOGS.map((l, i) => (
              <li key={l.t} className="border-b border-border last:border-0">
                <button onClick={() => setOpen(i)} className={`grid w-full grid-cols-[8.5rem_1fr] gap-4 px-4 py-3 text-left text-sm hover:bg-muted ${open === i ? "bg-muted" : ""}`}>
                  <span className="text-xs text-blood">{l.t}<br /><span className="text-muted-foreground">{l.sala}</span></span>
                  <span className={open === i ? "" : "line-clamp-1 text-muted-foreground"}>{l.txt}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>

        <section className="relative rotate-1 border border-border bg-secondary p-6">
          <span className="stamp absolute -right-2 top-4 rotate-12 px-2 text-sm">RASCUNHO</span>
          <p className="text-xs text-muted-foreground">BLOCO CRAFT PRETO · PÁG. 17 · CANETA VERMELHA</p>
          <div className="mt-4 space-y-2 font-stamp text-lg">
            {LYRICS.map((l) => (
              <p key={l.l} className={l.x ? "text-muted-foreground line-through decoration-blood decoration-2" : ""}>{l.l}</p>
            ))}
          </div>
          <p className="mt-6 -rotate-2 font-stamp text-sm text-blood">↳ dobrar o 808 aqui. respirar antes do refrão.</p>
        </section>
      </div>

      <section className="mt-16">
        <h2 className="mb-4 border-b border-border pb-2 font-gothic text-5xl">Status de Produção</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr><th className="py-2">Nº</th><th>FAIXA</th><th>BPM</th><th>TOM</th><th>ETAPA</th><th className="w-1/3">PROGRESSO</th></tr>
            </thead>
            <tbody>
              {TRACKS.map((t) => (
                <tr key={t.n} className="border-t border-border">
                  <td className="py-3 text-muted-foreground">{t.n}</td>
                  <td className="font-stamp">{t.p === 0 ? <span className="bg-foreground text-foreground">{t.t}</span> : t.t}</td>
                  <td>{t.bpm}</td><td>{t.key}</td>
                  <td className={t.p === 0 ? "text-blood" : ""}>{t.st}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 bg-muted"><div className="h-full bg-blood" style={{ width: `${t.p}%` }} /></div>
                      <span className="w-10 text-right text-xs">{t.p}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-16 border border-blood">
        <div className="hazard h-2" />
        <div className="p-6">
          <h2 className="font-gothic text-4xl">Notas Técnicas Vazadas</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {MIX.map((m, i) => (
              <li key={m} className="flex gap-3"><span className="text-blood">[{String(i + 1).padStart(2, "0")}]</span>{m}</li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
