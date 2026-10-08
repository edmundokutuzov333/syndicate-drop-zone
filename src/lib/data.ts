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


export type RadioTrackSeed = {
  id: string;
  title: string;
  artist: string;
  src: string;
  kind: "music";
};

export const RADIO_TRACKS: RadioTrackSeed[] = [
  {
    id: "radio-01",
    title: "A Bag",
    artist: "KHRYIS",
    src: "https://cdn.discordapp.com/attachments/1313921250678014022/1557765898171842621/A_BAG_Complete.mp3?ex=6ac8fe0c&is=6ac7ac8c&hm=1494126ae70966427cf777eb721772f3d4ef00814f3b7412937c89cf1b266b14&",
    kind: "music",
  },
  {
    id: "radio-02",
    title: "Chopper",
    artist: "KHRYIS",
    src: "https://cdn.discordapp.com/attachments/1313921250678014022/1557765662632575076/CHOPPER_1.mp3?ex=6ac8fdd3&is=6ac7ac53&hm=24be6c48e7ed9407277b217d90625b7208763f014fde12da7a6cdb4f2298cef4&",
    kind: "music",
  },
  {
    id: "radio-03",
    title: "Freestyle Sujo",
    artist: "KHRYIS",
    src: "https://cdn.discordapp.com/attachments/1313921250678014022/1557765539441410178/FREESTYLE_SUJO.mp3?ex=6ac8fdb6&is=6ac7ac36&hm=1505bde309c1d01f5fe53938aa22637dac8accffce29b90fb90a63c94fa55c42&",
    kind: "music",
  },
  {
    id: "radio-04",
    title: "I'M Flexin up",
    artist: "KHRYIS",
    src: "https://cdn.discordapp.com/attachments/1313921250678014022/1557765583716614184/IM_FLEXIN_UP-KHRIYS_FT_GOMONEY.mp3?ex=6ac8fdc1&is=6ac7ac41&hm=5b7ee0a19fb3207d340c10bea0ebc551b0937b66a6de1cf8cf0f9cbaf58c9179&",
    kind: "music",
  },
  {
    id: "radio-05",
    title: "Money Talk",
    artist: "KHRYIS",
    src: "https://cdn.discordapp.com/attachments/1313921250678014022/1557765540070559885/MONEY_TALK_2.1_MELHOR_QUALIDADE.mp3?ex=6ac8fdb6&is=6ac7ac36&hm=ff97f95b66b387da151f5fcc10e5a2d8767569ff4d8861632469148e7a50d148&",
    kind: "music",
  },
  {
    id: "radio-06",
    title: "Tsanto Dough",
    artist: "KHRYIS",
    src: "https://cdn.discordapp.com/attachments/1313921250678014022/1557765342690942986/TSANTO_DOUGH_1.mp3?ex=6ac8fd87&is=6ac7ac07&hm=9e02b411d4a7d54858462fcf40b4940708052c51b51ac2e01c5857200c5c6f71&",
    kind: "music",
  },
  {
    id: "radio-07",
    title: "FASHIIION D’PHANTOM",
    artist: "PHANTOM, Kingston Siriro, Elton Penicela",
    src: "https://cdn.discordapp.com/attachments/1313921250678014022/1557766706838114324/Unmastered_PHANTOM_Kingston_Siriro_Elton_Penicela_-_Fashion_de_Phantom.mp3?ex=6ac8fecc&is=6ac7ad4c&hm=9c70066a9c203dbb469d1cf40fa26b3f2eeb987c45fff12942eefbc1f83741d1&",
    kind: "music",
  },
  {
    id: "radio-08",
    title: "A Nova Wave",
    artist: "PHANTOM, Bruno The GOAT, Alemão Wav, Elton Penicela",
    src: "https://cdn.discordapp.com/attachments/1313921250678014022/1557766760034345020/Phantom_Bruno_The_Goat_Alemao_Wav__Elton_Penicela_-_A_Nova_Wave.mp3?ex=6ac8fed9&is=6ac7ad59&hm=65d0da1218a5d5b655ff7a83b3e8658942e24fde6dbd0817f36b9a36ae475be4&",
    kind: "music",
  },
  {
    id: "radio-09",
    title: "Phantom Mode (The final movie)",
    artist: "PHANTOM, INF8M8US, HeyyG, Kingston Siriro",
    src: "https://cdn.discordapp.com/attachments/1313921250678014022/1557766742204223548/PHANTOM_Mode_2_-_The_Final_Movie_W__INF8M8US_HEYYG_KINGSTON_SIRIRO.mp3?ex=6ac8fed5&is=6ac7ad55&hm=2359055ed92ca9baa8799a4abeaf9ec0bb9295072b4883b658a86c581705f89a&",
    kind: "music",
  },
];
