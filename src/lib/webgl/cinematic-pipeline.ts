import { FrameBuffer } from "./frame-buffer";
import {
  type MasterOverlayId,
} from "./filter-contract";
import halationIsolate from "@/shaders/camera/passes/halation-isolate.frag.glsl?raw";
import halationBlurH from "@/shaders/camera/passes/halation-blur-h.frag.glsl?raw";
import halationBlurV from "@/shaders/camera/passes/halation-blur-v.frag.glsl?raw";
import halationComposite from "@/shaders/camera/passes/halation-composite.frag.glsl?raw";
import kineticFlow from "@/shaders/camera/passes/kinetic-flow.frag.glsl?raw";
import kineticMelt from "@/shaders/camera/passes/kinetic-melt.frag.glsl?raw";
import masterCathode from "@/shaders/camera/passes/master-cathode.frag.glsl?raw";
import masterPaperFilm from "@/shaders/camera/passes/master-paper-film.frag.glsl?raw";

type Gl = WebGLRenderingContext | WebGL2RenderingContext;

const COPY_FRAGMENT = `precision mediump float;
uniform sampler2D u_input;
varying vec2 v_uv;
void main() {
  gl_FragColor = texture2D(u_input, v_uv);
}`;

export class CinematicPipeline {
  private gl: Gl | null = null;
  private vertexSource = "";
  private vertexBuffer: WebGLBuffer | null = null;
  private readonly programs = new Map<string, WebGLProgram>();
  private readonly attributes = new Map<WebGLProgram, number>();
  private readonly framebuffers = {
    a: new FrameBuffer(),
    b: new FrameBuffer(),
    feedbackA: new FrameBuffer(),
    feedbackB: new FrameBuffer(),
    motion: new FrameBuffer(),
    overlay: new FrameBuffer(),
  };
  private feedbackReady = false;
  private feedbackUsesA = true;
  private width = 0;
  private height = 0;
  private destroyed = false;

