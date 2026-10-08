import * as THREE from "three";
import type {
  CameraFacingMode,
  FaceVfxUniformState,
  FilterId,
} from "./types";

const OVERLAY_SCALE = 0.72;
const AMBIENT_WIDTH = 64;
const AMBIENT_HEIGHT = 32;
const LANDMARK_COUNT = 478;
const XRAY_NEIGHBOURS = 4;
const MOUTH_INDICES = [13, 14, 61, 291];
const EYE_INDICES = [33, 133, 159, 145, 362, 263, 386, 374];

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

function createXrayMaterial(
  color: [number, number, number],
  core: number,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uMeshColor: { value: new THREE.Vector3(...color) },
      uDepthFade: { value: 0.8 },
      uLineWidth: { value: 1.5 },
      uTime: { value: 0 },
      uCore: { value: core },
    },
    vertexShader: `
      attribute float aDepth;
      varying float vDepth;

      void main() {
        vDepth = aDepth;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uMeshColor;
      uniform float uDepthFade;
      uniform float uTime;
      uniform float uCore;
      varying float vDepth;

      void main() {
        float depth = exp(-abs(vDepth) * max(uDepthFade, 0.001));
        float pulse = 0.76 + 0.24 * sin(uTime * 5.2 + vDepth * 11.0);
        vec3 phosphor = mix(
          uMeshColor * 0.38,
          vec3(1.0, 1.0, 0.96),
          clamp(uCore * 0.75 + depth * 0.28, 0.0, 1.0)
        );
        float alpha = (0.18 + depth * 0.72) * pulse * (0.7 + uCore * 0.3);
        gl_FragColor = vec4(phosphor, alpha);
      }
    `,
  });
}

