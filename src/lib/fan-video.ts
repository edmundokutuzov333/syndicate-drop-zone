export type VideoProgress = (percentage: number) => void;

const CORE_BASE = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd";
export const FAN_VIDEO_SPEC = { durationSeconds: 30, width: 1080, height: 1920, fps: 30 } as const;

export async function createFanVideo(
  cardCanvas: HTMLCanvasElement,
  soundtrackUrl: string,
  onProgress: VideoProgress = () => undefined,
): Promise<Blob> {
  if (typeof Worker === "undefined") throw new Error("Este navegador não permite criar o vídeo. Descarrega a imagem PNG.");
  const sourceUrl = new URL(soundtrackUrl, window.location.origin);
  if (sourceUrl.origin !== window.location.origin) throw new Error("A música seleccionada não está alojada no site.");

  onProgress(2);
  const cardBlob = await new Promise<Blob>((resolve, reject) => {
    cardCanvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Não foi possível preparar a imagem do vídeo.")), "image/png");
  });
  const cardBytes = new Uint8Array(await cardBlob.arrayBuffer());

  // These imports and the WebAssembly core are loaded only after the user presses CREATE VIDEO.
  const [{ FFmpeg }, { fetchFile, toBlobURL }] = await Promise.all([
    import("@ffmpeg/ffmpeg"),
    import("@ffmpeg/util"),
  ]);
  const ffmpeg = new FFmpeg();
  const files = ["fan-card.png", "fan-track.mp3", "fan-video.mp4"];
  let coreURL: string | null = null;
  let wasmURL: string | null = null;

  try {
    onProgress(8);
    coreURL = await toBlobURL(CORE_BASE + "/ffmpeg-core.js", "text/javascript");
    onProgress(14);
    wasmURL = await toBlobURL(CORE_BASE + "/ffmpeg-core.wasm", "application/wasm");
    onProgress(19);
    await ffmpeg.load({ coreURL, wasmURL });
    onProgress(24);

    const audioBytes = await fetchFile(sourceUrl.toString());
    await ffmpeg.writeFile("fan-card.png", cardBytes);
    await ffmpeg.writeFile("fan-track.mp3", audioBytes);

    ffmpeg.on("progress", ({ progress }) => {
      if (Number.isFinite(progress)) onProgress(Math.max(25, Math.min(95, Math.round(25 + progress * 70))));
    });

    const filter = [
      "[0:v]scale=1080:1920:flags=lanczos,setsar=1,drawbox=x=68:y=1378:w=944:h=250:color=black@1:t=fill,drawbox=x=68:y=1378:w=944:h=250:color=0xC62828@1:t=4[base]",
      "[1:a]atrim=start=0:duration=30,asetpts=PTS-STARTPTS,showwaves=s=900x220:mode=cline:rate=30:colors=0xE63946[waves]",
      "[base][waves]overlay=90:1393:shortest=1[outv]",
    ].join(";");
    const exitCode = await ffmpeg.exec([
      "-loop", "1", "-framerate", "30", "-i", "fan-card.png",
      "-stream_loop", "-1", "-i", "fan-track.mp3",
      "-filter_complex", filter, "-map", "[outv]", "-map", "1:a:0",
      "-t", "30", "-r", "30", "-c:v", "libx264",
      "-preset", "ultrafast", "-crf", "21", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "fan-video.mp4",
    ], -1);

    if (exitCode !== 0) throw new Error("O motor de vídeo não conseguiu terminar a exportação.");
    onProgress(97);
    const output = await ffmpeg.readFile("fan-video.mp4");
    if (typeof output === "string" || output.byteLength === 0) throw new Error("O ficheiro MP4 ficou vazio.");
    const copy = new Uint8Array(output);
    const result = new Blob([copy.buffer as ArrayBuffer], { type: "video/mp4" });
    if (result.type !== "video/mp4" || result.size === 0) throw new Error("O ficheiro MP4 não ficou válido.");
    onProgress(100);
    return result;
  } finally {
    for (const filename of files) {
      try { await ffmpeg.deleteFile(filename); } catch { /* The file may be missing after setup failure. */ }
    }
    ffmpeg.terminate();
    if (coreURL) URL.revokeObjectURL(coreURL);
    if (wasmURL) URL.revokeObjectURL(wasmURL);
  }
}
