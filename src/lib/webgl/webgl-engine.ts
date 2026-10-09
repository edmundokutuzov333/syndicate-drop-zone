import { FILTER_REGISTRY } from "./filter-registry";
import { FrameBuffer } from "./frame-buffer";
import { ShaderCache } from "./shader-cache";
import { TextureManager } from "./texture-manager";
import { getFilterFragmentShader } from "./filter-shaders";
import { getFilterShaderContract } from "./filter-contract";
import { CinematicPipeline } from "./cinematic-pipeline";
import {
  canRenderDirectToCanvas,
  type DirectRenderState,
} from "./render-policy";
import crossfadeShader from "@/shaders/camera/crossfade.frag.glsl?raw";
import {
  ASTRO_LUT_HEIGHT,
  ASTRO_LUT_WIDTH,
  createAstroHazeLut,
} from "./lut";
import {
  detectPerformanceTier,
  evaluateAdaptivePreview,
  getFilterRenderScaleCap,
  getInitialPreviewProfile,
  stepAdaptivePreview,
  type AdaptivePreviewState,
} from "@/lib/camera/performance-manager";
import {
  type FaceVfxUniformState,
  type FilterId,
  type MasterOverlayId,
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

type IdleDeadlineLike = {
  timeRemaining(): number;
  didTimeout: boolean;
};

type IdleWindow = Window & {
  requestIdleCallback?: (
    callback: (deadline: IdleDeadlineLike) => void,
    options?: { timeout: number },
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

const TRANSITION_MS = 300;

const BLEND_VERTEX =
  "attribute vec2 a_position;\n" +
  "varying vec2 v_uv;\n" +
  "void main() {\n" +
  "  v_uv = (a_position + 1.0) * 0.5;\n" +
  "  gl_Position = vec4(a_position, 0.0, 1.0);\n" +
  "}";

const BLEND_FRAGMENT = crossfadeShader;

const OVERLAY_FRAGMENT = `
precision mediump float;
uniform sampler2D u_overlay;
varying vec2 v_uv;

void main() {
  vec4 sample = texture2D(u_overlay, v_uv);
  gl_FragColor = sample;
}
`;

export class WebGLEngine {
  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  private readonly shaderCache = new ShaderCache();
  private readonly textureManager = new TextureManager();
  private readonly transitionFrom = new FrameBuffer();
  private readonly transitionTo = new FrameBuffer();
  private readonly finalOutput = new FrameBuffer();
  private readonly cinematicPipeline = new CinematicPipeline();
  private masterOverlays: Record<MasterOverlayId, boolean> = {
    "cathode-crt": false,
    "paper-film": false,
  };
  private readonly uniforms = new Map<string, UniformValue>();
  private readonly uniformLocations = new Map<
    WebGLProgram,
    Map<string, WebGLUniformLocation | null>
  >();
  private readonly attributeLocations = new Map<WebGLProgram, number>();
  private readonly programs = new Map<FilterId, ShaderProgramHandle>();
  private idleCompileHandle: number | null = null;
  private idleCompileQueue: FilterId[] = [];
  private readonly directRenderState: DirectRenderState = {
    transitionActive: false,
    sceneOverlayActive: false,
    overlayPending: false,
    hudPending: false,
    masterOverlayActive: false,
    pipeline: undefined,
  };
  private vertexBuffer: WebGLBuffer | null = null;
  private blendProgram: ShaderProgramHandle | null = null;
  private overlayProgram: ShaderProgramHandle | null = null;
  private overlayTexture: WebGLTexture | null = null;
  private sceneOverlayTexture: WebGLTexture | null = null;
  private sceneOverlaySource: TexImageSource | null = null;
  private hudTexture: WebGLTexture | null = null;
  private hudCanvas: HTMLCanvasElement | null = null;
  private hudText: string | null = null;
  private hudDirty = false;
  private lutTexture: WebGLTexture | null = null;
  private overlayCanvas: HTMLCanvasElement | null = null;
  private overlayText: string | null = null;
  private overlayDirty = false;
  private frameSource: TexImageSource | null = null;
  private vertexShaderSource = "";
  private filter: FilterId = "op1um";
  private transition: FilterTransition | null = null;
  private dpr = 1;
  private renderScale = 1;
  private surfaceWidth = 1;
  private surfaceHeight = 1;
  private forcedOutputResolution: { width: number; height: number } | null = null;
  private readonly uniformValueCache = new Map<WebGLProgram, Map<string, UniformValue>>();
  private readonly resolutionUniform: [number, number] = [1, 1];
  private readonly videoResolutionUniform: [number, number] = [1, 1];
  private drawCallsThisFrame = 0;
  private gcObserver: PerformanceObserver | null = null;
  private gcEvents = 0;
  private lastFrameAt = 0;
  private frameCounter = 0;
  private metrics: RenderMetrics = {
    fps: 0,
    frameTimeMs: 0,
    droppedFrames: 0,
    deviceTier: "medium",
    dpr: 1,
    renderScale: 1,
    renderTimeMs: 0,
    textureUploadTimeMs: 0,
    shaderCompileTimeMs: 0,
    drawCalls: 0,
    gcEvents: 0,
  };
  private adaptivePreviewState: AdaptivePreviewState = {
    renderScale: 1,
    dpr: 1,
    maxRenderScale: 1,
    maxDpr: 1,
    poorWindows: 0,
    healthyWindows: 0,
  };
  private previewProfileKey = "";
  private sourceFrameRate: number | undefined;
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
    this.startGcObserver();

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
      "camera-crossfade:v3",
      BLEND_VERTEX,
      BLEND_FRAGMENT,
    );

    this.overlayProgram = this.compileProgram(
      "camera-countdown-overlay:v1",
      BLEND_VERTEX,
      OVERLAY_FRAGMENT,
    );

    this.overlayCanvas = document.createElement("canvas");
    this.overlayCanvas.width = 1024;
    this.overlayCanvas.height = 1024;
    this.overlayTexture = this.gl.createTexture();

    if (!this.overlayTexture) {
      throw new Error("WEBGL_OVERLAY_TEXTURE_FAILED");
    }

    this.configureOverlayTexture(this.overlayTexture);

    this.sceneOverlayTexture = this.gl.createTexture();
    this.hudTexture = this.gl.createTexture();
    this.lutTexture = this.gl.createTexture();

    if (!this.sceneOverlayTexture || !this.hudTexture || !this.lutTexture) {
      throw new Error("WEBGL_VFX_TEXTURE_FAILED");
    }

    this.configureOverlayTexture(this.sceneOverlayTexture);
    this.configureOverlayTexture(this.hudTexture);

    this.gl.bindTexture(this.gl.TEXTURE_2D, this.lutTexture);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      ASTRO_LUT_WIDTH,
      ASTRO_LUT_HEIGHT,
      0,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      createAstroHazeLut(),
    );
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);

    this.hudCanvas = document.createElement("canvas");
    this.hudCanvas.width = 1024;
    this.hudCanvas.height = 1024;
    this.uniforms.set("u_filterStart", performance.now() / 1000);
  }

  get hasForcedOutputResolution(): boolean {
    return Boolean(this.forcedOutputResolution);
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }

  resize(width: number, height: number): void {
    if (!this.canvas || !this.gl) return;

    this.surfaceWidth = Math.max(1, width);
    this.surfaceHeight = Math.max(1, height);

    this.applyCanvasResolution();

    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    this.transitionFrom.create(this.gl, this.canvas.width, this.canvas.height);
    this.transitionTo.create(this.gl, this.canvas.width, this.canvas.height);
    this.finalOutput.create(this.gl, this.canvas.width, this.canvas.height);
    this.cinematicPipeline.resize(this.canvas.width, this.canvas.height);

    this.metrics = {
      ...this.metrics,
      dpr: this.dpr,
      renderScale: this.renderScale,
    };
  }

  async setOutputResolution(width: number, height: number): Promise<void> {
    if (!this.canvas || !this.gl) {
      throw new Error("WEBGL_NOT_INITIALIZED");
    }

    this.forcedOutputResolution = {
      width: Math.round(width),
      height: Math.round(height),
    };

    this.applyCanvasResolution();
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.transitionFrom.create(this.gl, this.canvas.width, this.canvas.height);
    this.transitionTo.create(this.gl, this.canvas.width, this.canvas.height);
    this.finalOutput.create(this.gl, this.canvas.width, this.canvas.height);
    this.cinematicPipeline.resize(this.canvas.width, this.canvas.height);
  }

  async restorePreviewResolution(): Promise<void> {
    this.forcedOutputResolution = null;

    if (!this.canvas || !this.gl) return;

    this.applyCanvasResolution();
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.transitionFrom.create(this.gl, this.canvas.width, this.canvas.height);
    this.transitionTo.create(this.gl, this.canvas.width, this.canvas.height);
    this.finalOutput.create(this.gl, this.canvas.width, this.canvas.height);
    this.cinematicPipeline.resize(this.canvas.width, this.canvas.height);
  }

  async withOutputResolution<T>(
    width: number,
    height: number,
    task: () => Promise<T>,
  ): Promise<T> {
    const previous = this.forcedOutputResolution;

    await this.setOutputResolution(width, height);

    try {
      return await task();
    } finally {
      this.forcedOutputResolution = previous;
      if (previous) {
        await this.setOutputResolution(previous.width, previous.height);
      } else {
        await this.restorePreviewResolution();
      }
    }
  }

  setFrameSource(source: TexImageSource | null): void {
    this.frameSource = source;
  }

  preloadFilters(vertexShaderSource: string): void {
    this.cancelIdleFilterCompilation();
    this.vertexShaderSource = vertexShaderSource;

    if (this.gl) {
      this.cinematicPipeline.init(this.gl, vertexShaderSource);
    }

    // Compile the first visible filter synchronously. Everything else is
    // prepared in browser idle time, and setFilter still compiles on demand
    // if the user selects a filter before its idle preload runs.
    const initial = FILTER_REGISTRY.get(this.filter);
    const handle = this.compileProgram(
      initial.shaderKey,
      this.vertexShaderSource,
      getFilterFragmentShader(initial.id),
    );
    this.programs.set(initial.id, handle);
    this.scheduleIdleFilterCompilation();
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
      return;
    }

    this.transition = {
      from,
      to: filter,
      startedAt: now,
    };
  }

  setMasterOverlayEnabled(id: MasterOverlayId, enabled: boolean): void {
    this.masterOverlays[id] = enabled;
  }

  getMasterOverlayState(): Record<MasterOverlayId, boolean> {
    return { ...this.masterOverlays };
  }

  setUniform(name: string, value: UniformValue): void {
    this.uniforms.set(name, value);
  }

  setFaceTracking(state: FaceVfxUniformState): void {
    this.uniforms.set("u_face", state.face);
    this.uniforms.set("u_eyes", state.eyes);
    this.uniforms.set("u_mouth", state.mouth);
    this.uniforms.set("u_faceDetails", state.details);
    this.uniforms.set("u_faceMotion", state.motion);
    this.uniforms.set("u_faceMotionBurst", state.motionBurst);
    this.uniforms.set("u_facePresent", state.present);
  }

  setSceneOverlaySource(source: TexImageSource | null): void {
    this.sceneOverlaySource = source;
  }

  setHudText(text: string | null): void {
    const next = text?.trim() || null;
    if (this.hudText === next) return;
    this.hudText = next;
    this.hudDirty = true;
  }

  setOverlayText(text: string | null): void {
    const next = text?.trim() || null;
    if (this.overlayText === next) return;

    this.overlayText = next;
    this.overlayDirty = true;
  }

  render(timestamp = performance.now()): void {
    const gl = this.gl;

    if (!gl || !this.canvas || !this.vertexBuffer || !this.frameSource) return;

    const renderStart = performance.now();
    this.drawCallsThisFrame = 0;

    const frameTime =
      this.lastFrameAt === 0 ? 0 : timestamp - this.lastFrameAt;
    this.lastFrameAt = timestamp;

    const expectedSourceFps =
      this.getSourceFrameRate(this.frameSource) ??
      (this.metrics.fps > 0 ? Math.max(15, Math.min(120, this.metrics.fps)) : this.config.targetFps);
    if (frameTime > (1000 / expectedSourceFps) * 1.75) {
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

    this.syncPreviewProfile(sourceSize);
    this.videoResolutionUniform[0] = sourceSize.width;
    this.videoResolutionUniform[1] = sourceSize.height;

    this.textureManager.beginFrame();

    const uploadStart = performance.now();
    this.textureManager.uploadCurrent(
      gl,
      this.frameSource,
      sourceSize.width,
      sourceSize.height,
    );
    const uploadTime = performance.now() - uploadStart;

    const activeFilter = this.transition?.to ?? this.filter;
    this.directRenderState.transitionActive = Boolean(this.transition);
    this.directRenderState.sceneOverlayActive = Boolean(this.sceneOverlaySource);
    this.directRenderState.overlayPending = Boolean(this.overlayText || this.overlayDirty);
    this.directRenderState.hudPending = Boolean(this.hudText || this.hudDirty);
    this.directRenderState.masterOverlayActive =
      this.masterOverlays["cathode-crt"] ||
      this.masterOverlays["paper-film"];
    this.directRenderState.pipeline = FILTER_REGISTRY.get(activeFilter).pipeline;
    const directOutput = canRenderDirectToCanvas(this.directRenderState);
    const finalFramebuffer = directOutput ? null : this.finalOutput.get();
    if (!directOutput && !finalFramebuffer) return;

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
        this.renderCrossfade(
          fromTexture,
          toTexture,
          progress,
          finalFramebuffer,
        );
      }

      if (progress >= 1) {
        this.filter = this.transition.to;
        this.transition = null;
      }
    } else {
      this.renderFilterPass(
        finalFramebuffer,
        this.filter,
        timestamp,
        sourceSize,
      );
    }

    if (!directOutput) {
      if (this.sceneOverlaySource) {
        this.renderSceneOverlayPass(finalFramebuffer);
      }

      const finalTexture = this.finalOutput.getTexture();

      if (finalTexture) {
        this.cinematicPipeline.renderMasterOverlays(
          finalTexture,
          null,
          timestamp / 1000,
          this.masterOverlays["cathode-crt"],
          this.masterOverlays["paper-film"],
          Number(this.uniforms.get("u_faceMotionBurst") ?? 0),
        );
      }

      if (this.overlayText || this.overlayDirty) {
        this.renderOverlayPass();
      }

      if (this.hudText || this.hudDirty) {
        this.renderHudOverlayPass();
      }
    }

    const renderTime = performance.now() - renderStart;
    this.metrics = {
      ...this.metrics,
      renderTimeMs: this.metrics.renderTimeMs
        ? this.metrics.renderTimeMs * 0.8 + renderTime * 0.2
        : renderTime,
      textureUploadTimeMs: this.metrics.textureUploadTimeMs
        ? this.metrics.textureUploadTimeMs * 0.8 + uploadTime * 0.2
        : uploadTime,
      drawCalls: this.drawCallsThisFrame,
      gcEvents: this.gcEvents,
    };

    this.frameCounter += 1;

    if (this.frameCounter % 30 === 0) {
      const memory =
        typeof performance !== "undefined" &&
        "memory" in performance
          ? Number(
              (
                performance as Performance & {
                  memory?: { usedJSHeapSize?: number };
                }
              ).memory?.usedJSHeapSize ?? 0,
            )
          : 0;

      if (memory > 0) {
        this.metrics = {
          ...this.metrics,
          memoryUsedMb: memory / 1_000_000,
        };
      }

      if (!this.forcedOutputResolution) {
        this.applyAdaptivePolicy();
      }
    }
  }

  getMetrics(): RenderMetrics {
    return { ...this.metrics };
  }

  getFilter(): FilterId {
    return this.filter;
  }

  async waitForFilter(filter: FilterId, timeoutMs = 1200): Promise<void> {
    this.setFilter(filter);

    if (this.filter === filter && !this.transition) return;

    const startedAt = performance.now();

    await new Promise<void>((resolve, reject) => {
      const check = () => {
        if (this.filter === filter && !this.transition) {
          resolve();
          return;
        }

        if (performance.now() - startedAt >= timeoutMs) {
          reject(new Error("FILTER_NOT_READY"));
          return;
        }

        requestAnimationFrame(check);
      };

      check();
    });
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
    this.cancelIdleFilterCompilation();
    const gl = this.gl;

    if (gl) {
      if (this.vertexBuffer) gl.deleteBuffer(this.vertexBuffer);
      this.textureManager.destroy(gl);
      this.transitionFrom.destroy(gl);
      this.transitionTo.destroy(gl);
      this.finalOutput.destroy(gl);
      this.cinematicPipeline.destroy();
      this.shaderCache.clear(gl);
    }

    this.vertexBuffer = null;
    this.canvas = null;
    this.gl = null;
    this.frameSource = null;
    this.vertexShaderSource = "";
    this.filter = "op1um";
    this.transition = null;
    this.forcedOutputResolution = null;
    this.programs.clear();
    this.blendProgram = null;
    this.uniforms.clear();
    this.uniformLocations.clear();
    this.attributeLocations.clear();
    this.uniformValueCache.clear();

    if (gl) {
      if (this.overlayTexture) gl.deleteTexture(this.overlayTexture);
      if (this.sceneOverlayTexture) gl.deleteTexture(this.sceneOverlayTexture);
      if (this.hudTexture) gl.deleteTexture(this.hudTexture);
      if (this.lutTexture) gl.deleteTexture(this.lutTexture);
    }

    this.overlayTexture = null;
    this.sceneOverlayTexture = null;
    this.sceneOverlaySource = null;
    this.hudTexture = null;
    this.hudCanvas = null;
    this.hudText = null;
    this.hudDirty = false;
    this.lutTexture = null;
    this.overlayCanvas = null;
    this.overlayProgram = null;
    this.masterOverlays["cathode-crt"] = false;
    this.masterOverlays["paper-film"] = false;
    this.overlayText = null;
    this.overlayDirty = false;
    this.gcObserver?.disconnect();
    this.gcObserver = null;
    this.gcEvents = 0;
    this.lastFrameAt = 0;
    this.frameCounter = 0;
    this.previewProfileKey = "";
    this.sourceFrameRate = undefined;
    this.adaptivePreviewState = {
      renderScale: 1,
      dpr: 1,
      maxRenderScale: 1,
      maxDpr: 1,
      poorWindows: 0,
      healthyWindows: 0,
    };
  }

  private scheduleIdleFilterCompilation(): void {
    if (typeof window === "undefined") return;
    const idleWindow = window as IdleWindow;
    if (!idleWindow.requestIdleCallback) return;

    this.idleCompileQueue = FILTER_REGISTRY.listVisible()
      .map((definition) => definition.id)
      .filter((id) => !this.programs.has(id));

    const compileNext = (deadline: IdleDeadlineLike) => {
      this.idleCompileHandle = null;
      if (!this.gl || !this.canvas || !this.vertexShaderSource) return;

      // Avoid spending the next frame budget compiling a shader. Browsers
      // without requestIdleCallback compile a requested filter in setFilter.
      if (deadline.timeRemaining() < 8) {
        // Never force a compilation into a busy render loop. If the callback
        // already timed out, keep the remaining programs on-demand instead.
        if (deadline.didTimeout) {
          this.idleCompileQueue = [];
          return;
        }
        this.idleCompileHandle = idleWindow.requestIdleCallback!(compileNext, {
          timeout: 4000,
        });
        return;
      }

      const nextId = this.idleCompileQueue.shift();
      if (nextId && !this.programs.has(nextId)) {
        try {
          const definition = FILTER_REGISTRY.get(nextId);
          const handle = this.compileProgram(
            definition.shaderKey,
            this.vertexShaderSource,
            getFilterFragmentShader(nextId),
          );
          this.programs.set(nextId, handle);
        } catch {
          // Keep the camera usable. setFilter can retry compilation when the
          // user explicitly selects a filter whose idle compilation failed.
        }
      }

      if (this.idleCompileQueue.length > 0) {
        this.idleCompileHandle = idleWindow.requestIdleCallback!(compileNext, {
          timeout: 4000,
        });
      }
    };

    this.idleCompileHandle = idleWindow.requestIdleCallback(compileNext, {
      timeout: 1500,
    });
  }

  private cancelIdleFilterCompilation(): void {
    if (this.idleCompileHandle !== null && typeof window !== "undefined") {
      const idleWindow = window as IdleWindow;
      idleWindow.cancelIdleCallback?.(this.idleCompileHandle);
    }
    this.idleCompileHandle = null;
    this.idleCompileQueue = [];
  }

  private applyCanvasResolution(): void {
    if (!this.canvas) return;

    if (this.forcedOutputResolution) {
      this.canvas.width = Math.max(1, this.forcedOutputResolution.width);
      this.canvas.height = Math.max(1, this.forcedOutputResolution.height);
      return;
    }

    this.canvas.width = Math.max(
      1,
      Math.round(this.surfaceWidth * this.dpr * this.renderScale),
    );
    this.canvas.height = Math.max(
      1,
      Math.round(this.surfaceHeight * this.dpr * this.renderScale),
    );
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
    const definition = FILTER_REGISTRY.get(filter);

    if (!gl || !canvas || !vertexBuffer || !programHandle) return;

    const currentTexture = this.textureManager.getCurrent();
    const previousTexture = this.textureManager.getPrevious();

    if (!currentTexture || !previousTexture) return;

    if (definition.pipeline === "halation") {
      this.cinematicPipeline.renderHalation(
        currentTexture,
        framebuffer,
        timestamp / 1000,
        0.025,
        0.3,
        0.7,
      );
      return;
    }

    if (definition.pipeline === "kinetic-melt") {
      this.cinematicPipeline.renderKineticMelt(
        currentTexture,
        previousTexture,
        framebuffer,
        this.getTargetTexture(framebuffer),
        timestamp / 1000,
        0.08,
        0.02,
        0.92,
        Number(this.uniforms.get("u_faceMotion") ?? 0),
        Number(this.uniforms.get("u_faceMotionBurst") ?? 0),
      );
      return;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    this.bindProgram(programHandle.program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, currentTexture);
    this.setProgramUniform(programHandle.program, "u_texture", 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, previousTexture);
    this.setProgramUniform(programHandle.program, "u_previousFrame", 1);

    this.resolutionUniform[0] = canvas.width;
    this.resolutionUniform[1] = canvas.height;

    this.setProgramUniform(
      programHandle.program,
      "u_resolution",
      this.resolutionUniform,
    );
    this.setProgramUniform(
      programHandle.program,
      "u_videoResolution",
      this.videoResolutionUniform,
    );

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.lutTexture);
    this.setProgramUniform(programHandle.program, "u_lut", 2);

    this.uniforms.set("u_time", timestamp / 1000);

    const defaults = definition.defaults;
    this.setProgramUniform(programHandle.program, "u_intensity", defaults.intensity);
    this.setProgramUniform(programHandle.program, "u_noise", defaults.noise);
    this.setProgramUniform(programHandle.program, "u_distortion", defaults.distortion);
    this.setProgramUniform(programHandle.program, "u_chromatic", defaults.chromatic);
    this.setProgramUniform(programHandle.program, "u_feedback", defaults.feedback);

    const contract = getFilterShaderContract(filter);
    for (const parameter of contract?.parameters ?? []) {
      this.setProgramUniform(
        programHandle.program,
        parameter.name,
        parameter.defaultValue,
      );
    }

    if (filter === "cathode-crt") {
      this.setProgramUniform(programHandle.program, "uScanlineIntensity", 0.13);
      this.setProgramUniform(programHandle.program, "uApplyToAllFilters", 0);
    }

    if (filter === "paper-film") {
      this.setProgramUniform(programHandle.program, "uApplyToAllFilters", 0);
    }

    this.applyUniforms(programHandle.program);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.drawCallsThisFrame += 1;

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, null);
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
    framebuffer: WebGLFramebuffer | null,
  ): void {
    const gl = this.gl;
    const canvas = this.canvas;
    const vertexBuffer = this.vertexBuffer;
    const programHandle = this.blendProgram;

    if (!gl || !canvas || !vertexBuffer || !programHandle) return;

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
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
    this.drawCallsThisFrame += 1;

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.useProgram(null);
  }

  private copyTextureToScreen(texture: WebGLTexture): void {
    const gl = this.gl;
    const canvas = this.canvas;
    const vertexBuffer = this.vertexBuffer;
    const programHandle = this.overlayProgram;

    if (!gl || !canvas || !vertexBuffer || !programHandle) return;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    this.bindProgram(programHandle.program);

    gl.disable(gl.BLEND);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    this.setProgramUniform(programHandle.program, "u_overlay", 0);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.drawCallsThisFrame += 1;

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.useProgram(null);
  }

  private getTargetTexture(
    framebuffer: WebGLFramebuffer | null,
  ): WebGLTexture | null {
    if (!framebuffer) return null;
    if (framebuffer === this.finalOutput.get()) return this.finalOutput.getTexture();
    if (framebuffer === this.transitionFrom.get()) return this.transitionFrom.getTexture();
    if (framebuffer === this.transitionTo.get()) return this.transitionTo.getTexture();
    return null;
  }

  private configureOverlayTexture(texture: WebGLTexture): void {
    const gl = this.gl;
    if (!gl) return;

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  private updateSceneOverlayTexture(): void {
    const gl = this.gl;
    const source = this.sceneOverlaySource;
    const texture = this.sceneOverlayTexture;

    if (!gl || !source || !texture) return;

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      source,
    );
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
  }

  private updateOverlayTexture(): void {
    const gl = this.gl;
    const canvas = this.overlayCanvas;
    const texture = this.overlayTexture;

    if (!gl || !canvas || !texture) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);

    if (this.overlayText) {
      context.save();
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = "700 300px \"Space Mono\", ui-monospace, monospace";
      context.fillStyle = "rgba(245, 239, 230, 0.96)";
      context.shadowColor = "rgba(0, 0, 0, 0.85)";
      context.shadowBlur = 28;
      context.shadowOffsetX = 0;
      context.shadowOffsetY = 6;
      context.fillText(this.overlayText, canvas.width / 2, canvas.height / 2);
      context.restore();
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      canvas,
    );
    gl.bindTexture(gl.TEXTURE_2D, null);

    this.overlayDirty = false;
  }

  private renderSceneOverlayPass(framebuffer: WebGLFramebuffer | null = null): void {
    const gl = this.gl;
    const canvas = this.canvas;
    const texture = this.sceneOverlayTexture;
    const programHandle = this.overlayProgram;

    if (!gl || !canvas || !texture || !programHandle || !this.sceneOverlaySource) return;

    this.updateSceneOverlayTexture();

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.viewport(0, 0, canvas.width, canvas.height);
    this.bindProgram(programHandle.program);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    this.setProgramUniform(programHandle.program, "u_overlay", 0);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.drawCallsThisFrame += 1;

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.disable(gl.BLEND);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.useProgram(null);
  }

  private updateHudTexture(): void {
    const gl = this.gl;
    const canvas = this.hudCanvas;
    const texture = this.hudTexture;

    if (!gl || !canvas || !texture) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);

    if (this.hudText) {
      context.save();
      context.font = '700 42px "Space Mono", ui-monospace, monospace';
      context.textAlign = "left";
      context.textBaseline = "top";
      context.fillStyle = "rgba(138, 255, 177, 0.92)";
      context.shadowColor = "rgba(0, 0, 0, 0.92)";
      context.shadowBlur = 8;
      context.fillText(this.hudText, 32, 28);
      context.font = '700 20px "Space Mono", ui-monospace, monospace';
      context.fillStyle = "rgba(138, 255, 177, 0.58)";
      context.shadowBlur = 4;
      context.fillText("CCTV // LIVE // CAM 01", 34, 82);
      context.restore();
    }

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      canvas,
    );
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);

    this.hudDirty = false;
  }

  private renderHudOverlayPass(): void {
    const gl = this.gl;
    const canvas = this.canvas;
    const texture = this.hudTexture;
    const programHandle = this.overlayProgram;

    if (!gl || !canvas || !texture || !programHandle) return;

    if (this.hudDirty) {
      this.updateHudTexture();
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    this.bindProgram(programHandle.program);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    this.setProgramUniform(programHandle.program, "u_overlay", 0);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.drawCallsThisFrame += 1;

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.disable(gl.BLEND);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.useProgram(null);
  }

  private renderOverlayPass(): void {
    const gl = this.gl;
    const canvas = this.canvas;
    const texture = this.overlayTexture;
    const programHandle = this.overlayProgram;

    if (!gl || !canvas || !texture || !programHandle) return;

    if (this.overlayDirty) {
      this.updateOverlayTexture();
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    this.bindProgram(programHandle.program);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    this.setProgramUniform(programHandle.program, "u_overlay", 0);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.drawCallsThisFrame += 1;

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.disable(gl.BLEND);
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

    const cache = this.uniformValueCache.get(program) ?? new Map<string, UniformValue>();
    const previous = cache.get(name);

    if (previous !== undefined && this.uniformValuesEqual(previous, value)) {
      return;
    }

    const cacheValue = () => {
      cache.set(name, Array.isArray(value) ? [...value] : value);
      this.uniformValueCache.set(program, cache);
    };

    if (
      name === "u_texture" ||
      name === "u_previousFrame" ||
      name === "u_from" ||
      name === "u_to" ||
      name === "u_overlay" ||
      name === "u_lut"
    ) {
      gl.uniform1i(
        location,
        typeof value === "number" ? value : value[0] ?? 0,
      );
      cacheValue();
      return;
    }

    if (typeof value === "number") {
      gl.uniform1f(location, value);
      cacheValue();
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

    cacheValue();
  }

  private uniformValuesEqual(
    previous: UniformValue,
    next: UniformValue,
  ): boolean {
    if (typeof previous === "number" || typeof next === "number") {
      return previous === next;
    }

    if (previous.length !== next.length) return false;

    for (let index = 0; index < previous.length; index += 1) {
      if (previous[index] !== next[index]) return false;
    }

    return true;
  }

  private applyUniforms(program: WebGLProgram): void {
    this.uniforms.forEach((value, name) => {
      this.setProgramUniform(program, name, value);
    });
  }

  private startGcObserver(): void {
    if (this.gcObserver || typeof PerformanceObserver === "undefined") return;

    try {
      const supported = PerformanceObserver.supportedEntryTypes?.includes("gc");
      if (!supported) return;

      this.gcObserver = new PerformanceObserver((list) => {
        this.gcEvents += list.getEntries().length;
      });

      this.gcObserver.observe({
        type: "gc",
        buffered: true,
      } as unknown as PerformanceObserverInit);
    } catch {
      this.gcObserver = null;
    }
  }

  private getSourceFrameRate(source: TexImageSource | null): number | undefined {
    if (!source || typeof HTMLVideoElement === "undefined" || !(source instanceof HTMLVideoElement)) {
      return undefined;
    }
    const stream = source.srcObject as
      | { getVideoTracks?: () => Array<{ getSettings?: () => { frameRate?: number } }> }
      | null;
    const track = stream?.getVideoTracks?.()[0];
    try {
      const frameRate = track?.getSettings?.().frameRate;
      return typeof frameRate === "number" && Number.isFinite(frameRate) && frameRate > 0
        ? frameRate
        : undefined;
    } catch {
      return undefined;
    }
  }

  private syncPreviewProfile(sourceSize: SourceSize): void {
    if (!this.canvas || !this.gl || this.forcedOutputResolution) return;
    const frameRate = this.getSourceFrameRate(this.frameSource);
    const key = sourceSize.width + "x" + sourceSize.height + "@" + (frameRate ?? "unknown");
    if (key === this.previewProfileKey) return;

    this.previewProfileKey = key;
    this.sourceFrameRate = frameRate;
    const activeFilter = this.transition?.to ?? this.filter;
    const profile = getInitialPreviewProfile({
      deviceTier: this.metrics.deviceTier,
      sourceWidth: sourceSize.width,
      sourceHeight: sourceSize.height,
      sourceFrameRate: frameRate,
      devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
      filterComplexity: FILTER_REGISTRY.get(activeFilter).complexity,
    });
    this.adaptivePreviewState = {
      renderScale: profile.renderScale,
      dpr: profile.dpr,
      maxRenderScale: profile.maxRenderScale,
      maxDpr: profile.maxDpr,
      poorWindows: 0,
      healthyWindows: 0,
    };
    this.renderScale = profile.renderScale;
    this.dpr = profile.dpr;
    this.resize(this.surfaceWidth, this.surfaceHeight);
  }

  private applyAdaptivePolicy(): void {
    if (!this.canvas || !this.gl || this.forcedOutputResolution) return;

    const activeFilter = this.transition?.to ?? this.filter;
    const filterCap = getFilterRenderScaleCap(
      this.metrics.deviceTier,
      FILTER_REGISTRY.get(activeFilter).complexity,
    );
    const action = evaluateAdaptivePreview(
      this.metrics,
      this.sourceFrameRate ??
        (this.metrics.fps > 0 ? Math.max(15, Math.min(120, this.metrics.fps)) : undefined),
    );
    const next = stepAdaptivePreview(
      this.adaptivePreviewState,
      action,
      Math.min(this.adaptivePreviewState.maxRenderScale, filterCap),
    );
    const changed =
      Math.abs(next.renderScale - this.renderScale) >= 0.01 ||
      Math.abs(next.dpr - this.dpr) >= 0.01;
    this.adaptivePreviewState = next;
    if (!changed) return;

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

    const compileStart = performance.now();

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

    const compileTime = performance.now() - compileStart;
    this.metrics = {
      ...this.metrics,
      shaderCompileTimeMs: this.metrics.shaderCompileTimeMs
        ? this.metrics.shaderCompileTimeMs * 0.7 + compileTime * 0.3
        : compileTime,
    };

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