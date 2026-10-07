export class FrameBuffer {
  private framebuffer: WebGLFramebuffer | null = null;
  private texture: WebGLTexture | null = null;
  create(gl: WebGLRenderingContext | WebGL2RenderingContext, width: number, height: number): void {
    this.destroy(gl);
    this.framebuffer = gl.createFramebuffer();
    this.texture = gl.createTexture();
    if (!this.framebuffer || !this.texture) return;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }
  get(): WebGLFramebuffer | null { return this.framebuffer; }
  destroy(gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    if (this.framebuffer) gl.deleteFramebuffer(this.framebuffer);
    if (this.texture) gl.deleteTexture(this.texture);
    this.framebuffer = null;
    this.texture = null;
  }
}
