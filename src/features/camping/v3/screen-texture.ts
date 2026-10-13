// Ecrã DAW do estúdio. O título vem da Frequência 808 real; o medidor é uma indicação
// visual de reprodução, não uma medição falsa de amplitude áudio.
import * as THREE from "three";

export type DawScreen = {
  texture: THREE.CanvasTexture;
  draw: (level: number, title: string, dt: number) => void;
  dispose: () => void;
};

export function createDawScreen(width = 1024, height = 576): DawScreen {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;

  let time = 0;
  const draw = (levelInput: number, titleInput: string, dt: number) => {
    if (!context) return;
    const level = THREE.MathUtils.clamp(Number.isFinite(levelInput) ? levelInput : 0, 0, 1);
    const title = (titleInput || "FREQUÊNCIA 808").replace(/[\r\n]+/g, " ").slice(0, 54);
    time += Math.max(0, Math.min(0.25, Number.isFinite(dt) ? dt : 0));

    context.fillStyle = "#0b0e12";
    context.fillRect(0, 0, width, height);
    context.fillStyle = "#151a21";
    context.fillRect(0, 0, width, 34);
    context.fillStyle = "#d8c6a4";
    context.font = "16px monospace";
    context.fillText("SINDICATO / DAW", 14, 22);
    context.fillStyle = "#8b969f";
    context.textAlign = "right";
    context.fillText(title, width - 14, 22, width - 190);
    context.textAlign = "left";

    const lanes = 8;
    const top = 44;
    const laneHeight = Math.floor((height - 56) / lanes);
    const left = 124;
    const laneWidth = width - left - 40;
    for (let lane = 0; lane < lanes; lane += 1) {
      const y = top + lane * laneHeight;
      context.fillStyle = "#10151b";
      context.fillRect(left, y, laneWidth, laneHeight - 5);
      context.fillStyle = lane % 3 === 0 ? "#345d70" : lane % 3 === 1 ? "#76512f" : "#5b3039";
      context.fillRect(10, y, left - 20, laneHeight - 5);
      for (let x = left + 7; x < width - 38; x += 7) {
        const envelope = (Math.sin(x * 0.035 + lane * 1.6 + time * (0.8 + level * 1.8)) * 0.5 + 0.5);
        const barHeight = 2 + envelope * Math.max(1, laneHeight * 0.55) * (0.2 + level * 0.8);
        context.fillStyle = "#3f8fb4";
        context.fillRect(x, y + (laneHeight - barHeight) / 2, 4, barHeight);
      }
    }

    const playheadX = left + ((time * 42) % Math.max(1, laneWidth));
    context.fillStyle = "#ff6449";
    context.fillRect(playheadX, top - 3, 2, height - top - 6);

    context.fillStyle = "#1c232c";
    context.fillRect(width - 25, top, 13, height - top - 12);
    context.fillStyle = "#34d399";
    const meterHeight = (height - top - 12) * level;
    context.fillRect(width - 25, height - 12 - meterHeight, 13, meterHeight);
    texture.needsUpdate = true;
  };

  draw(0.04, "FREQUÊNCIA 808", 0);
  return { texture, draw, dispose: () => texture.dispose() };
}
