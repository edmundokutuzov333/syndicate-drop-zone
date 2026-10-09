import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";

if (!ffmpegPath) throw new Error("ffmpeg-static did not provide a native FFmpeg binary.");

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Native FFmpeg smoke test timed out."));
    }, 25_000);
    child.stderr.on("data", (chunk) => { stderr = (stderr + chunk.toString()).slice(-10_000); });
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve();
      else reject(new Error("Native FFmpeg smoke test failed (exit " + code + "):\n" + stderr));
    });
  });
}

const directory = await mkdtemp(join(tmpdir(), "sdt-ffmpeg-smoke-"));
try {
  const output = join(directory, "smoke.mp4");
  const filter = [
    "[0:v]scale=1080:1920:flags=fast_bilinear,setsar=1,drawbox=x=68:y=1378:w=944:h=250:color=black@1:t=fill,drawbox=x=68:y=1378:w=944:h=250:color=0xC62828@1:t=4[base]",
    "[1:a]atrim=start=0:duration=2,asetpts=PTS-STARTPTS,showwaves=s=900x220:mode=cline:rate=30:colors=0xE63946[waves]",
    "[base][waves]overlay=90:1393:shortest=1[outv]",
  ].join(";");
  await run([
    "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
    "-f", "lavfi", "-i", "color=c=black:s=1080x1920:r=30:d=2",
    "-f", "lavfi", "-i", "sine=frequency=880:sample_rate=44100:duration=2",
    "-filter_complex", filter, "-map", "[outv]", "-map", "1:a:0",
    "-t", "2", "-r", "30", "-c:v", "libx264", "-preset", "ultrafast",
    "-crf", "28", "-threads", "2", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", "-f", "mp4", output,
  ]);
  const video = await readFile(output);
  if (video.length < 12 || video.toString("ascii", 4, 8) !== "ftyp") {
    throw new Error("Native FFmpeg did not create a valid MP4 container.");
  }
  console.log("Native FFmpeg smoke test passed: libx264 + AAC + showwaves, " + video.length + " bytes.");
} finally {
  await rm(directory, { recursive: true, force: true });
}
