import { FILTER_REGISTRY } from "./filter-registry";
import { FrameBuffer } from "./frame-buffer";
import { ShaderCache } from "./shader-cache";
import { TextureManager } from "./texture-manager";
import { getFilterFragmentShader } from "./filter-shaders";
import {
  adaptiveRenderPolicy,
  detectPerformanceTier,
} from "@/lib/camera/performance-manager";
import {
  type FilterId,
  type RenderMetrics,
  type ShaderProgramHandle,
  type WebglEngineConfig,
} from "@/lib/camera/types";

type UniformValue = number | number[];

type SourceSize = {
  width: number;
  height: number;
};

type FilterTransition = {
  from: FilterId;
  to: FilterId;
  startedAt: number;
};

const TRANSITION_MS = 300;

const BLEND_VERTEX =
  "attribute vec2 a_position;\n" +
  "varying vec2 v_uv;\n" +
  "void main() {\n" +
  "  v_uv = (a_position + 1.0) * 0.5;\n" +
  "  gl_Position = vec4(a_position, 0.0, 1.0);\n" +
  "}";

const BLEND_FRAGMENT =
  "precision mediump float;\n" +
  "uniform sampler2D u_from;\n" +
  "uniform sampler2D u_to;\n" +
  "uniform float u_progress;\n" +
  "varying vec2 v_uv;\n" +
  "void main() {\n" +
  "  float progress = smoothstep(0.0, 1.0, u_progress);\n" +
  "  gl_FragColor = mix(texture2D(u_from, v_uv), texture2D(u_to, v_uv), progress);\n" +
  "}";

export class WebGLEngine {
  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  private readonly shaderCache = new ShaderCache();
  private readonly textureManager = new TextureManager();
  private readonly transitionFrom = new FrameBuffer();
  private readonly transitionTo = new FrameBuffer();
  private readonly uniforms = new Map<string, UniformValue>();
  private readonly uniformLocations = new Map<
    WebGLProgram,
    Map<string, WebGLUniformLocation | null>
  >();
  private readonly attributeLocations = new Map<WebGLProgram, number>();
  private readonly programs = new Map<FilterId, ShaderProgramHandle>();
  private vertexBuffer: WebGLBuffer | null = null;
  private blendProgram: ShaderProgramHandle | null = null;
  private frameSource: TexImageSource | null = null;
  private vertexShaderSource = "";
  private filter: FilterId = "op1um";
  private transition: FilterTransition | null = null;
  private dpr = 1;
  private renderScale = 1;
  private surfaceWidth = 1;
  private surfaceHeight = 1;
  private lastFrameAt = 0;
  private frameCounter = 0;
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
    this.metrics.deviceTier = detectPerformanceTier();

    const devicePixelRatio =
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const maxDpr =
      this.metrics.deviceTier === "high"
        ? 2
        : this.metrics.deviceTier === "medium"
          ? 1.5
          : 1;

    this.dpr = Math.min(devicePixelRatio, maxDpr);

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