export class CameraVfx3DOverlay {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100);
  private readonly glasses = new THREE.Group();
  private readonly xrayGroup = new THREE.Group();
  private readonly ambientCanvas = document.createElement("canvas");
  private readonly ambientContext: CanvasRenderingContext2D;
  private readonly ambientTexture: THREE.CanvasTexture;
  private readonly particleMaterial: THREE.ShaderMaterial;
  private readonly particles: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly xrayGeometry = new THREE.BufferGeometry();
  private readonly xrayOuterMaterial = createXrayMaterial([0, 1, 0.4], 0.0);
  private readonly xrayCoreMaterial = createXrayMaterial([0, 1, 0.4], 0.82);
  private xrayOuter: THREE.LineSegments | null = null;
  private xrayCore: THREE.LineSegments | null = null;
  private readonly smoothedLandmarks = new Float32Array(LANDMARK_COUNT * 3);
  private xrayEdgeIndices: Uint16Array = new Uint16Array(0);
  private xrayReady = false;
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

    this.xrayGroup.visible = false;
    this.scene.add(this.xrayGroup);

    this.buildGlasses();
    this.particleMaterial = this.createParticleMaterial();
    this.particles = this.createParticles();
    this.particles.visible = false;

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
    landmarks: Float32Array | null = null,
  ): void {
    if (this.destroyed) return;

    this.activeFilter = filter;
    this.glasses.visible = filter === "vamp" && state.present > 0.5;
    this.particles.visible = filter === "astro-haze";
    this.xrayGroup.visible = filter === "xray-mesh" && state.present > 0.5;

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

    this.particleMaterial.uniforms.uTime!.value = timestamp * 0.001;
    this.particleMaterial.uniforms.uMotion!.value = state.motion;
    this.particleMaterial.uniforms.uAmbient!.value = this.ambientTexture;

    if (filter === "xray-mesh" && landmarks) {
      this.updateXrayMesh(
        landmarks,
        state,
        facingMode,
        timestamp,
      );
    }
  }

  render(): void {
    if (this.destroyed) return;
    this.renderer.render(this.scene, this.camera);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh | THREE.Points | THREE.LineSegments;
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
    this.xrayOuter = null;
    this.xrayCore = null;
  }

  setXrayParameters(
    meshColor: [number, number, number] = [0, 1, 0.4],
    lineWidth = 1.5,
    depthFade = 0.8,
  ): void {
    this.xrayOuterMaterial.uniforms.uMeshColor!.value.set(...meshColor);
    this.xrayCoreMaterial.uniforms.uMeshColor!.value.set(...meshColor);
    this.xrayOuterMaterial.uniforms.uDepthFade!.value = depthFade;
    this.xrayCoreMaterial.uniforms.uDepthFade!.value = depthFade;
    this.xrayOuterMaterial.uniforms.uLineWidth!.value = lineWidth;
    this.xrayCoreMaterial.uniforms.uLineWidth!.value = lineWidth;
  }

  private buildXrayTopology(landmarks: Float32Array): void {
    if (this.xrayReady) return;

    const edgeSet = new Set<string>();
    const edges: number[] = [];
    const nearestIndices = new Int16Array(XRAY_NEIGHBOURS);
    const nearestDistances = new Float32Array(XRAY_NEIGHBOURS);

    for (let i = 0; i < LANDMARK_COUNT; i += 1) {
      nearestIndices.fill(-1);
      nearestDistances.fill(Number.POSITIVE_INFINITY);

      const ix = landmarks[i * 3] ?? 0;
      const iy = landmarks[i * 3 + 1] ?? 0;

      for (let j = 0; j < LANDMARK_COUNT; j += 1) {
        if (i === j) continue;

        const jx = landmarks[j * 3] ?? 0;
        const jy = landmarks[j * 3 + 1] ?? 0;
        const dx = jx - ix;
        const dy = jy - iy;
        const distance = dx * dx + dy * dy;

        for (let slot = 0; slot < XRAY_NEIGHBOURS; slot += 1) {
          if (distance >= nearestDistances[slot]!) continue;

          for (let shift = XRAY_NEIGHBOURS - 1; shift > slot; shift -= 1) {
            nearestDistances[shift] = nearestDistances[shift - 1]!;
            nearestIndices[shift] = nearestIndices[shift - 1]!;
          }

          nearestDistances[slot] = distance;
          nearestIndices[slot] = j;
          break;
        }
      }

      for (let slot = 0; slot < XRAY_NEIGHBOURS; slot += 1) {
        const neighbour = nearestIndices[slot]!;
        if (neighbour < 0) continue;

        const a = Math.min(i, neighbour);
        const b = Math.max(i, neighbour);
        const key = a + ":" + b;

        if (edgeSet.has(key)) continue;
        edgeSet.add(key);
        edges.push(a, b);
      }
    }

    this.xrayEdgeIndices = new Uint16Array(edges);

    const vertexCount = edges.length;
    const positions = new Float32Array(vertexCount * 3);
    const depths = new Float32Array(vertexCount);
    this.xrayGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage),
    );
    this.xrayGeometry.setAttribute(
      "aDepth",
      new THREE.BufferAttribute(depths, 1).setUsage(THREE.DynamicDrawUsage),
    );

    this.xrayOuter = new THREE.LineSegments(
      this.xrayGeometry,
      this.xrayOuterMaterial,
    );
    this.xrayCore = new THREE.LineSegments(
      this.xrayGeometry,
      this.xrayCoreMaterial,
    );

    this.xrayGroup.add(this.xrayOuter, this.xrayCore);
    this.xrayReady = true;
  }

  private updateXrayMesh(
    landmarks: Float32Array,
    state: FaceVfxUniformState,
    facingMode: CameraFacingMode,
    timestamp: number,
  ): void {
    this.buildXrayTopology(landmarks);

    const positionAttribute = this.xrayGeometry.getAttribute("position") as THREE.BufferAttribute;
    const depthAttribute = this.xrayGeometry.getAttribute("aDepth") as THREE.BufferAttribute;

    const smoothing = 0.16 + (1 - state.motion) * 0.18;
    const meshScale = 4.1;
    const xOffset = facingMode === "user" ? -1 : 1;

    for (let i = 0; i < LANDMARK_COUNT; i += 1) {
      const offset = i * 3;
      const sourceX = (landmarks[offset] ?? 0.5);
      const sourceY = (landmarks[offset + 1] ?? 0.5);
      const sourceZ = (landmarks[offset + 2] ?? 0) * -meshScale;

      let targetX = (sourceX - 0.5) * 2.6 * xOffset;
      let targetY = (0.5 - sourceY) * 3.0;
      const targetZ = sourceZ * 0.32;

      const mouthFactor =
        Math.abs(state.mouth[2]) * (MOUTH_INDICES.includes(i) ? 0.055 : 0);
      const eyeFactor =
        Math.max(state.details[2], 0.12) * (EYE_INDICES.includes(i) ? 0.018 : 0);

      targetY += mouthFactor * (i === 13 ? 1 : i === 14 ? -1 : 0);
      targetX += eyeFactor * (i % 2 === 0 ? -1 : 1);

      this.smoothedLandmarks[offset] =
        this.smoothedLandmarks[offset] * (1 - smoothing) +
        targetX * smoothing;
      this.smoothedLandmarks[offset + 1] =
        this.smoothedLandmarks[offset + 1] * (1 - smoothing) +
        targetY * smoothing;
      this.smoothedLandmarks[offset + 2] =
        this.smoothedLandmarks[offset + 2] * (1 - smoothing) +
        targetZ * smoothing;
    }

    let vertexOffset = 0;
    for (let edgeIndex = 0; edgeIndex < this.xrayEdgeIndices.length; edgeIndex += 2) {
      const a = this.xrayEdgeIndices[edgeIndex]!;
      const b = this.xrayEdgeIndices[edgeIndex + 1]!;

      const aOffset = a * 3;
      const bOffset = b * 3;

      positionAttribute.array[vertexOffset] = this.smoothedLandmarks[aOffset]!;
      positionAttribute.array[vertexOffset + 1] = this.smoothedLandmarks[aOffset + 1]!;
      positionAttribute.array[vertexOffset + 2] = this.smoothedLandmarks[aOffset + 2]!;

      positionAttribute.array[vertexOffset + 3] = this.smoothedLandmarks[bOffset]!;
      positionAttribute.array[vertexOffset + 4] = this.smoothedLandmarks[bOffset + 1]!;
      positionAttribute.array[vertexOffset + 5] = this.smoothedLandmarks[bOffset + 2]!;

      depthAttribute.array[vertexOffset / 3] = this.smoothedLandmarks[aOffset + 2]!;
      depthAttribute.array[vertexOffset / 3 + 1] = this.smoothedLandmarks[bOffset + 2]!;

      vertexOffset += 6;
    }

    positionAttribute.needsUpdate = true;
    depthAttribute.needsUpdate = true;

    const pulse = 0.82 + 0.18 * Math.sin(timestamp * 0.005);
    this.xrayOuterMaterial.uniforms.uTime!.value = timestamp * 0.001 + pulse * 0.03;
    this.xrayCoreMaterial.uniforms.uTime!.value = timestamp * 0.001 + pulse * 0.03;
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
