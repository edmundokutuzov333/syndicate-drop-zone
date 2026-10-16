import { type ShaderProgramHandle } from "@/lib/camera/types";

export class ShaderCache {
  private readonly programs = new Map<string, WebGLProgram>();
  get(key: string): ShaderProgramHandle | null {
    const program = this.programs.get(key);
    return program ? { key, program } : null;
  }
  set(key: string, program: WebGLProgram): ShaderProgramHandle {
    this.programs.set(key, program);
    return { key, program };
  }
  has(key: string): boolean { return this.programs.has(key); }
  clear(gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    this.programs.forEach((program) => gl.deleteProgram(program));
    this.programs.clear();
  }
}
