import * as THREE from "three";
import {
  BloomEffect,
  EffectComposer,
  EffectPass,
  NoiseEffect,
  RenderPass,
  SMAAEffect,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from "postprocessing";

export type RenderPipeline = {
  composer: EffectComposer;
  resize: (width: number, height: number, pixelRatio: number) => void;
  render: (deltaSeconds: number) => void;
  dispose: () => void;
};

export function createRenderPipeline(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: { bloom?: boolean; smaa?: boolean; noise?: boolean } = {},
): RenderPipeline {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
  composer.addPass(new RenderPass(scene, camera));
  const effects = [
    options.bloom === false ? null : new BloomEffect({ intensity: 0.8, luminanceThreshold: 1.05, mipmapBlur: true }),
    new ToneMappingEffect({ mode: ToneMappingMode.AGX }),
    new VignetteEffect({ darkness: 0.22, offset: 0.35 }),
    options.noise === false ? null : new NoiseEffect({ premultiply: true, blendFunction: 5 }),
    options.smaa === false ? null : new SMAAEffect(),
  ].filter((effect): effect is NonNullable<typeof effect> => effect !== null);
  composer.addPass(new EffectPass(camera, ...effects));
  return {
    composer,
    resize: (width, height, pixelRatio) => {
      renderer.setPixelRatio(pixelRatio);
      composer.setSize(width, height);
    },
    render: (deltaSeconds) => composer.render(deltaSeconds),
    dispose: () => composer.dispose(),
  };
}
