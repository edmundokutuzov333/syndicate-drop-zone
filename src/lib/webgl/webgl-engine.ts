import { FILTER_REGISTRY } from "./filter-registry";
import { FrameBuffer } from "./frame-buffer";
import { ShaderCache } from "./shader-cache";
import { TextureManager } from "./texture-manager";
import { detectPerformanceTier } from "@/lib/camera/performance-manager";
import { type FilterId, type RenderMetrics, type ShaderProgramHandle, type WebglEngineConfig } from "@/lib/camera/types";

export class WebGLEngine {
  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  private readonly shaderCache = new ShaderCache();
  private readonly textureManager = new TextureManager();
  private readonly frameBuffer = new FrameBuffer();
  private frameSource: TexImageSource | null = null;
  private filter: FilterId = "op1um";
  private renderScale = 1;
  private dpr = 1;
  private lastFrameAt = 0;
  private metrics: RenderMetrics = { fps: 0, frameTimeMs: 0, droppedFrames: 0, deviceTier: "medium", dpr: 1, renderScale: 1 };
  private readonly config: Required<WebglEngineConfig>;

  constructor(config: WebglEngineConfig = {}) {
    this.config = {
      alpha: config.alpha ?? false,
      antialias: config.antialias ?? false,
      preserveDrawingBuffer: config.preserveDrawingBuffer ?? false,
      targetFps: config.targetFps ?? 30,
    };
  }

  init(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.metrics.deviceTier = detectPerformanceTier();
    const attributes: WebGLContextAttributes = {
      alpha: this.config.alpha,
      antialias: this.config.antialias,
      preserveDrawingBuffer: this.config.preserveDrawingBuffer,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
    };
    this.gl = canvas.getContext("webgl2", attributes) ?? canvas.getContext("webgl", attributes);
    if (!this.gl) throw new Error("WEBGL_UNAVAILABLE");
    this.textureManager.init(this.gl);
  }

  resize(width: number, height: number): void {
    if (!this.canvas || !this.gl) return;
    const scale = this.renderScale;
    this.canvas.width = Math.max(1, Math.round(width * this.dpr * scale));
    this.canvas.height = Math.max(1, Math.round(height * this.dpr * scale));
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.frameBuffer.create(this.gl, this.canvas.width, this.canvas.height);
    this.metrics = { ...this.metrics, dpr: this.dpr, renderScale: this.renderScale };
  }

  setFrameSource(source: TexImageSource | null): void { this.frameSource = source; }
  setFilter(filter: FilterId): void { if (FILTER_REGISTRY.has(filter)) this.filter = filter; }
  setUniform(_name: string, _value: number | number[]): void {}

  render(timestamp = performance.now()): void {
    if (!this.gl) return;
    const frameTime = this.lastFrameAt === 0 ? 0 : timestamp - this.lastFrameAt;
    this.lastFrameAt = timestamp;
    if (frameTime > (1000 / this.config.targetFps) * 1.75) this.metrics.droppedFrames += 1;
    if (frameTime > 0) {
      const instantFps = 1000 / frameTime;
      this.metrics = {
        ...this.metrics,
        fps: this.metrics.fps === 0 ? instantFps : this.metrics.fps * 0.9 + instantFps * 0.1,
        frameTimeMs: this.metrics.frameTimeMs === 0 ? frameTime : this.metrics.frameTimeMs * 0.9 + frameTime * 0.1,
      };
    }
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    this.gl.clearColor(0, 0, 0, 1);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    if (this.frameSource) this.textureManager.upload(this.gl, this.frameSource);
  }

  compileProgram(key: string, vertexSource: string, fragmentSource: string): ShaderProgramHandle {
    if (!this.gl) throw new Error("WEBGL_NOT_INITIALIZED");
    const cached = this.shaderCache.get(key);
    if (cached) return cached;
    const vertex = this.compileShader(this.gl.VERTEX_SHADER, vertexSource);
    const fragment = this.compileShader(this.gl.FRAGMENT_SHADER, fragmentSource);
    const program = this.gl.createProgram();
    if (!program) throw new Error("WEBGL_PROGRAM_CREATE_FAILED");
    this.gl.attachShader(program, vertex);
    this.gl.attachShader(program, fragment);
    this.gl.linkProgram(program);
    this.gl.deleteShader(vertex);
    this.gl.deleteShader(fragment);
    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const info = this.gl.getProgramInfoLog(program) ?? "UNKNOWN";
      this.gl.deleteProgram(program);
      throw new Error(`WEBGL_PROGRAM_LINK_FAILED: ${info}`);
    }
    return this.shaderCache.set(key, program);
  }

  getMetrics(): RenderMetrics { return { ...this.metrics }; }
  getFilter(): FilterId { return this.filter; }

  destroy(): void {
    if (this.gl) {
      this.textureManager.destroy(this.gl);
      this.frameBuffer.destroy(this.gl);
      this.shaderCache.clear(this.gl);
    }
    this.canvas = null;
    this.gl = null;
    this.frameSource = null;
    this.lastFrameAt = 0;
  }

  private compileShader(type: number, source: string): WebGLShader {
    if (!this.gl) throw new Error("WEBGL_NOT_INITIALIZED");
    const shader = this.gl.createShader(type);
    if (!shader) throw new Error("WEBGL_SHADER_CREATE_FAILED");
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const info = this.gl.getShaderInfoLog(shader) ?? "UNKNOWN";
      this.gl.deleteShader(shader);
      throw new Error(`WEBGL_SHADER_COMPILE_FAILED: ${info}`);
    }
    return shader;
  }
}
