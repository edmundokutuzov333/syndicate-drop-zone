import m1 from "@/assets/m1.jpg";
import m2 from "@/assets/m2.jpg";
import m3 from "@/assets/m3.jpg";
import m4 from "@/assets/m4.jpg";
import m5 from "@/assets/m5.jpg";
import m6 from "@/assets/m6.jpg";
import p1 from "@/assets/p1.jpg";
import p2 from "@/assets/p2.jpg";
import p3 from "@/assets/p3.jpg";
import p4 from "@/assets/p4.jpg";
import type { Track } from "./tape-engine";

import t1 from "@/assets/tapes/nova-wave.mp3.asset.json";
import t2 from "@/assets/tapes/phantom-mode.mp3.asset.json";
import t3 from "@/assets/tapes/fashiion.mp3.asset.json";
import t4 from "@/assets/tapes/intro.mp3.asset.json";

export const TAPES: (Track & { dur: string })[] = [
  { id: "T1", title: "A NOVA WAVE", feat: "Bruno The GOAT, Elton Penicela, Alemão Wavv", dur: "0:30", src: t1.url },
  { id: "T2", title: "PHANTOM MODE", feat: "INF8M8US", dur: "0:30", src: t2.url },
  { id: "T3", title: "FASHIION D'PHANTOM", feat: "Kingston Siriro, Kaká Machava, Elton Penicela", dur: "0:30", src: t3.url },
  { id: "T4", title: "ph4nt0mmm_intr0", feat: "PHANTOM", dur: "0:30", src: t4.url },
];

export const MEMBERS = [
  { code: "SDT-01", alias: "VULTO", img: m1, role: "Produtor / 808", last: "Sala 01 — 72h sem sair", status: "ISOLADO", origem: "Zona Norte", entrada: "Dia 01 / 18:00", risco: "ALTO", nota: "Recusa-se a deixar a sala. Programa 808s com o volume no talo e as luzes apagadas." },
  { code: "SDT-02", alias: "CORONEL MUDO", img: m2, role: "Voz / Composição", last: "Visto às 04:11 no porão", status: "ATIVO", origem: "Desconhecida", entrada: "Dia 01 / 21:30", risco: "MÁXIMO", nota: "Escreve com caneta vermelha em papel craft preto. Nunca fala fora da cabine." },
  { code: "SDT-03", alias: "XEROX", img: m3, role: "Direção de Arte", last: "Fotocopiadora, bloco C", status: "VIGIADO", origem: "Centro", entrada: "Dia 02 / 09:00", risco: "MÉDIO", nota: "Arrasta fotos no vidro do scanner até sangrar o toner. Responsável pelo zine." },
  { code: "SDT-04", alias: "FANTASMA", img: m4, role: "Engenharia de Áudio", last: "Sem registro desde 02/10", status: "DESAPARECIDO", origem: "Interior", entrada: "Dia 01 / 18:05", risco: "ALTO", nota: "Mixagens feitas em fita de rolo. Câmeras só registram vultos em movimento." },
  { code: "SDT-05", alias: "REVERSO", img: m5, role: "Voz / Ad-libs", last: "Câmera 7 — sussurrando", status: "ATIVO", origem: "Baixada", entrada: "Dia 03 / 02:40", risco: "MÉDIO", nota: "Grava ad-libs de costas e invertidos. Os takes nunca passam de um." },
  { code: "SDT-06", alias: "CHUMBO", img: m6, role: "Segurança do Bunker", last: "Guarda das maletas", status: "ISOLADO", origem: "Classificada", entrada: "Dia 00 / 12:00", risco: "BAIXO", nota: "Guarda as maletas blindadas com os celulares lacrados. Ninguém sai sem sua chave." },
];

export const MERCH = [
  { n: "01", img: p1, name: "HEAVYWEIGHT BOXY TEE", sub: "DOSSIÊ VOL. 1", spec: "260 GSM · lavagem mineral · 333 un. numeradas", price: 249, left: 87,
    detail: ["Algodão penteado 260 GSM", "Gola canelada 3cm", "Tríptico halftone frontal", "Manifesto em silk corrosão nas costas", "Carimbo vermelho numerado"] },
  { n: "02", img: p2, name: "THERMAL WAFFLE LS", sub: "PAVILHÃO 808", spec: "Waffle térmico · costuras expostas · brasão bordado", price: 319, left: 140,
    detail: ["Waffle térmico preto fosco", "Costuras brancas invertidas", "Códigos de barra nas mangas", "Coordenadas do 1º camping", "Brasão tom-sobre-tom"] },
  { n: "03", img: p3, name: "TACTICAL UTILITY HOODIE", sub: "O PACTO", spec: "450 GSM · silk puff · bolso com zíper selado", price: 549, left: 52,
    detail: ["Moletom felpudo 450 GSM", "Capuz sem cordão", "Cruz gótica em silk puff", "Bolso tático com zíper selado", "Regras do Sindicato impressas por dentro"] },
  { n: "04", img: p4, name: "ZINE + FITA K7", sub: "CONTRABANDO", spec: "Papel jornal 90g · K7 fumê · saco antiestático", price: 129, left: 33,
    detail: ["Zine papel jornal 90g", "Grampos de aço aparentes", "Fita K7 preta fumê", "Sessões vazadas sem mixagem", "Saco antiestático a vácuo"] },
];

export const SIZES = ["P", "M", "G", "GG", "XG"];