    this.blendProgram = this.compileProgram(
      "camera-crossfade:v2",
      BLEND_VERTEX,
      BLEND_FRAGMENT,
    );
  }

  resize(width: number, height: number): void {
    if (!this.canvas || !this.gl) return;

    this.surfaceWidth = Math.max(1, width);
    this.surfaceHeight = Math.max(1, height);

    this.canvas.width = Math.max(
      1,
      Math.round(this.surfaceWidth * this.dpr * this.renderScale),
    );
    this.canvas.height = Math.max(
      1,
      Math.round(this.surfaceHeight * this.dpr * this.renderScale),
    );

    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    this.transitionFrom.create(this.gl, this.canvas.width, this.canvas.height);
    this.transitionTo.create(this.gl, this.canvas.width, this.canvas.height);

    this.metrics = {
      ...this.metrics,
      dpr: this.dpr,
      renderScale: this.renderScale,
    };
  }

  setFrameSource(source: TexImageSource | null): void {
    this.frameSource = source;
  }

  preloadFilters(vertexShaderSource: string): void {
    this.vertexShaderSource = vertexShaderSource;

    for (const filter of FILTER_REGISTRY.listVisible()) {
      const handle = this.compileProgram(
        filter.shaderKey,
        this.vertexShaderSource,
        getFilterFragmentShader(filter.id),
      );

      this.programs.set(filter.id, handle);
    }

    this.applyFilterDefaults(this.filter);
  }

  setProgram(
    key: string,
    vertexSource: string,
    fragmentSource: string,
  ): ShaderProgramHandle {
    if (!this.gl) throw new Error("WEBGL_NOT_INITIALIZED");
    return this.compileProgram(key, vertexSource, fragmentSource);
  }

  setFrameRateTarget(targetFps: number): void {
    if (Number.isFinite(targetFps) && targetFps > 0) {
      this.config.targetFps = targetFps;
    }
  }

  setFilter(filter: FilterId, now = performance.now()): void {
    if (!FILTER_REGISTRY.has(filter)) return;
    if (filter === this.filter && !this.transition) return;

    if (!this.programs.has(filter) && this.vertexShaderSource) {
      const definition = FILTER_REGISTRY.get(filter);
      const handle = this.compileProgram(
        definition.shaderKey,
        this.vertexShaderSource,
        getFilterFragmentShader(filter),
      );
      this.programs.set(filter, handle);
    }

    if (!this.programs.has(filter)) return;

    const from = this.transition?.to ?? this.filter;

    if (filter === from) {
      this.transition = null;
      this.filter = filter;
      this.applyFilterDefaults(filter);
      return;
    }

    this.transition = {
      from,
      to: filter,
      startedAt: now,
    };

    this.applyFilterDefaults(filter);
  }

  setUniform(name: string, value: UniformValue): void {
    this.uniforms.set(name, value);
  }

  render(timestamp = performance.now()): void {
    const gl = this.gl;

    if (!gl || !this.canvas || !this.vertexBuffer || !this.frameSource) return;

    const frameTime =
      this.lastFrameAt === 0 ? 0 : timestamp - this.lastFrameAt;
    this.lastFrameAt = timestamp;

    if (frameTime > (1000 / this.config.targetFps) * 1.75) {
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

    const sourceSize = this.getSourceSize(this.frameSource);

    if (sourceSize.width <= 0 || sourceSize.height <= 0) return;

    this.textureManager.beginFrame();
    this.textureManager.uploadCurrent(
      gl,
      this.frameSource,
      sourceSize.width,
      sourceSize.height,
    );

    if (this.transition) {
      const progress = Math.min(
        1,
        (timestamp - this.transition.startedAt) / TRANSITION_MS,
      );

      this.renderFilterPass(
        this.transitionFrom.get(),
        this.transition.from,
        timestamp,
        sourceSize,
      );
      this.renderFilterPass(
        this.transitionTo.get(),
        this.transition.to,
        timestamp,
        sourceSize,
      );

      const fromTexture = this.transitionFrom.getTexture();
      const toTexture = this.transitionTo.getTexture();

      if (fromTexture && toTexture && this.blendProgram) {
        this.renderCrossfade(fromTexture, toTexture, progress);
      }

      if (progress >= 1) {
        this.filter = this.transition.to;
        this.transition = null;
        this.applyFilterDefaults(this.filter);
      }
    } else {
      this.renderFilterPass(null, this.filter, timestamp, sourceSize);
    }

    this.frameCounter += 1;

    if (this.frameCounter % 30 === 0) {
      this.applyAdaptivePolicy();
    }
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
    const gl = this.gl;

    if (gl) {
      if (this.vertexBuffer) gl.deleteBuffer(this.vertexBuffer);
      this.textureManager.destroy(gl);
      this.transitionFrom.destroy(gl);
      this.transitionTo.destroy(gl);
      this.shaderCache.clear(gl);
    }

    this.vertexBuffer = null;
    this.canvas = null;
    this.gl = null;
    this.frameSource = null;
    this.vertexShaderSource = "";
    this.filter = "op1um";
    this.transition = null;
    this.programs.clear();
    this.blendProgram = null;
    this.uniforms.clear();
    this.uniformLocations.clear();
    this.attributeLocations.clear();
    this.lastFrameAt = 0;
    this.frameCounter = 0;
  }

  private renderFilterPass(
    framebuffer: WebGLFramebuffer | null,
    filter: FilterId,
    timestamp: number,
    sourceSize: SourceSize,
  ): void {
    const gl = this.gl;
    const canvas = this.canvas;
    const vertexBuffer = this.vertexBuffer;
    const programHandle = this.programs.get(filter);

    if (!gl || !canvas || !vertexBuffer || !programHandle) return;

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const currentTexture = this.textureManager.getCurrent();
    const previousTexture = this.textureManager.getPrevious();

    if (!currentTexture || !previousTexture) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return;
    }

    this.bindProgram(programHandle.program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, currentTexture);
    this.setProgramUniform(programHandle.program, "u_texture", 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, previousTexture);
    this.setProgramUniform(programHandle.program, "u_previousFrame", 1);

    this.setProgramUniform(
      programHandle.program,
      "u_resolution",
      [canvas.width, canvas.height],
    );
    this.setProgramUniform(
      programHandle.program,
      "u_videoResolution",
      [sourceSize.width, sourceSize.height],
    );

    this.uniforms.set("u_time", timestamp / 1000);
    this.applyUniforms(programHandle.program);

    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.useProgram(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private renderCrossfade(
    fromTexture: WebGLTexture,
    toTexture: WebGLTexture,
    progress: number,
  ): void {
    const gl = this.gl;
    const canvas = this.canvas;
    const vertexBuffer = this.vertexBuffer;
    const programHandle = this.blendProgram;

    if (!gl || !canvas || !vertexBuffer || !programHandle) return;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    this.bindProgram(programHandle.program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fromTexture);
    this.setProgramUniform(programHandle.program, "u_from", 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, toTexture);
    this.setProgramUniform(programHandle.program, "u_to", 1);

    this.setProgramUniform(programHandle.program, "u_progress", progress);

    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.useProgram(null);
  }

  private bindProgram(program: WebGLProgram): void {
    const gl = this.gl;
    const vertexBuffer = this.vertexBuffer;

    if (!gl || !vertexBuffer) return;

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);

    let positionLocation = this.attributeLocations.get(program);

    if (positionLocation === undefined) {
      positionLocation = gl.getAttribLocation(program, "a_position");
      this.attributeLocations.set(program, positionLocation);
    }

    if (positionLocation >= 0) {
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(
        positionLocation,
        2,
        gl.FLOAT,
        false,
        0,
        0,
      );
    }
  }

  private setProgramUniform(
    program: WebGLProgram,
    name: string,
    value: UniformValue,
  ): void {
    const gl = this.gl;

    if (!gl) return;

    let locationMap = this.uniformLocations.get(program);

    if (!locationMap) {
      locationMap = new Map();
      this.uniformLocations.set(program, locationMap);
    }

    let location = locationMap.get(name);

    if (location === undefined) {
      location = gl.getUniformLocation(program, name);
      locationMap.set(name, location);
    }

    if (location === null) return;

    if (
      name === "u_texture" ||
      name === "u_previousFrame" ||
      name === "u_from" ||
      name === "u_to"
    ) {
      gl.uniform1i(
        location,
        typeof value === "number" ? value : value[0] ?? 0,
      );
      return;
    }

    if (typeof value === "number") {
      gl.uniform1f(location, value);
      return;
    }

    if (value.length === 2) {
      gl.uniform2f(
        location,
        value[0] ?? 0,
        value[1] ?? 0,
      );
    } else if (value.length === 3) {
      gl.uniform3f(
        location,
        value[0] ?? 0,
        value[1] ?? 0,
        value[2] ?? 0,
      );
    } else if (value.length === 4) {
      gl.uniform4f(
        location,
        value[0] ?? 0,
        value[1] ?? 0,
        value[2] ?? 0,
        value[3] ?? 0,
      );
    }
  }

  private applyUniforms(program: WebGLProgram): void {
    this.uniforms.forEach((value, name) => {
      this.setProgramUniform(program, name, value);
    });
  }

  private applyFilterDefaults(filter: FilterId): void {
    const defaults = FILTER_REGISTRY.get(filter).defaults;
    this.uniforms.set("u_intensity", defaults.intensity);
    this.uniforms.set("u_noise", defaults.noise);
    this.uniforms.set("u_distortion", defaults.distortion);
    this.uniforms.set("u_chromatic", defaults.chromatic);
    this.uniforms.set("u_feedback", defaults.feedback);
  }

  private applyAdaptivePolicy(): void {
    if (!this.canvas || !this.gl) return;

    const next = adaptiveRenderPolicy(this.metrics);

    if (
      Math.abs(next.renderScale - this.renderScale) < 0.01 &&
      Math.abs(next.dpr - this.dpr) < 0.01
    ) {
      return;
    }

    this.renderScale = next.renderScale;
    this.dpr = next.dpr;
    this.resize(this.surfaceWidth, this.surfaceHeight);
  }

  private compileProgram(
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
      this.gl.deleteShader(vertex);
      this.gl.deleteShader(fragment);
      throw new Error("WEBGL_PROGRAM_CREATE_FAILED");
    }

    this.gl.attachShader(program, vertex);
    this.gl.attachShader(program, fragment);
    this.gl.linkProgram(program);
    this.gl.deleteShader(vertex);
    this.gl.deleteShader(fragment);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const info = this.gl.getProgramInfoLog(program) ?? "UNKNOWN";
      this.gl.deleteProgram(program);
      throw new Error("WEBGL_PROGRAM_LINK_FAILED: " + info);
    }

    return this.shaderCache.set(key, program);
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
      throw new Error("WEBGL_SHADER_COMPILE_FAILED: " + info);
    }

    return shader;
  }

  private getSourceSize(source: TexImageSource): SourceSize {
    if (
      typeof HTMLVideoElement !== "undefined" &&
      source instanceof HTMLVideoElement
    ) {
      return {
        width: source.videoWidth,
        height: source.videoHeight,
      };
    }

    if (
      typeof HTMLImageElement !== "undefined" &&
      source instanceof HTMLImageElement
    ) {
      return {
        width: source.naturalWidth,
        height: source.naturalHeight,
      };
    }

    if (
      typeof HTMLCanvasElement !== "undefined" &&
      source instanceof HTMLCanvasElement
    ) {
      return {
        width: source.width,
        height: source.height,
      };
    }

    if (
      typeof ImageBitmap !== "undefined" &&
      source instanceof ImageBitmap
    ) {
      return {
        width: source.width,
        height: source.height,
      };
    }

    return { width: 0, height: 0 };
  }
}