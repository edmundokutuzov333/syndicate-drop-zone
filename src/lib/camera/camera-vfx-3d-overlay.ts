import * as THREE from "three";
import type {
  CameraFacingMode,
  FaceVfxUniformState,
  FilterId,
} from "./types";

const OVERLAY_SCALE = 0.72;
const AMBIENT_WIDTH = 64;
const AMBIENT_HEIGHT = 32;

function createLensMaterial(color: number, transmission: number) {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.04,
    roughness: 0.12,
    transmission,
    thickness: 0.12,
    ior: 1.45,
    transparent: true,
    opacity: 0.9,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    iridescence: 0.12,
    iridescenceIOR: 1.33,
    envMapIntensity: 1.7,
  });
}

export class CameraVfx3DOverlay {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100);
  private readonly glasses = new THREE.Group();
  private readonly ambientCanvas = document.createElement("canvas");
  private readonly ambientContext: CanvasRenderingContext2D;
  private readonly ambientTexture: THREE.CanvasTexture;
  private readonly particleMaterial: THREE.ShaderMaterial;
  private readonly particles: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private lastAmbientAt = -Infinity;
  private destroyed = false;
  private activeFilter: FilterId | null = null;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.setAttribute("aria-hidden", "true");
    this.canvas.width = 1;
    this.canvas.height = 1;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: false,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });

    this.renderer.setPixelRatio(1);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.camera.position.set(0, 0, 4.25);

    this.ambientCanvas.width = AMBIENT_WIDTH;
    this.ambientCanvas.height = AMBIENT_HEIGHT;
    const context = this.ambientCanvas.getContext("2d", {
      willReadFrequently: false,
    });

    if (!context) {
      throw new Error("VFX_AMBIENT_CANVAS_UNAVAILABLE");
    }

    this.ambientContext = context;
    this.ambientTexture = new THREE.CanvasTexture(this.ambientCanvas);
    this.ambientTexture.colorSpace = THREE.SRGBColorSpace;
    this.ambientTexture.mapping = THREE.EquirectangularReflectionMapping;
    this.ambientTexture.needsUpdate = true;
    this.scene.environment = this.ambientTexture;

    this.scene.add(new THREE.HemisphereLight(0x9ac6ff, 0x06100c, 1.1));

    const keyLight = new THREE.DirectionalLight(0xd9e7ff, 1.4);
    keyLight.position.set(-2.2, 2.4, 3.0);
    this.scene.add(keyLight);

    const rimLight = new THREE.PointLight(0xff4c96, 2.2, 8);
    rimLight.position.set(1.4, 0.9, 2.8);
    this.scene.add(rimLight);

    this.buildGlasses();
    this.particleMaterial = this.createParticleMaterial();
    this.particles = this.createParticles();
    this.scene.add(this.particles);
    this.scene.add(this.glasses);
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  resize(width: number, height: number): void {
    const safeWidth = Math.max(1, Math.floor(width * OVERLAY_SCALE));
    const safeHeight = Math.max(1, Math.floor(height * OVERLAY_SCALE));

    this.canvas.width = safeWidth;
    this.canvas.height = safeHeight;
    this.renderer.setSize(safeWidth, safeHeight, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  update(
    filter: FilterId,
    state: FaceVfxUniformState,
    facingMode: CameraFacingMode,
    timestamp: number,
    video: HTMLVideoElement,
  ): void {
    if (this.destroyed) return;

    this.activeFilter = filter;
    this.glasses.visible = filter === "vamp" && state.present > 0.5;
    this.particles.visible = filter === "astro-haze";

    if (timestamp - this.lastAmbientAt >= 100) {
      if (
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        video.videoWidth > 0 &&
        video.videoHeight > 0
      ) {
        this.ambientContext.drawImage(
          video,
          0,
          0,
          AMBIENT_WIDTH,
          AMBIENT_HEIGHT,
        );
        this.ambientTexture.needsUpdate = true;
      }
      this.lastAmbientAt = timestamp;
    }

    const mirrorX = facingMode === "user"
      ? 1 - state.face[0]
      : state.face[0];

    const aspect = this.camera.aspect || 1;
    const faceX = (mirrorX - 0.5) * 2.2 * aspect;
    const faceY = (0.5 - state.face[1]) * 1.8;

    const faceScale = THREE.MathUtils.clamp(state.face[2] * 4.2, 0.46, 1.7);

    this.glasses.position.set(faceX, faceY, 0.0);
    this.glasses.scale.setScalar(faceScale);
    this.glasses.rotation.set(
      state.pose[1] * 0.62,
      state.pose[0] * 0.72,
      -state.pose[2],
    );

    this.glasses.rotation.z += Math.sin(timestamp * 0.0018) * 0.006;

    this.particleMaterial.uniforms.uTime.value = timestamp * 0.001;
    this.particleMaterial.uniforms.uMotion.value = state.motion;
    this.particleMaterial.uniforms.uAmbient.value = this.ambientTexture;
  }

  render(): void {
    if (this.destroyed) return;
    this.renderer.render(this.scene, this.camera);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh | THREE.Points;
      if (mesh.geometry) mesh.geometry.dispose();

      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((material) => material.dispose());
      } else if (mesh.material) {
        mesh.material.dispose();
      }
    });

    this.ambientTexture.dispose();
    this.renderer.dispose();
    this.activeFilter = null;
  }

  private buildGlasses(): void {
    const frameMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x050607,
      metalness: 0.62,
      roughness: 0.14,
      clearcoat: 1,
      clearcoatRoughness: 0.035,
      envMapIntensity: 2.2,
    });

    const lensMaterial = createLensMaterial(0x10171e, 0.66);

    const lensGeometry = new THREE.PlaneGeometry(0.48, 0.30);
    const frameGeometry = new THREE.TorusGeometry(0.5, 0.027, 16, 56);
    const bridgeGeometry = new THREE.BoxGeometry(0.24, 0.045, 0.055);
    const templeGeometry = new THREE.BoxGeometry(0.52, 0.028, 0.035);

    for (const direction of [-1, 1]) {
      const lens = new THREE.Mesh(lensGeometry, lensMaterial.clone());
      lens.scale.x = 0.92;
      lens.scale.y = 0.72;
      lens.position.set(direction * 0.33, 0, 0.055);
      lens.rotation.x = 0.02 * direction;

      const frame = new THREE.Mesh(frameGeometry, frameMaterial);
      frame.scale.set(1.08, 0.72, 1);
      frame.position.set(direction * 0.33, 0, 0.11);
      frame.rotation.x = Math.PI * 0.5;

      const accent = new THREE.Mesh(
        new THREE.BoxGeometry(0.30, 0.014, 0.018),
        new THREE.MeshPhysicalMaterial({
          color: direction < 0 ? 0x0c8090 : 0x7d154e,
          metalness: 0.78,
          roughness: 0.14,
          emissive: direction < 0 ? 0x05313a : 0x2d061d,
          emissiveIntensity: 1.3,
        }),
      );
      accent.position.set(direction * 0.33, 0.185, 0.085);

      this.glasses.add(lens, frame, accent);
    }

    const bridge = new THREE.Mesh(bridgeGeometry, frameMaterial);
    bridge.position.z = 0.11;
    this.glasses.add(bridge);

    const leftTemple = new THREE.Mesh(templeGeometry, frameMaterial);
    leftTemple.position.set(-0.82, 0, 0.02);
    leftTemple.rotation.z = -0.02;

    const rightTemple = new THREE.Mesh(templeGeometry, frameMaterial);
    rightTemple.position.set(0.82, 0, 0.02);
    rightTemple.rotation.z = 0.02;

    this.glasses.add(leftTemple, rightTemple);
  }

  private createParticleMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uMotion: { value: 0 },
        uAmbient: { value: this.ambientTexture },
      },
      vertexShader: `
        attribute float aSeed;
        uniform float uTime;
        uniform float uMotion;
        varying vec2 vScreenUv;
        varying float vSeed;

        void main() {
          vec3 p = position;
          float phase = aSeed * 28.0;

          p.z = mod(p.z + uTime * (0.24 + aSeed * 0.10) + 4.0, 5.0) - 2.5;
          p.x += sin(uTime * 0.17 + phase) * (0.08 + aSeed * 0.10);
          p.y += cos(uTime * 0.21 + phase * 1.27) * (0.07 + aSeed * 0.08);
          p.x += sin(uTime * 0.07 + phase * 0.47) * uMotion * 0.10;

          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          vScreenUv = gl_Position.xy / gl_Position.w * 0.5 + 0.5;
          vSeed = aSeed;

          gl_PointSize = (2.0 + aSeed * 5.5) * (1.0 + uMotion * 1.2) * (180.0 / -mvPosition.z);
        }
      `,
      fragmentShader: `
        uniform sampler2D uAmbient;
        varying vec2 vScreenUv;
        varying float vSeed;

        void main() {
          vec2 sprite = gl_PointCoord - 0.5;
          float radius = length(sprite);
          float glow = exp(-radius * radius * 28.0);
          if (glow < 0.02) discard;

          vec2 uv = clamp(vec2(vScreenUv.x, 1.0 - vScreenUv.y), 0.02, 0.98);
          vec3 ambient = texture2D(uAmbient, uv).rgb;
          float light = dot(ambient, vec3(0.2126, 0.7152, 0.0722));
          float lit = smoothstep(0.08, 0.72, light);

          vec3 dark = vec3(0.035, 0.055, 0.05);
          vec3 litColor = vec3(0.43, 0.78, 0.68);
          vec3 color = mix(dark, litColor, lit);
          float alpha = glow * (0.045 + lit * 0.34) * (0.72 + vSeed * 0.28);

          gl_FragColor = vec4(color, alpha);
        }
      `,
    });
  }

  private createParticles(): THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> {
    const count = 220;
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);

    let seed = 7;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    for (let index = 0; index < count; index += 1) {
      const offset = index * 3;
      positions[offset] = (random() - 0.5) * 5.6;
      positions[offset + 1] = (random() - 0.5) * 3.8;
      positions[offset + 2] = random() * 4.5 - 2.2;
      seeds[index] = random();
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3),
    );
    geometry.setAttribute(
      "aSeed",
      new THREE.BufferAttribute(seeds, 1),
    );

    return new THREE.Points(geometry, this.particleMaterial);
  }
}
