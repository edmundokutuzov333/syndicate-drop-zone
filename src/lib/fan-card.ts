import type { FanPublic } from "@/lib/fan-membership";

const WIDTH = 1080;
const HEIGHT = 1920;
const INK = "#101010";
const PAPER = "#eee7da";
const RED = "#bd252b";

export function drawFanCard(canvas: HTMLCanvasElement, fan: FanPublic, photo?: HTMLImageElement | null): void {
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não foi possível preparar o cartão.");

  const background = context.createLinearGradient(0, 0, WIDTH, HEIGHT);
  background.addColorStop(0, "#191717");
  background.addColorStop(0.55, INK);
  background.addColorStop(1, "#241012");
  context.fillStyle = background;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  context.fillStyle = RED;
  for (let x = -120; x < WIDTH + 200; x += 76) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x + 26, 0);
    context.lineTo(x + 70, 44);
    context.lineTo(x + 44, 44);
    context.closePath();
    context.fill();
  }

  context.strokeStyle = "#ffffff14";
  context.lineWidth = 1;
  for (let y = 90; y < HEIGHT; y += 42) {
    context.beginPath();
    context.moveTo(48, y);
    context.lineTo(WIDTH - 48, y);
    context.stroke();
  }

  context.fillStyle = PAPER;
  context.textBaseline = "top";
  context.font = '700 30px "Space Mono", monospace';
  context.fillText("O SINDICATO DO TRAP", 72, 82);
  context.textAlign = "right";
  context.fillStyle = RED;
  context.fillText("FÃ Nº " + String(fan.fanNumber).padStart(4, "0"), WIDTH - 72, 82);
  context.textAlign = "left";

  context.fillStyle = PAPER;
  context.font = '84px "Pirata One", serif';
  context.fillText("SOU DO", 72, 154);
  context.fillStyle = RED;
  context.fillText("SINDICATO.", 72, 240);

  context.strokeStyle = RED;
  context.lineWidth = 5;
  context.strokeRect(72, 366, WIDTH - 144, 740);
  context.fillStyle = "#1d1b1b";
  context.fillRect(80, 374, WIDTH - 160, 724);

  if (photo) {
    const sourceWidth = photo.naturalWidth || photo.width;
    const sourceHeight = photo.naturalHeight || photo.height;
    const crop = Math.max((WIDTH - 160) / sourceWidth, 724 / sourceHeight);
    const drawWidth = sourceWidth * crop;
    const drawHeight = sourceHeight * crop;
    context.save();
    context.beginPath();
    context.rect(80, 374, WIDTH - 160, 724);
    context.clip();
    context.drawImage(photo, 80 + ((WIDTH - 160) - drawWidth) / 2, 374 + (724 - drawHeight) / 2, drawWidth, drawHeight);
    context.fillStyle = "#0808083b";
    context.fillRect(80, 374, WIDTH - 160, 724);
    context.restore();
  } else {
    context.fillStyle = RED;
    context.font = '260px "Pirata One", serif';
    context.textAlign = "center";
    context.fillText("SDT", WIDTH / 2, 575);
    context.textAlign = "left";
    context.fillStyle = PAPER;
    context.font = '700 24px "Space Mono", monospace';
    context.fillText("CARTÃO OFICIAL DE FÃ", 118, 950);
  }

  context.fillStyle = INK;
  context.fillRect(102, 1000, WIDTH - 204, 210);
  context.strokeStyle = PAPER;
  context.lineWidth = 3;
  context.strokeRect(102, 1000, WIDTH - 204, 210);
  context.fillStyle = RED;
  context.font = '700 22px "Space Mono", monospace';
  context.fillText("NOME / APELIDO", 132, 1026);
  context.fillStyle = PAPER;
  let aliasSize = 66;
  context.font = aliasSize + 'px "Pirata One", serif';
  while (context.measureText(fan.alias).width > WIDTH - 270 && aliasSize > 32) {
    aliasSize -= 2;
    context.font = aliasSize + 'px "Pirata One", serif';
  }
  context.fillText(fan.alias, 132, 1066);

  context.fillStyle = PAPER;
  context.font = '700 22px "Space Mono", monospace';
  context.fillText("CÓDIGO " + fan.code, 72, 1250);
  context.textAlign = "right";
  context.fillStyle = RED;
  context.fillText("DESDE " + new Date(fan.since).toLocaleDateString("pt-PT"), WIDTH - 72, 1250);
  context.textAlign = "left";

  context.fillStyle = INK;
  context.fillRect(68, 1378, WIDTH - 136, 250);
  context.strokeStyle = RED;
  context.lineWidth = 4;
  context.strokeRect(68, 1378, WIDTH - 136, 250);
  context.fillStyle = PAPER;
  context.font = '700 19px "Space Mono", monospace';
  context.fillText("FREQUÊNCIA 808 // O SOM DO SINDICATO", 92, 1342);
  context.strokeStyle = RED;
  context.lineWidth = 8;
  for (let index = 0; index < 70; index += 1) {
    const wave = Math.abs(Math.sin(index * 0.42) * Math.cos(index * 0.19));
    const barHeight = 20 + wave * 155;
    const x = 94 + index * 12.7;
    context.beginPath();
    context.moveTo(x, 1504 - barHeight / 2);
    context.lineTo(x, 1504 + barHeight / 2);
    context.stroke();
  }

  context.save();
  context.translate(WIDTH - 210, 1740);
  context.rotate(-0.12);
  context.strokeStyle = RED;
  context.lineWidth = 8;
  context.strokeRect(-120, -62, 240, 124);
  context.fillStyle = RED;
  context.textAlign = "center";
  context.font = '700 30px "Special Elite", monospace';
  context.fillText("APROVADO", 0, -19);
  context.font = '700 17px "Space Mono", monospace';
  context.fillText("FÃ SDT", 0, 19);
  context.restore();

  context.fillStyle = PAPER;
  context.font = '700 26px "Space Mono", monospace';
  context.fillText("RESPEITO. APOIO. CRÉDITO. UNIÃO.", 72, 1715);
  context.fillStyle = RED;
  context.font = '700 21px "Space Mono", monospace';
  context.fillText("NINGUÉM SAI SEM O DISCO.", 72, 1762);
  context.fillStyle = "#a9a39a";
  context.font = '18px "Space Mono", monospace';
  context.fillText("CARTÃO DE FÃ · 1ª EDIÇÃO · MAPUTO", 72, 1834);
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Não foi possível preparar a imagem PNG.")), "image/png");
  });
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function downloadFanCard(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  const blob = await canvasToPngBlob(canvas);
  saveBlob(blob, filename.endsWith(".png") ? filename : filename + ".png");
}

export async function shareFanCard(canvas: HTMLCanvasElement, filename: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const blob = await canvasToPngBlob(canvas);
  const safeName = filename.endsWith(".png") ? filename : filename + ".png";
  const file = new File([blob], safeName, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (navigator.share && nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Cartão de Fã · O Sindicato do Trap", text: "Este é o meu cartão de fã do Sindicato do Trap." });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    }
  }
  saveBlob(blob, safeName);
  return "downloaded";
}

export function downloadVideoBlob(blob: Blob, filename: string): void {
  saveBlob(blob, filename.endsWith(".mp4") ? filename : filename + ".mp4");
}
