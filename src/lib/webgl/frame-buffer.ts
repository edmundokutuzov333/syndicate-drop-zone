export class FrameBuffer {
  private framebuffer: WebGLFramebuffer | null = null;
  private texture: WebGLTexture | null = null;
  private width = 0;
  private height = 0;

  create(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    width: number,
    height: number,
  ): void {
    this.destroy(gl);

    this.framebuffer = gl.createFramebuffer();
    this.texture = gl.createTexture();

    if (!this.framebuffer || !this.texture) return;

    this.width = width;
    this.height = height;

    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.texture,
      0,
    );

    const complete =
      gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    if (!complete) {
      this.destroy(gl);
    }
  }

  get(): WebGLFramebuffer | null {
    return this.framebuffer;
  }

  getTexture(): WebGLTexture | null {
    return this.texture;
  }

  getSize(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  destroy(gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    if (this.framebuffer) gl.deleteFramebuffer(this.framebuffer);
    if (this.texture) gl.deleteTexture(this.texture);

    this.framebuffer = null;
    this.texture = null;
    this.width = 0;
    this.height = 0;
  }
}