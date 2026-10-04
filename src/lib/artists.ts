// 16 artistas da 1ª edição. Para adicionar a foto real: importe o ficheiro e preencha `img`.
export type Artist = { code: string; name: string; img?: string; status: string };

const STATUS = ["ATIVO", "VIGIADO", "ISOLADO", "CLASSIFICADO"];

export const ARTISTS: Artist[] = Array.from({ length: 16 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return { code: `SDT-${n}`, name: `ARTISTA ${n}`, status: STATUS[i % STATUS.length]! };
});
