import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import sindicatoLogo from "@/assets/brand/sindicato-logo.png.asset.json";
import { click, hiss } from "@/lib/sfx";
import {
  campingAccessReducer,
  initialCampingAccessState,
  isCampingWalkEnabled,
  type CampingAccessAction,
  type CampingAccessState,
  type CampingPhase,
} from "../interactions/access-machine";
import {
  canOccupyStudio,
  createStudioCollisionConfig,
  resolveStudioMovement,
  type PointXZ,
} from "../camera/camping-collision";

type HoverTarget = { id: string; label: string; action: string } | null;

type EngineCallbacks = {
  onAccessChange: (state: CampingAccessState) => void;
  onHoverChange: (target: HoverTarget) => void;
  onMessage: (message: string | null, tone?: "neutral" | "danger" | "success") => void;
  onAssetState: (state: "idle" | "loading" | "ready" | "error") => void;
  onWebGLFailure: (message: string) => void;
  onCursor: (x: number, y: number, visible: boolean) => void;
  onEscape: () => void;
};

type CameraTween = {
  fromPosition: THREE.Vector3;
  toPosition: THREE.Vector3;
  fromLook: THREE.Vector3;
  toLook: THREE.Vector3;
  startedAt: number;
  duration: number;
  onComplete?: () => void;
};

type Direction = "forward" | "back" | "left" | "right";

type KeypadTarget = {
  kind: "keypad-digit" | "keypad-clear" | "keypad-enter";
  digit?: string;
};

const WALK_SPEED = 2.05;
const LOOK_SENSITIVITY = 0.0027;
const CAM_HEIGHT = 1.62;
const STUDIO_URL = "/models/camping/xoyens-studio.glb";

