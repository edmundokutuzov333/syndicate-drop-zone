import { FILTER_REGISTRY } from "./filter-registry";
import { FrameBuffer } from "./frame-buffer";
import { ShaderCache } from "./shader-cache";
import { TextureManager } from "./texture-manager";
import { detectPerformanceTier } from "@/lib/camera/performance-manager";
import {
  type FilterId,
  type RenderMetrics,
  type ShaderProgramHandle,
  type WebglEngineConfig,
} from "@/lib/camera/types";

type UniformValue = number | number[];

export class WebGLEngine {
  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  private readonly shaderCache = new ShaderCache();
  private readonly textureManager = new TextureManager();
  private readonly frameBuffer = new FrameBuffer();
  private readonly uniforms = new Map<string, UniformValue>();
  private vertexBuffer: WebGLBuffer | null = null;
  private programHandle: ShaderProgramHandle | null = null;
  private uniformLocations = new Map<string, WebGLUniformLocation | null>();
  private frameSource: TexImageSource | null = null;
  private filter: FilterId = "op1um";
  private dpr = 1;
  private renderScale = 1;
  private lastFrameAt = 0;
  private metrics: RenderMetrics = {
    fps: 0,
    frameTimeMs: 0,
    droppedFrames: 0,
    deviceTier: "medium",
    dpr: 1,
    renderScale: 1,
  };
  private readonly config: Required<WebglEngineConfig>;

  constructor(config: WebglEngineConfig = {}) {
    this.config = {
      alpha: config.alpha ?? false,
      antialias: config.antialias ?? false,
      preserveDrawingBuffer: config.preserveDrawingBuffer ?? false,
      targetFps: config.targetFps ?? 60,
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

    this.gl =
      canvas.getContext("webgl2", attributes) ??
      canvas.getContext("webgl", attributes);

    if (!this.gl) throw new Error("WEBGL_UNAVAILABLE");

    this.textureManager.init(this.gl);
    this.vertexBuffer = this.gl.createBuffer();

    if (!this.vertexBuffer) {
      throw new Error("WEBGL_VERTEX_BUFFER_FAILED");
    }

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      this.gl.STATIC_DRAW,
    );
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
  }

  resize(width: number, height: number): void {
    if (!this.canvas || !this.gl) return;

    this.canvas.width = Math.max(
      1,
      Math.round(width * this.dpr * this.renderScale),
    );
    this.canvas.height = Math.max(
      1,
      Math.round(height * this.dpr * this.renderScale),
    );

    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.frameBuffer.create(this.gl, this.canvas.width, this.canvas.height);

    this.metrics = {
      ...this.metrics,
      dpr: this.dpr,
      renderScale: this.renderScale,
    };
  }

  setFrameSource(source: TexImageSource | null): void {
    this.frameSource = source;
  }

  setFilter(filter: FilterId): void {
    if (FILTER_REGISTRY.has(filter)) this.filter = filter;
  }

  setUniform(name: string, value: UniformValue): void {
    this.uniforms.set(name, value);
  }

  setProgram(
    key: string,
    vertexSource: string,
    fragmentSource: string,
  ): ShaderProgramHandle {
    if (!this.gl) throw new Error("WEBGL_NOT_INITIALIZED");

    const handle = this.compileProgram(key, vertexSource, fragmentSource);

    if (this.programHandle?.key === handle.key) return handle;

    this.programHandle = handle;
    this.uniformLocations.clear();
    return handle;
  }

  render(timestamp = performance.now()): void {
    if (!this.gl) return;

    const frameTime =
      this.lastFrameAt === 0 ? 0 : timestamp - this.lastFrameAt;
    this.lastFrameAt = timestamp;

    if (
      frameTime >
      (1000 / this.config.targetFps) * 1.75
    ) {
      this.metrics.droppedFrames += 1;
    }

    if (frameTime > 0) {
      const instantFps = 1000 / frameTime;

      this.metrics = {
        ...this.metrics,
        fps:
          this.metrics.fps === 0
            ? instantFps
            : this.metrics.fps * 0.9 + instantFps * 0.1,
        frameTimeMs:
          this.metrics.frameTimeMs === 0
            ? frameTime
            : this.metrics.frameTimeMs * 0.9 + frameTime * 0.1,
      };
    }

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    this.gl.clearColor(0, 0, 0, 1);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    if (!this.programHandle || !this.vertexBuffer || !this.frameSource) {
      return;
    }

    const sourceSize = this.getSourceSize(this.frameSource);

    if (sourceSize.width <= 0 || sourceSize.height <= 0) {
      return;
    }

    this.textureManager.upload(
      this.gl,
      this.frameSource,
      sourceSize.width,
      sourceSize.height,
    );

    const texture = this.textureManager.get();

    if (!texture) return;

    this.gl.useProgram(this.programHandle.program);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);

    const positionLocation = this.gl.getAttribLocation(
      this.programHandle.program,
      "a_position",
    );

    if (positionLocation >= 0) {
      this.gl.enableVertexAttribArray(positionLocation);
      this.gl.vertexAttribPointer(
        positionLocation,
        2,
        this.gl.FLOAT,
        false,
        0,
        0,
      );
    }

    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

