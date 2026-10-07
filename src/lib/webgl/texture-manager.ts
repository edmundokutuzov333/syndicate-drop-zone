export class TextureManager {
  private textures: [WebGLTexture | null, WebGLTexture | null] = [null, null];
  private currentIndex = 0;
  private width = 0;
  private height = 0;
  private hasFrame = false;

  init(gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    this.destroy(gl);

    this.textures = [gl.createTexture(), gl.createTexture()];
    this.configure(gl, this.textures[0]);
    this.configure(gl, this.textures[1]);

    this.currentIndex = 0;
    this.width = 0;
    this.height = 0;
    this.hasFrame = false;
  }

  beginFrame(): void {
    this.currentIndex = 1 - this.currentIndex;
  }

  uploadCurrent(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    source: TexImageSource,
    width: number,
    height: number,
  ): void {
    if (!this.textures[0] || !this.textures[1]) {
      this.init(gl);
    }

    const current = this.textures[this.currentIndex];
    const previous = this.textures[1 - this.currentIndex];

    if (!current || !previous) return;

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);

    const dimensionsChanged = this.width !== width || this.height !== height;

    gl.bindTexture(gl.TEXTURE_2D, current);

    if (dimensionsChanged) {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        source,
      );

      gl.bindTexture(gl.TEXTURE_2D, previous);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        source,
      );
      this.hasFrame = true;
    } else if (!this.hasFrame) {
      gl.bindTexture(gl.TEXTURE_2D, previous);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        source,
      );
      this.hasFrame = true;
    } else {
      gl.bindTexture(gl.TEXTURE_2D, current);
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        source,
      );
    }

    gl.bindTexture(gl.TEXTURE_2D, null);

    this.width = width;
    this.height = height;
  }

  getCurrent(): WebGLTexture | null {
    return this.textures[this.currentIndex];
  }

  getPrevious(): WebGLTexture | null {
    return this.textures[1 - this.currentIndex];
  }

  destroy(gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    this.textures.forEach((texture) => {
      if (texture) gl.deleteTexture(texture);
    });

    this.textures = [null, null];
    this.currentIndex = 0;
    this.width = 0;
    this.height = 0;
    this.hasFrame = false;
  }

  private configure(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    texture: WebGLTexture | null,
  ): void {
    if (!texture) return;

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }
}