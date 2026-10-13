// Captura a cena de produção como panorama equirectangular para comparação de fidelidade.
// A imagem de referência original não é servida pelo site: o score usa estatísticas CIE Lab
// derivadas do anexo original e o overlay recebe a imagem apenas quando o operador a selecciona.
import * as THREE from "three";
import type { Rgba } from "./sector-stats";

export function renderEquirect(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  eye: THREE.Vector3,
  width = 1774,
  height = 887,
  cubeSize = 1024,
): Rgba {
  const previousTarget = renderer.getRenderTarget();
  const previousViewport = renderer.getViewport(new THREE.Vector4());
  const previousScissor = renderer.getScissor(new THREE.Vector4());
  const previousScissorTest = renderer.getScissorTest();
  const previousAutoClear = renderer.autoClear;
  const previousClearColor = renderer.getClearColor(new THREE.Color()).clone();
  const previousClearAlpha = renderer.getClearAlpha();
  const renderTarget = new THREE.WebGLCubeRenderTarget(cubeSize, {
    type: THREE.HalfFloatType,
    generateMipmaps: false,
    colorSpace: THREE.LinearSRGBColorSpace,
  });
  const cubeCamera = new THREE.CubeCamera(0.05, 70, renderTarget);
  const output = new THREE.WebGLRenderTarget(width, height, {
    type: THREE.UnsignedByteType,
    format: THREE.RGBAFormat,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
    colorSpace: THREE.SRGBColorSpace,
  });
  const quadGeometry = new THREE.PlaneGeometry(2, 2);
  const quadMaterial = new THREE.ShaderMaterial({
    uniforms: { tCube: { value: renderTarget.texture } },
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    vertexShader: /* glsl */ `varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `precision highp float;
      uniform samplerCube tCube;
      varying vec2 vUv;
      void main(){
        float az = vUv.x * 6.28318530718;
        float el = (vUv.y - 0.5) * 3.14159265359;
        float c = cos(el);
        vec3 d = vec3(sin(az) * c, sin(el), -cos(az) * c);
        vec3 col = textureCube(tCube, d).rgb;
        col = col / (vec3(1.0) + col);
        gl_FragColor = vec4(pow(max(col, vec3(0.0)), vec3(1.0 / 2.2)), 1.0);
      }`,
  });
  const quad = new THREE.Mesh(quadGeometry, quadMaterial);
  const captureScene = new THREE.Scene();
  captureScene.add(quad);
  const captureCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  try {
    scene.add(cubeCamera);
    cubeCamera.position.copy(eye);
    cubeCamera.update(renderer, scene);
    scene.remove(cubeCamera);

    renderer.setRenderTarget(output);
    renderer.setViewport(0, 0, width, height);
    renderer.setScissorTest(false);
    renderer.autoClear = true;
    renderer.render(captureScene, captureCamera);
    const raw = new Uint8Array(width * height * 4);
    renderer.readRenderTargetPixels(output, 0, 0, width, height, raw);
    const data = new Uint8ClampedArray(raw.length);
    for (let y = 0; y < height; y += 1) {
      const sourceRow = (height - 1 - y) * width * 4;
      data.set(raw.subarray(sourceRow, sourceRow + width * 4), y * width * 4);
    }
    return { data, width, height };
  } finally {
    scene.remove(cubeCamera);
    renderer.setRenderTarget(previousTarget);
    renderer.setViewport(previousViewport);
    renderer.setScissor(previousScissor);
    renderer.setScissorTest(previousScissorTest);
    renderer.setClearColor(previousClearColor, previousClearAlpha);
    renderer.autoClear = previousAutoClear;
    output.dispose();
    renderTarget.dispose();
    quadMaterial.dispose();
    quadGeometry.dispose();
  }
}

export function rgbaToDataUrl(image: Rgba): string {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is unavailable for the CAMPING reference capture.");
  context.putImageData(new ImageData(image.data, image.width, image.height), 0, 0);
  return canvas.toDataURL("image/png");
}

export function createDifferenceImage(reference: Rgba, rendered: Rgba, amplification = 4): Rgba {
  if (reference.width !== rendered.width || reference.height !== rendered.height) {
    throw new Error("Reference and rendered panorama dimensions must match.");
  }
  const data = new Uint8ClampedArray(reference.data.length);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, Math.abs((reference.data[i] ?? 0) - (rendered.data[i] ?? 0)) * amplification);
    data[i + 1] = Math.min(255, Math.abs((reference.data[i + 1] ?? 0) - (rendered.data[i + 1] ?? 0)) * amplification);
    data[i + 2] = Math.min(255, Math.abs((reference.data[i + 2] ?? 0) - (rendered.data[i + 2] ?? 0)) * amplification);
    data[i + 3] = 255;
  }
  return { data, width: reference.width, height: reference.height };
}