    this.applyUniform("u_texture", 0);
    this.applyUniform("u_resolution", [
      this.canvas?.width ?? 1,
      this.canvas?.height ?? 1,
    ]);
    this.applyUniform("u_videoResolution", [
      sourceSize.width,
      sourceSize.height,
    ]);

    this.uniforms.set("u_time", timestamp / 1000);
    this.applyStoredUniforms();

    this.gl.drawArrays(this.gl.TRIANGLES, 0, 3);

    if (positionLocation >= 0) {
      this.gl.disableVertexAttribArray(positionLocation);
    }

    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
    this.gl.useProgram(null);
  }

  compileProgram(
    key: string,
    vertexSource: string,
    fragmentSource: string,
  ): ShaderProgramHandle {
    if (!this.gl) throw new Error("WEBGL_NOT_INITIALIZED");

    const cached = this.shaderCache.get(key);

    if (cached) return cached;

    const vertex = this.compileShader(
      this.gl.VERTEX_SHADER,
      vertexSource,
    );
    const fragment = this.compileShader(
      this.gl.FRAGMENT_SHADER,
      fragmentSource,
    );
    const program = this.gl.createProgram();

    if (!program) {
      throw new Error("WEBGL_PROGRAM_CREATE_FAILED");
    }

    this.gl.attachShader(program, vertex);
    this.gl.attachShader(program, fragment);
    this.gl.linkProgram(program);
    this.gl.deleteShader(vertex);
    this.gl.deleteShader(fragment);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const info = this.gl.getProgramInfoLog(program) ?? "UNKNOWN";
      throw new Error(
        `WEBGL_PROGRAM_LINK_FAILED: ${info}`,
      );
    }

    return this.shaderCache.set(key, program);
  }

  getMetrics(): RenderMetrics {
    return { ...this.metrics };
  }

  getFilter(): FilterId {
    return this.filter;
  }

  getCapabilities(): { webgl2: boolean; webgl1: boolean } {
    if (!this.canvas) {
      return { webgl2: false, webgl1: false };
    }

    return {
      webgl2: Boolean(this.canvas.getContext("webgl2")),
      webgl1: Boolean(this.canvas.getContext("webgl")),
    };
  }

  destroy(): void {
    if (this.gl) {
      if (this.vertexBuffer) {
        this.gl.deleteBuffer(this.vertexBuffer);
      }

      this.textureManager.destroy(this.gl);
      this.frameBuffer.destroy(this.gl);
      this.shaderCache.clear(this.gl);
    }

    this.vertexBuffer = null;
    this.canvas = null;
    this.gl = null;
    this.programHandle = null;
    this.frameSource = null;
    this.uniforms.clear();
    this.uniformLocations.clear();
    this.lastFrameAt = 0;
  }

  private applyStoredUniforms(): void {
    this.uniforms.forEach((value, name) => {
      this.applyUniform(name, value);
    });
  }

  private applyUniform(name: string, value: UniformValue): void {
    if (!this.gl || !this.programHandle) return;

    let location = this.uniformLocations.get(name);

    if (location === undefined) {
      location = this.gl.getUniformLocation(
        this.programHandle.program,
        name,
      );
      this.uniformLocations.set(name, location);
    }

    if (location === null) return;

    if (name === "u_texture") {
      const unit = typeof value === "number" ? value : value[0] ?? 0;
      this.gl.uniform1i(location, unit);
      return;
    }

    if (typeof value === "number") {
      this.gl.uniform1f(location, value);
      return;
    }

    if (value.length === 2) {
      this.gl.uniform2f(
        location,
        value[0] ?? 0,
        value[1] ?? 0,
      );
    } else if (value.length === 3) {
      this.gl.uniform3f(
        location,
        value[0] ?? 0,
        value[1] ?? 0,
        value[2] ?? 0,
      );
    } else if (value.length === 4) {
      this.gl.uniform4f(
        location,
        value[0] ?? 0,
        value[1] ?? 0,
        value[2] ?? 0,
        value[3] ?? 0,
      );
    }
  }

  private getSourceSize(source: TexImageSource): {
    width: number;
    height: number;
  } {
    if (source instanceof HTMLVideoElement) {
      return {
        width: source.videoWidth,
        height: source.videoHeight,
      };
    }

    if (source instanceof HTMLImageElement) {
      return {
        width: source.naturalWidth,
        height: source.naturalHeight,
      };
    }

    if (source instanceof HTMLCanvasElement) {
      return {
        width: source.width,
        height: source.height,
      };
    }

    if (source instanceof ImageBitmap) {
      return {
        width: source.width,
        height: source.height,
      };
    }

    return { width: 0, height: 0 };
  }

  private compileShader(
    type: number,
    source: string,
  ): WebGLShader {
    if (!this.gl) throw new Error("WEBGL_NOT_INITIALIZED");

    const shader = this.gl.createShader(type);

    if (!shader) {
      throw new Error("WEBGL_SHADER_CREATE_FAILED");
    }

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const info = this.gl.getShaderInfoLog(shader) ?? "UNKNOWN";
      this.gl.deleteShader(shader);
      throw new Error(
        `WEBGL_SHADER_COMPILE_FAILED: ${info}`,
      );
    }

    return shader;
  }
}
