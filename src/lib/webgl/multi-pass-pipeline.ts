import { FrameBuffer } from "./frame-buffer";

export type MultiPassRenderFn = (
  passIndex: number,
  inputTexture: WebGLTexture,
  outputFramebuffer: WebGLFramebuffer,
) => void;

export class MultiPassPipeline {
  private readonly buffers = [new FrameBuffer(), new FrameBuffer()];
  private width = 0;
  private height = 0;

  ensure(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    width: number,
    height: number,
  ): void {
    if (this.width === width && this.height === height) return;

    this.width = width;
    this.height = height;

    for (const buffer of this.buffers) {
      buffer.create(gl, width, height);
    }
  }

  run(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    inputTexture: WebGLTexture,
    passCount: number,
    renderPass: MultiPassRenderFn,
  ): WebGLTexture | null {
    if (passCount <= 0) return inputTexture;

    this.ensure(gl, this.width, this.height);

    let input = inputTexture;
    let targetIndex = 0;

    for (let passIndex = 0; passIndex < passCount; passIndex += 1) {
      const target = this.buffers[targetIndex];
      const framebuffer = target.get();

      if (!framebuffer) return null;

      renderPass(passIndex, input, framebuffer);
      input = target.getTexture() ?? input;
      targetIndex = targetIndex === 0 ? 1 : 0;
    }

    return input;
  }

  resize(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    width: number,
    height: number,
  ): void {
    this.width = width;
    this.height = height;

    for (const buffer of this.buffers) {
      buffer.create(gl, width, height);
    }
  }

  destroy(gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    for (const buffer of this.buffers) {
      buffer.destroy(gl);
    }

    this.width = 0;
    this.height = 0;
  }
}
