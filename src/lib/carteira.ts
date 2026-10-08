import { renderHalftone } from "./halftone-canvas";

export type CardData = {
  code: string;
  number: number;
  alias: string;
  since: string;
  photo?: HTMLImageElement | null;
  signature?: HTMLCanvasElement | null;
  seloUrl?: HTMLImageElement | null;
};

const BG = "#0f0f0f";
const FG = "#ddd6c7";
const BLOOD = "#8a1c1c";

export function drawCard(canvas: HTMLCanvasElement, data: CardData): void {
  const W = 1080;
  const H = 1920;
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  const grain = ctx.getImageData(0, 0, W, H);
  for (let i = 0; i < grain.data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 22;
    grain.data[i] = Math.max(0, (grain.data[i] ?? 0) + noise);
    grain.data[i + 1] = Math.max(0, (grain.data[i + 1] ?? 0) + noise);
    grain.data[i + 2] = Math.max(0, (grain.data[i + 2] ?? 0) + noise);
  }
  ctx.putImageData(grain, 0, 0);

  for (let x = -200; x < W + 200; x += 56) {
    ctx.fillStyle = BLOOD;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 28, 0);
    ctx.lineTo(x + 68, 40);
    ctx.lineTo(x + 40, 40);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = FG;
  ctx.textBaseline = "top";
  ctx.font = "700 34px 'Space Mono', monospace";
  ctx.fillText("O SINDICATO DO TRAP", 80, 90);
  ctx.textAlign = "right";
  ctx.fillText("Nº " + String(data.number).padStart(4, "0"), W - 80, 90);
  ctx.textAlign = "left";
  ctx.font = "120px 'Pirata One', serif";
  ctx.fillText("Sindicalizado", 80, 150);

  const px = 80;
  const py = 330;
  const pw = W - 160;
  const ph = 900;

  if (data.photo) {
    const halftone = document.createElement("canvas");
    renderHalftone(data.photo, halftone, pw, ph, { cell: 6 });
    ctx.drawImage(halftone, px, py);
  } else {
    ctx.fillStyle = "#1b1b1b";
    ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = BLOOD;
    ctx.font = "300px 'Pirata One', serif";
    ctx.textAlign = "center";
    ctx.fillText("?", W / 2, py + 260);
    ctx.textAlign = "left";
  }

  ctx.strokeStyle = FG;
  ctx.lineWidth = 6;
  ctx.strokeRect(px, py, pw, ph);

  ctx.fillStyle = BG;
  ctx.fillRect(px + 40, py + ph - 260, 620, 220);
  ctx.strokeStyle = FG;
  ctx.strokeRect(px + 40, py + ph - 260, 620, 220);
  ctx.fillStyle = FG;
  ctx.font = "700 28px 'Space Mono', monospace";
  ctx.fillText(data.code, px + 64, py + ph - 240);
  ctx.font = "88px 'Pirata One', serif";
  ctx.fillText(data.alias.slice(0, 14), px + 64, py + ph - 200);
  ctx.fillStyle = BLOOD;
  ctx.font = "26px 'Special Elite', monospace";
  ctx.fillText(data.since, px + 64, py + ph - 84);

  ctx.fillStyle = FG;
  ctx.font = "26px 'Space Mono', monospace";
  ctx.fillText("ASSINATURA", 80, 1290);
  ctx.strokeStyle = FG;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(80, 1470);
  ctx.lineTo(W - 80, 1470);
  ctx.stroke();

  if (data.signature) {
    ctx.drawImage(data.signature, 80, 1300, W - 160, 170);
  }

  if (data.seloUrl) {
    ctx.globalAlpha = 0.9;
    ctx.drawImage(data.seloUrl, W - 420, 1500, 340, 340);
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = FG;
  ctx.font = "30px 'Special Elite', monospace";
  ctx.fillText("NINGUÉM SAI SEM O DISCO.", 80, 1560);
  ctx.fillStyle = BLOOD;
  ctx.fillText("TUDO OU NADA.", 80, 1610);
  ctx.fillStyle = FG;
  ctx.font = "24px 'Space Mono', monospace";
  ctx.fillText("1ª EDIÇÃO · STUDIO XOYENS · 18.12.2026", 80, 1800);
}

function downloadBlob(blob: Blob, filename: string): void {
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(href), 4000);
}

export async function shareCard(
  canvas: HTMLCanvasElement,
  name: string,
): Promise<"shared" | "downloaded" | "cancelled"> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) return "downloaded";

  const file = new File([blob], name + ".png", { type: "image/png" });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: "Sindicalizado",
        text: "Carteira de Sindicalizado · O Sindicato do Trap",
      });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return "cancelled";
      }
    }
  }

  downloadBlob(blob, file.name);
  return "downloaded";
}
