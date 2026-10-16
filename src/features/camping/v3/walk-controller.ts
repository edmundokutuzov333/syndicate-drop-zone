import * as THREE from "three";

export type WalkInput = { forward: number; strafe: number; sprint: boolean; deltaSeconds: number };
export type WalkControllerOptions = { speed?: number; capsuleRadius?: number; floorY?: number; resolve: (position: THREE.Vector3, radius: number) => THREE.Vector3 };

export class WalkController {
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  private readonly speed: number;
  private readonly radius: number;
  private readonly floorY: number;
  private readonly resolve: WalkControllerOptions["resolve"];
  private bobTime = 0;

  constructor(options: WalkControllerOptions) {
    this.speed = options.speed ?? 1.8;
    this.radius = options.capsuleRadius ?? 0.22;
    this.floorY = options.floorY ?? 1.65;
    this.resolve = options.resolve;
    this.position.y = this.floorY;
  }

  update(input: WalkInput, camera: THREE.Camera): void {
    const dt = Math.min(0.05, Math.max(0, input.deltaSeconds));
    const direction = new THREE.Vector3(input.strafe, 0, input.forward);
    if (direction.lengthSq() > 1) direction.normalize();
    direction.applyQuaternion(camera.quaternion);
    direction.y = 0;
    if (direction.lengthSq() > 0) direction.normalize();
    this.velocity.lerp(direction.multiplyScalar(this.speed * (input.sprint ? 1.35 : 1)), 1 - Math.exp(-18 * dt));
    this.position.addScaledVector(this.velocity, dt);
    this.position.copy(this.resolve(this.position, this.radius));
    this.position.y = this.floorY;
    if (this.velocity.lengthSq() > 0.01) this.bobTime += dt * 9;
  }

  getHeadBob(): number { return this.velocity.lengthSq() > 0.01 ? Math.sin(this.bobTime) * 0.012 : 0; }
}