  init(gl: Gl, vertexSource: string): void {
    this.gl = gl;
    this.vertexSource = vertexSource;
    this.destroyed = false;

    if (!this.vertexBuffer) {
      this.vertexBuffer = gl.createBuffer();
      if (!this.vertexBuffer) throw new Error("WEBGL_CINEMATIC_VERTEX_BUFFER_FAILED");

      gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 3, -1, -1, 3]),
        gl.STATIC_DRAW,
      );
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    this.compile("cinematic:copy", COPY_FRAGMENT);
    this.compile("halation:isolate", halationIsolate);
    this.compile("halation:blur-h", halationBlurH);
    this.compile("halation:blur-v", halationBlurV);
    this.compile("halation:composite", halationComposite);
    this.compile("kinetic:flow", kineticFlow);
    this.compile("kinetic:melt", kineticMelt);
    this.compile("master:cathode-crt", masterCathode);
    this.compile("master:paper-film", masterPaperFilm);
  }

  resize(width: number, height: number): void {
    const gl = this.gl;
    if (!gl) return;

    this.width = Math.max(1, Math.round(width));
    this.height = Math.max(1, Math.round(height));

    for (const framebuffer of Object.values(this.framebuffers)) {
      framebuffer.create(gl, this.width, this.height);
    }
  }

  renderHalation(
    inputTexture: WebGLTexture,
    destination: WebGLFramebuffer | null,
    timeSeconds: number,
    glowRadius: number,
    halationIntensity: number,
    glowThreshold: number,
  ): void {
    const gl = this.gl;
    if (!gl || this.destroyed) return;

    this.ensureSize();

    const isolate = this.framebuffers.a.get();
    const blurH = this.framebuffers.b.get();
    const blurV = this.framebuffers.a.get();

    if (!isolate || !blurH || !blurV) return;

    this.draw(
      "halation:isolate",
      isolate,
      inputTexture,
      0,
      undefined,
      0,
      timeSeconds,
      glowThreshold,
      glowRadius,
      0,
      0,
      null,
    );

    const isolatedTexture = this.framebuffers.a.getTexture();
    if (!isolatedTexture) return;

    this.draw(
      "halation:blur-h",
      blurH,
      isolatedTexture,
      0,
      undefined,
      0,
      timeSeconds,
      glowThreshold,
      glowRadius,
      0,
      0,
      null,
    );

    const horizontalTexture = this.framebuffers.b.getTexture();
    if (!horizontalTexture) return;

    this.draw(
      "halation:blur-v",
      blurV,
      horizontalTexture,
      0,
      undefined,
      0,
      timeSeconds,
      glowThreshold,
      glowRadius,
      0,
      0,
      null,
    );

    const verticalTexture = this.framebuffers.a.getTexture();
    if (!verticalTexture) return;

    this.draw(
      "halation:composite",
      destination,
      inputTexture,
      0,
      verticalTexture,
      3,
      timeSeconds,
      glowThreshold,
      glowRadius,
      halationIntensity,
      0,
      null,
    );
  }

  renderKineticMelt(
    inputTexture: WebGLTexture,
    previousFrameTexture: WebGLTexture,
    destination: WebGLFramebuffer | null,
    destinationTexture: WebGLTexture | null,
    timeSeconds: number,
    meltStrength: number,
    velocityThreshold: number,
    persistence: number,
    faceMotion: number,
    faceMotionBurst: number,
  ): void {
    const gl = this.gl;
    if (!gl || this.destroyed) return;

    this.ensureSize();

    const motionFramebuffer = this.framebuffers.motion.get();
    const feedbackFramebuffer = this.feedbackUsesA
      ? this.framebuffers.feedbackA.get()
      : this.framebuffers.feedbackB.get();

    if (!motionFramebuffer || !feedbackFramebuffer) return;

    const feedbackTexture = this.feedbackReady
      ? (
          this.feedbackUsesA
            ? this.framebuffers.feedbackA.getTexture()
            : this.framebuffers.feedbackB.getTexture()
        )
      : previousFrameTexture;

    if (!feedbackTexture) return;

    this.drawFlow(
      motionFramebuffer,
      inputTexture,
      previousFrameTexture,
      timeSeconds,
    );

    const motionTexture = this.framebuffers.motion.getTexture();
    if (!motionTexture) return;

    this.drawMelt(
      destination,
      inputTexture,
      previousFrameTexture,
      motionTexture,
      feedbackTexture,
      timeSeconds,
      meltStrength,
      velocityThreshold,
      persistence,
      faceMotion,
      faceMotionBurst,
    );

    if (destinationTexture && feedbackFramebuffer) {
      this.drawCopy(feedbackFramebuffer, destinationTexture);
      this.feedbackUsesA = !this.feedbackUsesA;
      this.feedbackReady = true;
    }
  }

  renderMasterOverlays(
    inputTexture: WebGLTexture,
    destination: WebGLFramebuffer | null,
    timeSeconds: number,
    cathodeEnabled: boolean,
    paperFilmEnabled: boolean,
    faceMotionBurst: number,
  ): void {
    const gl = this.gl;
    if (!gl || this.destroyed) return;

    this.ensureSize();

    const enabled: MasterOverlayId[] = [];
    if (cathodeEnabled) enabled.push("cathode-crt");
    if (paperFilmEnabled) enabled.push("paper-film");

    if (enabled.length === 0) {
      this.drawCopy(destination, inputTexture);
      return;
    }

    let source = inputTexture;
    const scratch = this.framebuffers.overlay.get();

    for (let index = 0; index < enabled.length; index += 1) {
      const id = enabled[index];
      const isLast = index === enabled.length - 1;
      const target = isLast ? destination : scratch;

      if (id === "cathode-crt") {
        this.draw(
          "master:cathode-crt",
          target,
          source,
          0,
          null,
          0,
          timeSeconds,
          0.0,
          0.12,
          0.008,
          0,
          faceMotionBurst,
        );
      } else {
        this.drawPaperFilm(
          target,
          source,
          timeSeconds,
          0.06,
          0.4,
          0.001,
        );
      }

      if (!isLast) {
        source = this.framebuffers.overlay.getTexture() ?? source;
      }
    }
  }

  resetFeedback(): void {
    this.feedbackReady = false;
    this.feedbackUsesA = true;
  }

  destroy(): void {
    const gl = this.gl;
    if (!gl) return;

    for (const framebuffer of Object.values(this.framebuffers)) {
      framebuffer.destroy(gl);
    }

    if (this.vertexBuffer) {
      gl.deleteBuffer(this.vertexBuffer);
    }

    for (const program of this.programs.values()) {
      gl.deleteProgram(program);
    }

    this.programs.clear();
    this.attributes.clear();
    this.vertexBuffer = null;
    this.gl = null;
    this.vertexSource = "";
    this.width = 0;
    this.height = 0;
    this.destroyed = true;
    this.feedbackReady = false;
  }

  private ensureSize(): void {
    const gl = this.gl;
    if (!gl || this.width <= 0 || this.height <= 0) return;

    for (const framebuffer of Object.values(this.framebuffers)) {
      framebuffer.create(gl, this.width, this.height);
    }
  }

  private compile(key: string, fragmentSource: string): WebGLProgram {
    const gl = this.gl;
    if (!gl) throw new Error("WEBGL_NOT_INITIALIZED");

    const existing = this.programs.get(key);
    if (existing) return existing;

    const vertex = gl.createShader(gl.VERTEX_SHADER);
    const fragment = gl.createShader(gl.FRAGMENT_SHADER);
    const program = gl.createProgram();

    if (!vertex || !fragment || !program) {
      throw new Error("WEBGL_CINEMATIC_SHADER_CREATE_FAILED");
    }

    gl.shaderSource(vertex, this.vertexSource);
    gl.compileShader(vertex);

    if (!gl.getShaderParameter(vertex, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(vertex) ?? "UNKNOWN";
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      gl.deleteProgram(program);
      throw new Error("WEBGL_CINEMATIC_VERTEX_COMPILE_FAILED: " + info);
    }

    gl.shaderSource(fragment, fragmentSource);
    gl.compileShader(fragment);

    if (!gl.getShaderParameter(fragment, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(fragment) ?? "UNKNOWN";
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      gl.deleteProgram(program);
      throw new Error("WEBGL_CINEMATIC_FRAGMENT_COMPILE_FAILED: " + info);
    }

    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program) ?? "UNKNOWN";
      gl.deleteProgram(program);
      throw new Error("WEBGL_CINEMATIC_PROGRAM_LINK_FAILED: " + info);
    }

    this.programs.set(key, program);
    return program;
  }

  private draw(
    key: string,
    framebuffer: WebGLFramebuffer | null,
    inputTexture: WebGLTexture,
    inputUnit: number,
    auxiliaryTexture: WebGLTexture | null | undefined,
    auxiliaryUnit: number,
    timeSeconds: number,
    glowThreshold: number,
    glowRadius: number,
    intensity: number,
    extra: number,
    faceMotionBurst: number | null,
  ): void {
    const gl = this.gl;
    if (!gl || !this.vertexBuffer) return;

    const program = this.programs.get(key);
    if (!program) return;

    this.bindProgram(program, framebuffer);

    this.bindTexture(program, "u_input", inputTexture, inputUnit);

    if (auxiliaryTexture) {
      this.bindTexture(program, "u_glow", auxiliaryTexture, auxiliaryUnit);
    }

    this.setUniform1f(program, "u_time", timeSeconds);
    this.setUniform2f(program, "u_resolution", this.width, this.height);
    this.setUniform1f(program, "uGlowThreshold", glowThreshold);
    this.setUniform1f(program, "uGlowRadius", glowRadius);
    this.setUniform1f(program, "uHalationIntensity", intensity);
    this.setUniform1f(program, "uDistortionK", glowRadius);
    this.setUniform1f(program, "uScanlineCount", 800);
    this.setUniform1f(program, "uChromaticOffset", 0.008 + intensity * 0.0);

    if (key.startsWith("master:")) {
      this.setUniform1f(program, "uApplyToAllFilters", 1);
    }

    if (faceMotionBurst !== null) {
      this.setUniform1f(program, "u_faceMotionBurst", faceMotionBurst);
    }

    void extra;

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.cleanup(program);
  }

  private drawFlow(
    framebuffer: WebGLFramebuffer,
    inputTexture: WebGLTexture,
    previousTexture: WebGLTexture,
    timeSeconds: number,
  ): void {
    const gl = this.gl;
    const program = this.programs.get("kinetic:flow");
    if (!gl || !program) return;

    this.bindProgram(program, framebuffer);
    this.bindTexture(program, "u_input", inputTexture, 0);
    this.bindTexture(program, "u_previousFrame", previousTexture, 1);
    this.setUniform2f(program, "u_resolution", this.width, this.height);
    this.setUniform1f(program, "u_time", timeSeconds);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.cleanup(program);
  }

  private drawMelt(
    framebuffer: WebGLFramebuffer | null,
    inputTexture: WebGLTexture,
    previousTexture: WebGLTexture,
    motionTexture: WebGLTexture,
    feedbackTexture: WebGLTexture,
    timeSeconds: number,
    meltStrength: number,
    velocityThreshold: number,
    persistence: number,
    faceMotion: number,
    faceMotionBurst: number,
  ): void {
    const gl = this.gl;
    const program = this.programs.get("kinetic:melt");
    if (!gl || !program) return;

    this.bindProgram(program, framebuffer);

    this.bindTexture(program, "u_input", inputTexture, 0);
    this.bindTexture(program, "u_previousFrame", previousTexture, 1);
    this.bindTexture(program, "u_motion", motionTexture, 2);
    this.bindTexture(program, "u_feedback", feedbackTexture, 3);

    this.setUniform1f(program, "uMeltStrength", meltStrength);
    this.setUniform1f(program, "uVelocityThreshold", velocityThreshold);
    this.setUniform1f(program, "uPersistence", persistence);
    this.setUniform1f(program, "u_faceMotion", faceMotion);
    this.setUniform1f(program, "u_faceMotionBurst", faceMotionBurst);
    this.setUniform1f(program, "u_time", timeSeconds);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.cleanup(program);
  }

  private drawPaperFilm(
    framebuffer: WebGLFramebuffer | null,
    inputTexture: WebGLTexture,
    timeSeconds: number,
    grainIntensity: number,
    dirtFrequency: number,
    jitterAmount: number,
  ): void {
    const gl = this.gl;
    const program = this.programs.get("master:paper-film");
    if (!gl || !program) return;

    this.bindProgram(program, framebuffer);
    this.bindTexture(program, "u_input", inputTexture, 0);
    this.setUniform1f(program, "u_time", timeSeconds);
    this.setUniform1f(program, "uGrainIntensity", grainIntensity);
    this.setUniform1f(program, "uDirtFrequency", dirtFrequency);
    this.setUniform1f(program, "uJitterAmount", jitterAmount);
    this.setUniform1f(program, "uApplyToAllFilters", 1);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.cleanup(program);
  }

  private drawCopy(
    framebuffer: WebGLFramebuffer | null,
    inputTexture: WebGLTexture,
  ): void {
    const gl = this.gl;
    const program = this.programs.get("cinematic:copy");
    if (!gl || !program) return;

    this.bindProgram(program, framebuffer);
    this.bindTexture(program, "u_input", inputTexture, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.cleanup(program);
  }

  private bindProgram(program: WebGLProgram, framebuffer: WebGLFramebuffer | null): void {
    const gl = this.gl;
    if (!gl || !this.vertexBuffer) return;

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.viewport(0, 0, this.width, this.height);
    gl.disable(gl.BLEND);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    const attribute = this.attributes.get(program) ?? gl.getAttribLocation(program, "a_position");

    if (attribute >= 0) {
      this.attributes.set(program, attribute);
      gl.enableVertexAttribArray(attribute);
      gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
    }

    gl.useProgram(program);
  }

  private bindTexture(program: WebGLProgram, name: string, texture: WebGLTexture, unit: number): void {
    const gl = this.gl;
    if (!gl) return;

    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    const location = gl.getUniformLocation(program, name);
    if (location) gl.uniform1i(location, unit);
  }

  private setUniform1f(program: WebGLProgram, name: string, value: number): void {
    const gl = this.gl;
    if (!gl) return;

    const location = gl.getUniformLocation(program, name);
    if (location) gl.uniform1f(location, value);
  }

  private setUniform2f(program: WebGLProgram, name: string, x: number, y: number): void {
    const gl = this.gl;
    if (!gl) return;

    const location = gl.getUniformLocation(program, name);
    if (location) gl.uniform2f(location, x, y);
  }

  private cleanup(program: WebGLProgram): void {
    const gl = this.gl;
    if (!gl) return;

    for (let unit = 0; unit < 5; unit += 1) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, null);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.disableVertexAttribArray(this.attributes.get(program) ?? 0);
    gl.useProgram(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private getFramebufferTexture(framebuffer: WebGLFramebuffer): WebGLTexture | null {
    const entries = Object.values(this.framebuffers);
    for (const entry of entries) {
      if (entry.get() === framebuffer) return entry.getTexture();
    }
    return null;
  }
}
