export class TextureManager {
  private texture: WebGLTexture | null = null;
  private width = 0;
  private height = 0;

  init(gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.width = 0;
    this.height = 0;
  }

  get(): WebGLTexture | null {
    return this.texture;
  }

  upload(gl: WebGLRenderingContext | WebGL2RenderingContext, source: TexImageSource, width: number, height: number): void {
    if (!this.texture) this.init(gl);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);

    if (this.width !== width || this.height !== height) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      this.width = width;
      this.height = height;
    } else {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, source);
    }

    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  destroy(gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    if (this.texture) gl.deleteTexture(this.texture);
    this.texture = null;
    this.width = 0;
    this.height = 0;
  }
}