function easeInOutCubic(value: number): number {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function easeOutCubic(value: number): number {
  return 1 - Math.pow(1 - value, 3);
}

function safeDisposeMaterial(material: THREE.Material): void {
  const record = material as THREE.Material & {
    map?: THREE.Texture | null;
    normalMap?: THREE.Texture | null;
    roughnessMap?: THREE.Texture | null;
    metalnessMap?: THREE.Texture | null;
    emissiveMap?: THREE.Texture | null;
    alphaMap?: THREE.Texture | null;
  };
  const textures = [
    record.map,
    record.normalMap,
    record.roughnessMap,
    record.metalnessMap,
    record.emissiveMap,
    record.alphaMap,
  ];
  const unique = new Set(textures.filter((texture): texture is THREE.Texture => Boolean(texture)));
  unique.forEach((texture) => texture.dispose());
  material.dispose();
}

function makeCanvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function labelTexture(label: string): THREE.CanvasTexture {
  return makeCanvasTexture(256, 96, (ctx, width, height) => {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgba(8, 8, 7, 0.96)";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "rgba(196, 157, 109, 0.75)";
    ctx.lineWidth = 3;
    ctx.strokeRect(3, 3, width - 6, height - 6);
    ctx.font = "700 29px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#d8c6a4";
    ctx.fillText(label, width / 2, height / 2, width - 16);
  });
}

export class CampingStudioEngine {
  private readonly callbacks: EngineCallbacks;
  private canvas: HTMLCanvasElement | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(68, 1, 0.05, 70);
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2(2, 2);
  private interactiveRoots: THREE.Object3D[] = [];
  private hitTargets: THREE.Object3D[] = [];
  private hoveredRoot: THREE.Object3D | null = null;
  private outline: THREE.BoxHelper | null = null;
  private studioRoot: THREE.Group | null = null;
  private studioLoaded = false;
  private loader: GLTFLoader | null = null;
  private entryDoor: THREE.Group | null = null;
  private keypadDisplay: THREE.Mesh | null = null;
  private lockLight: THREE.PointLight | null = null;
  private access = { ...initialCampingAccessState };
  private phaseStartedAt = performance.now();
  private doorOpened = false;
  private doorAngle = 0;
  private messageUntil = 0;
  private currentMessage: string | null = null;
  private currentTone: "neutral" | "danger" | "success" = "neutral";
  private animationFrame = 0;
  private lastFrameAt = 0;
  private resizeObserver: ResizeObserver | null = null;
  private keyState = new Set<string>();
  private virtualState = new Set<Direction>();
  private dragPointerId: number | null = null;
  private dragStart = { x: 0, y: 0 };
  private dragLast = { x: 0, y: 0 };
  private dragDistance = 0;
  private isLooking = false;
  private yaw = 0;
  private pitch = -0.015;
  private tween: CameraTween | null = null;
  private focusReturn: { position: THREE.Vector3; look: THREE.Vector3 } | null = null;
  private phase: CampingPhase = "LOCKED";
  private disposed = false;
  private webglFailed = false;
  private collision = createStudioCollisionConfig();
  private readonly onWindowResize = () => this.resize();
  private readonly onDocumentVisibility = () => {
    this.lastFrameAt = performance.now();
  };
  private readonly onKeyDown = (event: KeyboardEvent) => this.handleKeyDown(event);
  private readonly onKeyUp = (event: KeyboardEvent) => this.handleKeyUp(event);
  private readonly onPointerDown = (event: PointerEvent) => this.handlePointerDown(event);
  private readonly onPointerMove = (event: PointerEvent) => this.handlePointerMove(event);
  private readonly onPointerUp = (event: PointerEvent) => this.handlePointerUp(event);
  private readonly onPointerCancel = () => this.clearPointer();
  private readonly onContextMenu = (event: Event) => event.preventDefault();

  constructor(callbacks: EngineCallbacks) {
    this.callbacks = callbacks;
  }

  mount(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.disposed = false;
    this.phase = "LOCKED";
    this.camera.position.set(0.14, CAM_HEIGHT, 8.25);
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.set(this.pitch, this.yaw, 0);
    this.scene.background = new THREE.Color(0x100d0a);
    this.scene.fog = new THREE.Fog(0x100d0a, 15, 30);

    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.13;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.setClearColor(0x100d0a, 1);
    } catch (error) {
      this.webglFailed = true;
      this.callbacks.onWebGLFailure(
        error instanceof Error ? error.message : "WebGL não está disponível neste dispositivo.",
      );
      return;
    }

    this.createLighting();
    this.createEntrySet();
    this.resize();

    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointercancel", this.onPointerCancel);
    this.canvas.addEventListener("contextmenu", this.onContextMenu);
    this.canvas.style.touchAction = "none";
    window.addEventListener("resize", this.onWindowResize, { passive: true });
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    document.addEventListener("visibilitychange", this.onDocumentVisibility);
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(this.onWindowResize);
      if (this.canvas.parentElement) this.resizeObserver.observe(this.canvas.parentElement);
    }

    this.animationFrame = window.requestAnimationFrame(this.tick);
    this.publishAccess();
    this.drawKeypadDisplay();
  }

  dispose(): void {
    this.disposed = true;
    if (this.animationFrame) window.cancelAnimationFrame(this.animationFrame);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    window.removeEventListener("resize", this.onWindowResize);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    document.removeEventListener("visibilitychange", this.onDocumentVisibility);

    if (this.canvas) {
      this.canvas.removeEventListener("pointerdown", this.onPointerDown);
      this.canvas.removeEventListener("pointermove", this.onPointerMove);
      this.canvas.removeEventListener("pointerup", this.onPointerUp);
      this.canvas.removeEventListener("pointercancel", this.onPointerCancel);
      this.canvas.removeEventListener("contextmenu", this.onContextMenu);
      this.canvas.style.touchAction = "";
    }

    this.keyState.clear();
    this.virtualState.clear();
    this.tween = null;
    this.loader = null;
    this.interactiveRoots = [];
    this.hitTargets = [];
    this.hoveredRoot = null;

    const disposedMaterials = new Set<THREE.Material>();
    const disposedGeometries = new Set<THREE.BufferGeometry>();
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry && !disposedGeometries.has(mesh.geometry)) {
        disposedGeometries.add(mesh.geometry);
        mesh.geometry.dispose();
      }
      const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      for (const material of materials) {
        if (!disposedMaterials.has(material)) {
          disposedMaterials.add(material);
          safeDisposeMaterial(material);
        }
      }
    });
    this.renderer?.dispose();
    this.renderer = null;
    this.scene.clear();
    this.studioRoot = null;
    this.entryDoor = null;
    this.keypadDisplay = null;
  }

  setVirtualMovement(direction: Direction, active: boolean): void {
    if (!isCampingWalkEnabled(this.phase)) return;
    if (active) this.virtualState.add(direction);
    else this.virtualState.delete(direction);
  }

  guideTo(anchor: "entrance" | "studio" | "production" | "photography" | "clothing" | "artists"): void {
    if (this.phase !== "EXPLORATION" && this.phase !== "INTERACTION_FOCUS") return;
    if (this.phase === "INTERACTION_FOCUS") this.finishFocusState();
    const anchors: Record<typeof anchor, { position: [number, number, number]; look: [number, number, number] }> = {
      entrance: { position: [0.08, CAM_HEIGHT, 3.25], look: [0, 1.45, 5.45] },
      studio: { position: [0.1, CAM_HEIGHT, 2.9], look: [0, 1.5, -1.5] },
      production: { position: [0.12, CAM_HEIGHT, -2.05], look: [-2.25, 1.75, -3.72] },
      photography: { position: [6.05, CAM_HEIGHT, 0.38], look: [3.95, 1.8, -4.18] },
      clothing: { position: [2.15, CAM_HEIGHT, -0.15], look: [3.05, 1.3, -1.55] },
      artists: { position: [5.25, CAM_HEIGHT, 0.35], look: [6.72, 2.1, 0.15] },
    };
    const target = anchors[anchor];
    const from = this.camera.position.clone();
    const fromLook = this.currentLookTarget();
    this.startTween(
      from,
      new THREE.Vector3(...target.position),
      fromLook,
      new THREE.Vector3(...target.look),
      720,
      () => this.callbacks.onHoverChange(null),
    );
  }

  returnToEntry(): void {
    if (this.phase !== "EXPLORATION" && this.phase !== "INTERACTION_FOCUS") return;
    if (this.phase === "INTERACTION_FOCUS") this.finishFocusState();
    this.focusReturn = null;
    this.callbacks.onHoverChange(null);
    this.startTween(
      this.camera.position.clone(),
      new THREE.Vector3(0.14, CAM_HEIGHT, 3.18),
      this.currentLookTarget(),
      new THREE.Vector3(0.05, 1.42, 5.47),
      880,
    );
  }

  returnFromFocus(): void {
    if (this.phase !== "INTERACTION_FOCUS") return;
    const saved = this.focusReturn;
    this.finishFocusState();
    if (!saved) return;
    this.startTween(
      this.camera.position.clone(),
      saved.position,
      this.currentLookTarget(),
      saved.look,
      650,
    );
  }

  pressAccessibleKey(key: string): void {
    if (key === "CLR") {
      this.dispatch({ type: "CLEAR" });
      click();
    } else if (key === "ENTER") {
      this.submitCode();
    } else if (/^\\d$/.test(key)) {
      this.inputDigit(key);
    }
  }

  retryStudioLoad(): void {
    if (this.phase !== "ERROR") return;
    this.dispatch({ type: "RETRY_LOAD" });
    this.callbacks.onAssetState("loading");
    this.loadStudio();
  }

  private readonly tick = (now: number) => {
    if (this.disposed) return;
    this.animationFrame = window.requestAnimationFrame(this.tick);
    if (document.hidden || !this.renderer) {
      this.lastFrameAt = now;
      return;
    }

    const delta = this.lastFrameAt > 0
      ? Math.min(0.05, Math.max(0, (now - this.lastFrameAt) / 1000))
      : 0.016;
    this.lastFrameAt = now;

    this.advanceAccessSequence(now);
    this.advanceDoor(now);
    this.advanceTween(now);
    this.advanceMovement(delta);
    this.camera.position.y = CAM_HEIGHT;
    this.camera.rotation.order = "YXZ";
    if (!this.tween && isCampingWalkEnabled(this.phase)) {
      this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
    }
    this.updateHoverOutline();
    this.renderer.render(this.scene, this.camera);
    this.advanceTransientMessage(now);
  };

  private createLighting(): void {
    this.scene.add(new THREE.HemisphereLight(0xf4d4a5, 0x17100b, 1.7));
    const key = new THREE.DirectionalLight(0xffd4a0, 2.0);
    key.position.set(-4, 7, 3);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 25;
    key.shadow.camera.left = -9;
    key.shadow.camera.right = 9;
    key.shadow.camera.top = 8;
    key.shadow.camera.bottom = -8;
    this.scene.add(key);

    const fill = new THREE.PointLight(0xff8b3d, 30, 14, 2);
    fill.position.set(-4.5, 2.5, 1);
    this.scene.add(fill);
    const ceilingWarm = new THREE.PointLight(0xffbd73, 46, 11, 2);
    ceilingWarm.position.set(-0.4, 3.1, -1.7);
    this.scene.add(ceilingWarm);
    const studioWarm = new THREE.PointLight(0xffb66b, 50, 9, 2);
    studioWarm.position.set(3.8, 2.8, -3.1);
    this.scene.add(studioWarm);
    const redAccent = new THREE.PointLight(0x5c0809, 8, 4, 2);
    redAccent.position.set(-0.8, 1.1, -4.2);
    this.scene.add(redAccent);
  }

  private createEntrySet(): void {
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x2c2620, roughness: 0.92 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x482716, roughness: 0.78 });
    const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x211812, roughness: 0.86 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x5c3a24, roughness: 0.72 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x35322d, metalness: 0.74, roughness: 0.4 });
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x0a0b0b, roughness: 0.8 });
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x3c2618, roughness: 0.68 });
    const box = (geometry: THREE.BoxGeometry, material: THREE.Material, position: [number, number, number]) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...position);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      return mesh;
    };

    const floor = box(new THREE.BoxGeometry(6.8, 0.12, 5.8), floorMat, [0, -0.12, 6.9]);
    floor.receiveShadow = true;
    box(new THREE.BoxGeometry(1.4, 3.25, 0.22), wallMat, [-2.05, 1.62, 5.25]);
    box(new THREE.BoxGeometry(1.8, 3.25, 0.22), wallMat, [1.78, 1.62, 5.25]);
    box(new THREE.BoxGeometry(2.55, 0.45, 0.22), wallMat, [-0.1, 3.0, 5.25]);
    box(new THREE.BoxGeometry(0.28, 3.15, 0.24), trimMat, [-1.12, 1.58, 5.61]);
    box(new THREE.BoxGeometry(0.28, 3.15, 0.24), trimMat, [0.86, 1.58, 5.61]);
    box(new THREE.BoxGeometry(2.2, 0.26, 0.24), trimMat, [-0.13, 3.08, 5.61]);
    box(new THREE.BoxGeometry(0.06, 2.75, 0.06), metalMat, [-1.04, 1.42, 5.43]);
    box(new THREE.BoxGeometry(0.06, 2.75, 0.06), metalMat, [0.77, 1.42, 5.43]);

    // A physical door slab on a real hinge pivot, facing the visitor.
    this.entryDoor = new THREE.Group();
    this.entryDoor.position.set(-0.96, 0.05, 5.55);
    this.scene.add(this.entryDoor);
    const panel = new THREE.Group();
    panel.position.set(0, 0, 0);
    this.entryDoor.add(panel);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.68, 2.72, 0.13), woodMat);
    leaf.position.set(0.84, 1.36, 0);
    leaf.castShadow = true;
    leaf.receiveShadow = true;
    panel.add(leaf);
    const innerPanel = new THREE.Mesh(new THREE.BoxGeometry(1.42, 2.44, 0.025), darkWoodMat);
    innerPanel.position.set(0.84, 1.36, 0.079);
    panel.add(innerPanel);

    // Apply the original managed Sindicato logo to the physical door, without redrawing it.
    const logoLoader = new THREE.TextureLoader();
    logoLoader.load(
      sindicatoLogo.url,
      (texture) => {
        if (this.disposed) {
          texture.dispose();
          return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        const logo = new THREE.Mesh(
          new THREE.PlaneGeometry(0.94, 0.42),
          new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            toneMapped: false,
            depthWrite: false,
            side: THREE.DoubleSide,
            polygonOffset: true,
            polygonOffsetFactor: -1,
          }),
        );
        logo.position.set(0.84, 2.02, 0.102);
        logo.renderOrder = 2;
        panel.add(logo);
      },
      undefined,
      () => {
        // The door remains usable if the managed brand asset is unavailable.
      },
    );
    for (const y of [0.24, 2.48]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.07, 0.035), trimMat);
      rail.position.set(0.84, y, 0.1);
      panel.add(rail);
    }
    for (const hingeY of [0.4, 1.32, 2.25]) {
      const hinge = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.22, 0.10), metalMat);
      hinge.position.set(0.035, hingeY, 0.085);
      panel.add(hinge);
    }
    const knob = new THREE.Mesh(
      new THREE.SphereGeometry(0.052, 16, 10),
      new THREE.MeshStandardMaterial({ color: 0x9c8a68, metalness: 0.8, roughness: 0.3 }),
    );
    knob.position.set(1.42, 1.28, 0.13);
    panel.add(knob);

    // Weathered wall strips and a practical amber fixture.
    box(new THREE.BoxGeometry(0.65, 2.75, 0.08), darkWoodMat, [-2.52, 1.43, 5.68]);
    box(new THREE.BoxGeometry(0.55, 2.75, 0.08), darkWoodMat, [2.58, 1.43, 5.68]);
    const sconceBase = box(new THREE.BoxGeometry(0.18, 0.36, 0.12), metalMat, [-2.35, 2.56, 5.54]);
    const sconceGlow = new THREE.PointLight(0xffa95d, 22, 5, 2);
    sconceGlow.position.set(-2.25, 2.52, 5.12);
    this.scene.add(sconceGlow);
    void sconceBase;

    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(0.80, 0.17),
      new THREE.MeshBasicMaterial({
        map: labelTexture("ENTER ACCESS CODE"),
        transparent: true,
        side: THREE.DoubleSide,
      }),
    );
    label.position.set(1.45, 2.46, 5.62);
    this.scene.add(label);

    const board = box(
      new THREE.BoxGeometry(0.86, 1.44, 0.12),
      blackMat,
      [1.45, 1.53, 5.48],
    );
    board.userData.kind = "keypad-board";
    this.hitTargets.push(board);

    const displayTexture = makeCanvasTexture(512, 192, (ctx, width, height) => {
      ctx.fillStyle = "#070908";
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "#58462f";
      ctx.lineWidth = 7;
      ctx.strokeRect(5, 5, width - 10, height - 10);
    });
    const display = new THREE.Mesh(
      new THREE.PlaneGeometry(0.64, 0.24),
      new THREE.MeshBasicMaterial({ map: displayTexture, toneMapped: false }),
    );
    display.position.set(1.45, 2.0, 5.552);
    this.scene.add(display);
    this.keypadDisplay = display;

    const digits = [
      { digit: "1", x: -0.22, y: 1.77 }, { digit: "2", x: 0, y: 1.77 }, { digit: "3", x: 0.22, y: 1.77 },
      { digit: "4", x: -0.22, y: 1.55 }, { digit: "5", x: 0, y: 1.55 }, { digit: "6", x: 0.22, y: 1.55 },
      { digit: "7", x: -0.22, y: 1.33 }, { digit: "8", x: 0, y: 1.33 }, { digit: "9", x: 0.22, y: 1.33 },
    ];
    const keyMat = new THREE.MeshStandardMaterial({
      color: 0x282722,
      metalness: 0.38,
      roughness: 0.46,
    });
    for (const key of digits) {
      this.createKeyButton(
        key.x + 1.45,
        key.y,
        key.digit,
        { kind: "keypad-digit", digit: key.digit },
        keyMat,
      );
    }
    this.createKeyButton(1.23, 1.11, "CLR", { kind: "keypad-clear" }, keyMat, 0.19);
    this.createKeyButton(1.45, 1.11, "0", { kind: "keypad-digit", digit: "0" }, keyMat);
    this.createKeyButton(1.67, 1.11, "ENTER", { kind: "keypad-enter" }, keyMat, 0.19);

    this.lockLight = new THREE.PointLight(0x9c1b17, 3, 2.5, 2);
    this.lockLight.position.set(1.45, 2.26, 5.2);
    this.scene.add(this.lockLight);

    // The access corridor has real floor edges and a dark threshold.
    box(new THREE.BoxGeometry(3.7, 0.08, 0.34), metalMat, [-0.05, -0.02, 4.55]);
    for (let i = 0; i < 10; i++) {
      box(
        new THREE.BoxGeometry(0.32, 0.025, 0.055),
        i % 4 === 0 ? trimMat : darkWoodMat,
        [-1.55 + i * 0.32, -0.045, 7.45],
      );
    }
    this.updateEntryLights();
  }

  private createKeyButton(
    x: number,
    y: number,
    label: string,
    target: KeypadTarget,
    material: THREE.Material,
    width = 0.16,
  ): void {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.135, 0.055),
      material.clone(),
    );
    mesh.position.set(x, y, 5.565);
    mesh.castShadow = true;
    mesh.userData.keypadTarget = target;
    this.scene.add(mesh);
    this.hitTargets.push(mesh);

    const texture = labelTexture(label);
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(width * 0.78, 0.063),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false }),
    );
    face.position.set(x, y, 5.601);
    face.userData.keypadLabel = true;
    this.scene.add(face);
  }

  private drawKeypadDisplay(): void {
    const material = this.keypadDisplay?.material as THREE.MeshBasicMaterial | undefined;
    const texture = material?.map as THREE.CanvasTexture | undefined;
    const canvas = texture?.image as HTMLCanvasElement | undefined;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !texture) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#070908";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = this.access.phase === "ACCESS_GRANTED" || this.access.phase === "DOOR_OPENING" || this.access.phase === "ENTERING_STUDIO"
      ? "#b88d51" : this.access.message === "INVALID CODE" ? "#9b2421" : "#58462f";
    ctx.lineWidth = 7;
    ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "700 22px monospace";
    ctx.fillStyle = this.access.message === "INVALID CODE" ? "#df7770" : "#c9b28c";
    const status = this.access.phase === "ACCESS_GRANTED" || this.access.phase === "DOOR_OPENING"
      ? "ACCESS GRANTED"
      : this.access.phase === "ENTERING_STUDIO"
        ? "ENTERING STUDIO"
        : this.access.phase === "EXPLORATION"
          ? "ACCESS OPEN"
          : this.access.message === "INVALID CODE"
            ? "ACCESS DENIED"
            : "ACCESS LOCKED";
    ctx.fillText(status, canvas.width / 2, 53);
    ctx.font = "700 48px monospace";
    ctx.fillStyle = "#f1e0bc";
    ctx.fillText(this.access.code ? this.access.code.padEnd(3, "•") : "•••", canvas.width / 2, 124);
    texture.needsUpdate = true;
  }

  private setTransientMessage(message: string, tone: "neutral" | "danger" | "success" = "neutral", duration = 1800): void {
    this.currentMessage = message;
    this.currentTone = tone;
    this.messageUntil = performance.now() + duration;
    this.callbacks.onMessage(message, tone);
  }

  private advanceTransientMessage(now: number): void {
    if (this.currentMessage && this.messageUntil > 0 && now >= this.messageUntil) {
      this.currentMessage = null;
      this.messageUntil = 0;
      this.callbacks.onMessage(null, "neutral");
      if (this.access.message && this.access.phase === "LOCKED") {
        this.access = { ...this.access, message: null };
        this.publishAccess();
      }
    }
  }

  private dispatch(action: CampingAccessAction): void {
    const previousPhase = this.access.phase;
    this.access = campingAccessReducer(this.access, action);
    this.publishAccess();
    this.drawKeypadDisplay();

    if (this.access.phase === "ACCESS_GRANTED" && previousPhase !== "ACCESS_GRANTED") {
      this.beginGrantedSequence();
    }
    if (this.access.phase === "DOOR_OPENING" && previousPhase !== "DOOR_OPENING") {
      this.doorOpened = false;
      this.callbacks.onAssetState(this.studioLoaded ? "ready" : "loading");
      if (this.studioRoot) this.studioRoot.visible = true;
      this.updateEntryLights();
    }
    if (this.access.phase === "ENTERING_STUDIO" && previousPhase !== "ENTERING_STUDIO") {
      this.startTween(
        this.camera.position.clone(),
        new THREE.Vector3(0.08, CAM_HEIGHT, 3.52),
        this.currentLookTarget(),
        new THREE.Vector3(0.12, 1.58, -0.4),
        1650,
        () => this.dispatch({ type: "EXPLORE" }),
      );
    }
    if (this.access.phase === "EXPLORATION" && previousPhase !== "EXPLORATION") {
      this.tween = null;
      this.camera.position.y = CAM_HEIGHT;
      // Keep the camera orientation produced by the door-entry tween.
      this.callbacks.onHoverChange(null);
      this.callbacks.onMessage(null);
      this.currentMessage = null;
      this.currentTone = "neutral";
      this.messageUntil = 0;
      this.updateEntryLights();
    }
    if (this.access.phase === "ERROR") {
      this.callbacks.onAssetState("error");
      this.setTransientMessage(this.access.message || "STUDIO LOAD ERROR", "danger", 0);
    }
  }

  private publishAccess(): void {
    this.phase = this.access.phase;
    this.phaseStartedAt = performance.now();
    this.callbacks.onAccessChange({ ...this.access });
  }

  private beginGrantedSequence(): void {
    this.doorOpened = false;
    this.callbacks.onAssetState(this.studioLoaded ? "ready" : "loading");
    this.setTransientMessage("ACCESS GRANTED", "success", 2600);
    click();
    this.loadStudio();
    this.updateEntryLights();
  }

  private advanceAccessSequence(now: number): void {
    if (this.phase === "ACCESS_GRANTED" && now - this.phaseStartedAt >= 420) {
      this.dispatch({ type: "DOOR_OPENING" });
    }
    if (this.phase === "DOOR_OPENING" && !this.doorOpened && this.studioLoaded && now - this.phaseStartedAt >= 1450) {
      this.doorOpened = true;
      this.dispatch({ type: "ENTERING_STUDIO" });
    }
  }

  private advanceDoor(now: number): void {
    if (!this.entryDoor) return;
    if (this.phase === "DOOR_OPENING" || this.phase === "ENTERING_STUDIO" || this.phase === "EXPLORATION" || this.phase === "INTERACTION_FOCUS") {
      const progress = this.phase === "DOOR_OPENING"
        ? Math.min(1, Math.max(0, (now - this.phaseStartedAt) / 1450))
        : 1;
      const targetAngle = 1.38;
      this.doorAngle = targetAngle * easeOutCubic(progress);
      this.entryDoor.rotation.y = this.doorAngle;
    } else {
      this.entryDoor.rotation.y = 0;
      this.doorAngle = 0;
    }
  }

  private loadStudio(): void {
    if (this.studioLoaded || this.loader || this.disposed) return;
    this.callbacks.onAssetState("loading");
    this.loader = new GLTFLoader();
    this.loader.load(
      STUDIO_URL,
      (gltf) => {
        if (this.disposed) {
          gltf.scene.traverse((object) => {
            const mesh = object as THREE.Mesh;
            mesh.geometry?.dispose();
            const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
            mats.forEach(safeDisposeMaterial);
          });
          return;
        }
        const root = gltf.scene;
        root.name = "CAMPING / XOYENS STUDIO GLB";
        root.visible = this.phase !== "LOCKED" && this.phase !== "CODE_ENTRY" && this.phase !== "ACCESS_GRANTED";
        root.traverse((object) => {
          const mesh = object as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
            for (const material of materials) {
              if ("envMapIntensity" in material) {
                (material as THREE.MeshStandardMaterial).envMapIntensity = 0.42;
              }
              material.needsUpdate = true;
            }
          }
          const runtimeInteractionIds: Record<string, string> = {
            "studio.imac-screen": "studio.imac",
            "studio.imac-daw-track": "studio.imac",
            "studio.photo-backdrop-seal": "studio.photo-backdrop",
            "studio.garments": "studio.merch-rack",
            "studio.door-panel": "studio.inner-door",
            "studio.door-handle": "studio.inner-door",
            "studio.audio-grille": "studio.audio-system",
            "studio.audio-driver": "studio.audio-system",
          };
          const runtimeId = runtimeInteractionIds[object.name];
          if (runtimeId && !object.userData?.interactionId) {
            object.userData.interactionId = runtimeId;
          }
          const interactionId = object.userData?.interactionId;
          if (typeof interactionId === "string" && interactionId) this.interactiveRoots.push(object);
        });
        this.studioRoot = root;
        this.studioRoot.visible = this.phase !== "LOCKED" && this.phase !== "CODE_ENTRY" && this.phase !== "ACCESS_GRANTED";
        this.scene.add(root);
        this.studioLoaded = true;
        this.loader = null;
        this.callbacks.onAssetState("ready");
        if (this.phase === "DOOR_OPENING" && performance.now() - this.phaseStartedAt >= 1450) {
          this.doorOpened = true;
          this.dispatch({ type: "ENTERING_STUDIO" });
        }
      },
      undefined,
      (error) => {
        if (this.disposed) return;
        this.loader = null;
        const reason = error instanceof Error ? error.message : "Não foi possível carregar o modelo 3D.";
        this.dispatch({ type: "LOAD_ERROR", message: "MODEL LOAD FAILED" });
        this.callbacks.onWebGLFailure(reason);
      },
    );
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    const isTyping = target && (
      /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) ||
      target.isContentEditable
    );
    if (isTyping) return;
    const digit = event.key.length === 1 && /^\d$/.test(event.key) ? event.key : null;
    if (digit && (this.phase === "LOCKED" || this.phase === "CODE_ENTRY")) {
      event.preventDefault();
      this.inputDigit(digit);
      return;
    }
    if ((event.key === "Enter" || event.key === "NumpadEnter") && (this.phase === "LOCKED" || this.phase === "CODE_ENTRY")) {
      if (target && /^(BUTTON|A)$/.test(target.tagName)) return;
      event.preventDefault();
      this.submitCode();
      return;
    }
    if (event.key === "Backspace" && (this.phase === "LOCKED" || this.phase === "CODE_ENTRY")) {
      event.preventDefault();
      this.dispatch({ type: "BACKSPACE" });
      return;
    }
    if (event.key === "Escape") {
      if (this.phase === "INTERACTION_FOCUS") {
        event.preventDefault();
        this.returnFromFocus();
      } else {
        this.callbacks.onEscape();
      }
      return;
    }
    if (target && /^(BUTTON|A)$/.test(target.tagName)) return;
    if (this.phase !== "EXPLORATION") return;
    const key = event.key.toLowerCase();
    if (["w", "a", "s", "d", "arrowup", "arrowleft", "arrowdown", "arrowright"].includes(key)) {
      event.preventDefault();
      this.keyState.add(key);
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    this.keyState.delete(event.key.toLowerCase());
  }

  private updatePointerFromEvent(event: PointerEvent): void {
    if (!this.canvas) return;
    const bounds = this.canvas.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - bounds.left) / Math.max(1, bounds.width)) * 2 - 1,
      -(((event.clientY - bounds.top) / Math.max(1, bounds.height)) * 2 - 1),
    );
  }

  private handlePointerDown(event: PointerEvent): void {
    if (this.webglFailed) return;
    this.updatePointerFromEvent(event);
    if (event.pointerType !== "touch") {
      try { this.canvas?.focus({ preventScroll: true }); } catch {}
    }
    this.dragPointerId = event.pointerId;
    this.dragStart = { x: event.clientX, y: event.clientY };
    this.dragLast = { ...this.dragStart };
    this.dragDistance = 0;
    this.isLooking = false;
    try {
      this.canvas?.setPointerCapture(event.pointerId);
    } catch {}
  }

  private handlePointerMove(event: PointerEvent): void {
    if (!this.canvas) return;
    this.updatePointerFromEvent(event);
    this.callbacks.onCursor(event.clientX, event.clientY, event.pointerType !== "touch");

    if (this.dragPointerId === event.pointerId) {
      const dx = event.clientX - this.dragLast.x;
      const dy = event.clientY - this.dragLast.y;
      this.dragDistance += Math.abs(dx) + Math.abs(dy);
      if (this.dragDistance > 5) this.isLooking = true;
      if (this.isLooking && (this.phase === "EXPLORATION" || this.phase === "INTERACTION_FOCUS" || this.phase === "LOCKED" || this.phase === "CODE_ENTRY")) {
        this.yaw -= dx * LOOK_SENSITIVITY;
        this.pitch = THREE.MathUtils.clamp(this.pitch - dy * LOOK_SENSITIVITY * 0.85, -1.14, 1.1);
        if (!this.tween) this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
      }
      this.dragLast = { x: event.clientX, y: event.clientY };
    } else {
      this.updateRaycastHover();
    }
  }

  private handlePointerUp(event: PointerEvent): void {
    if (this.dragPointerId !== event.pointerId) return;
    this.updatePointerFromEvent(event);
    const wasClick = this.dragDistance < 7;
    this.dragPointerId = null;
    try {
      this.canvas?.releasePointerCapture(event.pointerId);
    } catch {}
    if (wasClick) this.activatePointerTarget();
    this.isLooking = false;
    this.dragDistance = 0;
  }

  private clearPointer(): void {
    this.dragPointerId = null;
    this.dragDistance = 0;
    this.isLooking = false;
  }

  private updateRaycaster(): THREE.Intersection[] {
    if (!this.camera) return [];
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const roots = this.studioRoot && this.studioRoot.visible
      ? [...this.hitTargets, this.studioRoot]
      : [...this.hitTargets];
    return this.raycaster.intersectObjects(roots, true);
  }

  private updateRaycastHover(): void {
    const hits = this.updateRaycaster();
    const target = hits[0];
    const object = target?.object ?? null;
    if (!object || (!this.getKeypadTarget(object) && !this.findInteractiveRoot(object))) {
      this.setHoveredRoot(null);
      return;
    }
    const keypad = this.getKeypadTarget(object);
    if (keypad) {
      this.setHoveredRoot(object);
      const label = keypad.kind === "keypad-digit" ? keypad.digit || "ENTER" : keypad.kind === "keypad-clear" ? "CLEAR" : "ENTER";
      this.callbacks.onHoverChange({ id: "entry.keypad-808", label, action: "PRESS" });
      return;
    }
    const root = this.findInteractiveRoot(object);
    this.setHoveredRoot(root);
    if (root) {
      const id = String(root.userData.interactionId);
      this.callbacks.onHoverChange({
        id,
        label: this.labelForId(id),
        action: this.actionForId(id),
      });
    }
  }

  private activatePointerTarget(): void {
    const hits = this.updateRaycaster();
    const hit = hits[0];
    if (!hit || (!this.getKeypadTarget(hit.object) && !this.findInteractiveRoot(hit.object))) return;
    const keypad = this.getKeypadTarget(hit.object);
    if (keypad) {
      if (keypad.kind === "keypad-digit" && keypad.digit) this.inputDigit(keypad.digit);
      if (keypad.kind === "keypad-clear") {
        this.dispatch({ type: "CLEAR" });
        click();
      }
      if (keypad.kind === "keypad-enter") {
        this.submitCode();
      }
      return;
    }
    if (this.phase !== "EXPLORATION") return;
    const root = this.findInteractiveRoot(hit.object);
    if (root) this.focusObject(root);
  }

  private getKeypadTarget(object: THREE.Object3D): KeypadTarget | null {
    let current: THREE.Object3D | null = object;
    while (current) {
      if (current.userData?.keypadTarget) return current.userData.keypadTarget as KeypadTarget;
      current = current.parent;
    }
    return null;
  }

  private findInteractiveRoot(object: THREE.Object3D): THREE.Object3D | null {
    let current: THREE.Object3D | null = object;
    while (current && current !== this.studioRoot) {
      if (typeof current.userData?.interactionId === "string") return current;
      current = current.parent;
    }
    return null;
  }

  private inputDigit(digit: string): void {
    const before = this.access.phase;
    this.dispatch({ type: "DIGIT", digit });
    if (this.access.phase === "CODE_ENTRY" && this.access.code.length === 3 && before !== "CODE_ENTRY") {
      // First full input can be reached from LOCKED; submit below as well.
      this.dispatch({ type: "SUBMIT" });
    } else if (this.access.phase === "CODE_ENTRY" && this.access.code.length === 3) {
      this.dispatch({ type: "SUBMIT" });
    }
    click();
    this.drawKeypadDisplay();
  }

  private submitCode(): void {
    if (this.phase !== "LOCKED" && this.phase !== "CODE_ENTRY") return;
    this.dispatch({ type: "SUBMIT" });
    if (this.access.message === "INVALID CODE") {
      hiss(0.16);
      this.setTransientMessage("INVALID CODE", "danger", 1700);
      if (this.lockLight) this.lockLight.color.setHex(0x9c1b17);
    }
    this.drawKeypadDisplay();
  }

  private focusObject(root: THREE.Object3D): void {
    const id = String(root.userData.interactionId || root.name);
    this.focusReturn = {
      position: this.camera.position.clone(),
      look: this.currentLookTarget(),
    };
    const bounds = new THREE.Box3().setFromObject(root);
    const center = bounds.getCenter(new THREE.Vector3());
    const outward = this.camera.position.clone().sub(center);
    if (outward.lengthSq() < 0.001) outward.set(0, 0, 1);
    outward.y = 0;
    if (outward.lengthSq() < 0.001) outward.set(0, 0, 1);
    outward.normalize();
    let destination = center.clone().add(outward.clone().multiplyScalar(1.9));
    destination.y = CAM_HEIGHT;
    let foundSafeSpot = canOccupyStudio(
      { x: destination.x, z: destination.z },
      this.collision,
    );
    const startingAngle = Math.atan2(outward.z, outward.x);
    for (let index = 1; index <= 12 && !foundSafeSpot; index += 1) {
      const angle = startingAngle + (Math.PI * 2 * index) / 12;
      const candidate = center.clone().add(new THREE.Vector3(
        Math.cos(angle) * 1.95,
        0,
        Math.sin(angle) * 1.95,
      ));
      foundSafeSpot = canOccupyStudio(
        { x: candidate.x, z: candidate.z },
        this.collision,
      );
      if (foundSafeSpot) destination = new THREE.Vector3(candidate.x, CAM_HEIGHT, candidate.z);
    }
    if (!foundSafeSpot) destination = this.camera.position.clone();
    this.setHoveredRoot(root);
    this.dispatch({ type: "FOCUS_OBJECT", id });
    this.startTween(
      this.camera.position.clone(),
      destination,
      this.currentLookTarget(),
      center,
      620,
    );
    this.setTransientMessage("OBJECT IDENTIFIED / " + id.toUpperCase().replace(/\./g, " / "), "neutral", 0);
  }

  private finishFocusState(): void {
    this.dispatch({ type: "CLOSE_FOCUS" });
    this.setHoveredRoot(null);
    this.callbacks.onHoverChange(null);
    this.currentMessage = null;
    this.messageUntil = 0;
    this.callbacks.onMessage(null);
  }

  private labelForId(id: string): string {
    if (id === "studio.imac") return "OPEN";
    if (id === "studio.artists-wall" || id.startsWith("studio.artist-photo")) return "VIEW FILE";
    if (id === "studio.merch-rack") return "BUY";
    if (id === "studio.audio-system") return "LISTEN";
    if (id === "studio.photo-backdrop") return "VIEW";
    if (id === "studio.inner-door") return "ACCESS";
    return "INTERACT";
  }

  private actionForId(id: string): string {
    if (id === "studio.imac") return "OPEN COMPUTER";
    if (id === "studio.merch-rack") return "VIEW CLOTHING";
    if (id === "studio.audio-system") return "LISTEN";
    if (id === "studio.inner-door") return "ROOM ACCESS";
    if (id.startsWith("studio.artist-photo")) return "PERSONNEL FILE";
    return "VIEW OBJECT";
  }

  private setHoveredRoot(root: THREE.Object3D | null): void {
    if (this.hoveredRoot === root) return;
    this.hoveredRoot = root;
    if (this.outline) {
      this.scene.remove(this.outline);
      this.outline.geometry.dispose();
      const materials = Array.isArray(this.outline.material) ? this.outline.material : [this.outline.material];
      materials.forEach((material) => material.dispose());
      this.outline = null;
    }
    if (root) {
      this.outline = new THREE.BoxHelper(root, 0xc28c53);
      this.outline.material.transparent = true;
      this.outline.material.opacity = 0.72;
      this.scene.add(this.outline);
    }
  }

  private updateHoverOutline(): void {
    if (this.outline && this.hoveredRoot) this.outline.update();
  }

  private startTween(
    fromPosition: THREE.Vector3,
    toPosition: THREE.Vector3,
    fromLook: THREE.Vector3,
    toLook: THREE.Vector3,
    duration: number,
    onComplete?: () => void,
  ): void {
    this.tween = {
      fromPosition: fromPosition.clone(),
      toPosition: toPosition.clone(),
      fromLook: fromLook.clone(),
      toLook: toLook.clone(),
      startedAt: performance.now(),
      duration,
      onComplete,
    };
  }

  private advanceTween(now: number): void {
    if (!this.tween) return;
    const current = this.tween;
    const raw = Math.min(1, Math.max(0, (now - current.startedAt) / current.duration));
    const t = easeInOutCubic(raw);
    const interpolated = current.fromPosition.clone().lerp(current.toPosition, t);
    const constrained = this.phase === "EXPLORATION" || this.phase === "INTERACTION_FOCUS"
      ? resolveStudioMovement(
          { x: this.camera.position.x, z: this.camera.position.z },
          { x: interpolated.x - this.camera.position.x, z: interpolated.z - this.camera.position.z },
          this.collision,
        )
      : { x: interpolated.x, z: interpolated.z };
    this.camera.position.set(constrained.x, CAM_HEIGHT, constrained.z);
    const look = current.fromLook.clone().lerp(current.toLook, t);
    this.camera.lookAt(look);
    if (raw >= 1) {
      this.tween = null;
      const direction = current.toLook.clone().sub(current.toPosition).normalize();
      this.yaw = Math.atan2(-direction.x, -direction.z);
      this.pitch = Math.asin(THREE.MathUtils.clamp(direction.y, -1, 1));
      current.onComplete?.();
    }
  }

  private currentLookTarget(): THREE.Vector3 {
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);
    return this.camera.position.clone().add(direction.multiplyScalar(3.2));
  }

  private advanceMovement(delta: number): void {
    if (!isCampingWalkEnabled(this.phase) || this.tween) return;
    let forward =
      (this.keyState.has("w") || this.keyState.has("arrowup") || this.virtualState.has("forward") ? 1 : 0) -
      (this.keyState.has("s") || this.keyState.has("arrowdown") || this.virtualState.has("back") ? 1 : 0);
    let lateral =
      (this.keyState.has("d") || this.keyState.has("arrowright") || this.virtualState.has("right") ? 1 : 0) -
      (this.keyState.has("a") || this.keyState.has("arrowleft") || this.virtualState.has("left") ? 1 : 0);
    if (!forward && !lateral) return;
    const length = Math.hypot(forward, lateral) || 1;
    forward /= length;
    lateral /= length;
    const dx = (Math.cos(this.yaw) * lateral - Math.sin(this.yaw) * forward) * WALK_SPEED * delta;
    const dz = (-Math.sin(this.yaw) * lateral - Math.cos(this.yaw) * forward) * WALK_SPEED * delta;
    const current: PointXZ = { x: this.camera.position.x, z: this.camera.position.z };
    const next = resolveStudioMovement(current, { x: dx, z: dz }, this.collision);
    this.camera.position.x = next.x;
    this.camera.position.z = next.z;
  }

  private updateEntryLights(): void {
    if (this.lockLight) {
      const unlocked = this.phase !== "LOCKED" && this.phase !== "CODE_ENTRY" && this.phase !== "ERROR";
      this.lockLight.color.setHex(unlocked ? 0xb78a4f : 0x9c1b17);
      this.lockLight.intensity = unlocked ? 9 : this.access.message === "INVALID CODE" ? 12 : 3;
    }
  }

  private resize(): void {
    if (!this.canvas || !this.renderer) return;
    const width = Math.max(1, this.canvas.clientWidth || this.canvas.parentElement?.clientWidth || window.innerWidth);
    const height = Math.max(1, this.canvas.clientHeight || this.canvas.parentElement?.clientHeight || window.innerHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
