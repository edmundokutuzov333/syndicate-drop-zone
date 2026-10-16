import * as THREE from "three";
import {
  createStudioCollisionConfig,
  type PointXZ,
  type RectCollider,
  type StudioCollisionConfig,
} from "../camera/camping-collision";

export type CampingRoomId = "studio" | "archive" | "listening" | "secret";
export type CampingInteriorRoomId = Exclude<CampingRoomId, "studio">;

export type CampingRoomLayout = {
  door: PointXZ;
  normal: PointXZ;
  side: PointXZ;
  centers: Record<CampingInteriorRoomId, PointXZ>;
};

export type CampingRoomEntry = {
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
};

type RoomDimensions = { width: number; depth: number; height: number };

const ROOM_DIMENSIONS: Record<CampingInteriorRoomId, RoomDimensions> = {
  archive: { width: 12, depth: 12, height: 3.25 },
  listening: { width: 10.8, depth: 10.8, height: 2.9 },
  secret: { width: 10, depth: 10, height: 2.75 },
};

const DOOR_WIDTH = 1.68;
const DOOR_HEIGHT = 2.42;
const WALL_THICKNESS = 0.22;
const CAM_HEIGHT = 1.62;

function add(a: PointXZ, b: PointXZ, scale = 1): PointXZ {
  return { x: a.x + b.x * scale, z: a.z + b.z * scale };
}

function opposite(direction: PointXZ): PointXZ {
  return { x: -direction.x, z: -direction.z };
}

export function createCampingRoomLayout(door: PointXZ): CampingRoomLayout {
  const candidates: Array<{ distance: number; direction: PointXZ }> = [
    { distance: Math.abs(door.x - -6.55), direction: { x: -1, z: 0 } },
    { distance: Math.abs(6.55 - door.x), direction: { x: 1, z: 0 } },
    { distance: Math.abs(door.z - -4.18), direction: { x: 0, z: -1 } },
    { distance: Math.abs(4.08 - door.z), direction: { x: 0, z: 1 } },
  ];
  candidates.sort((a, b) => a.distance - b.distance);
  const normal = candidates[0]?.direction ?? { x: 0, z: -1 };
  const side = { x: -normal.z, z: normal.x };
  const archiveDoorOffset = 6.1;
  const archiveCenter = add(door, normal, archiveDoorOffset);
  return {
    door,
    normal,
    side,
    centers: {
      archive: archiveCenter,
      listening: add(archiveCenter, side, 12.15),
      secret: add(door, normal, archiveDoorOffset + ROOM_DIMENSIONS.archive.depth / 2 + ROOM_DIMENSIONS.secret.depth / 2),
    },
  };
}

export function getCampingRoomEntry(
  roomId: CampingRoomId,
  layout: CampingRoomLayout,
): CampingRoomEntry {
  if (roomId === "studio") {
    const position = add(layout.door, opposite(layout.normal), 2.1);
    const look = add(layout.door, opposite(layout.normal), 5.1);
    return {
      position: new THREE.Vector3(position.x, CAM_HEIGHT, position.z),
      lookAt: new THREE.Vector3(look.x, 1.52, look.z),
    };
  }

  if (roomId === "archive") {
    const position = add(layout.door, layout.normal, 3.05);
    const look = add(layout.door, layout.normal, 8.2);
    return {
      position: new THREE.Vector3(position.x, CAM_HEIGHT, position.z),
      lookAt: new THREE.Vector3(look.x, 1.42, look.z),
    };
  }

  if (roomId === "listening") {
    const center = layout.centers.listening;
    const position = add(center, opposite(layout.side), 3.75);
    const look = add(center, layout.side, 1.6);
    return {
      position: new THREE.Vector3(position.x, CAM_HEIGHT, position.z),
      lookAt: new THREE.Vector3(look.x, 1.35, look.z),
    };
  }

  const center = layout.centers.secret;
  const position = add(center, opposite(layout.normal), 3.7);
  const look = add(center, layout.normal, 1.6);
  return {
    position: new THREE.Vector3(position.x, CAM_HEIGHT, position.z),
    lookAt: new THREE.Vector3(look.x, 1.4, look.z),
  };
}

function dimensionsFor(roomId: CampingInteriorRoomId): RoomDimensions {
  return ROOM_DIMENSIONS[roomId];
}

function rectAlongAxis(
  center: PointXZ,
  axis: PointXZ,
  length: number,
  width: number,
  id: string,
): RectCollider {
  const halfX = (Math.abs(axis.x) * length + Math.abs(axis.z) * width) / 2;
  const halfZ = (Math.abs(axis.z) * length + Math.abs(axis.x) * width) / 2;
  return {
    id,
    minX: center.x - halfX,
    maxX: center.x + halfX,
    minZ: center.z - halfZ,
    maxZ: center.z + halfZ,
  };
}

export function getCampingRoomCollision(
  roomId: CampingRoomId,
  layout: CampingRoomLayout,
): StudioCollisionConfig {
  if (roomId === "studio") return createStudioCollisionConfig();
  const center = layout.centers[roomId];
  const size = dimensionsFor(roomId);
  const colliders: RectCollider[] = [];
  const portalSpecs = roomId === "archive"
    ? [
        { id: "room.archive.return-door", direction: opposite(layout.normal) },
        { id: "room.archive.listening-door", direction: layout.side },
        { id: "room.archive.secret-door", direction: layout.normal },
      ]
    : roomId === "listening"
      ? [{ id: "room.listening.return-door", direction: opposite(layout.side) }]
      : [{ id: "room.secret.return-door", direction: opposite(layout.normal) }];

  const wallDirections = [
    { x: -1, z: 0 }, { x: 1, z: 0 },
    { x: 0, z: -1 }, { x: 0, z: 1 },
  ];
  for (const direction of wallDirections) {
    const wallLength = Math.abs(direction.x) > 0 ? size.depth : size.width;
    const wallDistance = Math.abs(direction.x) > 0 ? size.width / 2 : size.depth / 2;
    const wallCenter = add(center, direction, wallDistance);
    const wallAxis = { x: -direction.z, z: direction.x };
    const portal = portalSpecs.find((item) => item.direction.x === direction.x && item.direction.z === direction.z);
    if (!portal) {
      colliders.push(rectAlongAxis(wallCenter, wallAxis, wallLength, WALL_THICKNESS * 2, "room-wall-" + roomId + "-" + direction.x + "-" + direction.z));
      continue;
    }

    const opening = DOOR_WIDTH + 0.18;
    const segmentLength = (wallLength - opening) / 2;
    for (const sign of [-1, 1]) {
      const segmentCenter = add(wallCenter, wallAxis, sign * (opening / 2 + segmentLength / 2));
      colliders.push(rectAlongAxis(segmentCenter, wallAxis, segmentLength, WALL_THICKNESS * 2, "room-wall-" + roomId + "-" + direction.x + "-" + direction.z + "-" + sign));
    }
    // The physical door panel remains a collider until it is clicked and opens.
    colliders.push(rectAlongAxis(wallCenter, wallAxis, DOOR_WIDTH * 0.93, WALL_THICKNESS * 2.2, portal.id + ".closed-leaf"));
  }

  const furniturePoint = (sideOffset: number, normalOffset: number): PointXZ =>
    add(add(center, layout.side, sideOffset), layout.normal, normalOffset);

  if (roomId === "archive") {
    colliders.push(
      rectAlongAxis(furniturePoint(-4.8, 0), layout.normal, 5.1, 1.1, "archive-west-shelving"),
      rectAlongAxis(furniturePoint(1.2, -0.8), layout.side, 2.0, 1.4, "archive-record-table"),
      rectAlongAxis(furniturePoint(4.25, 2.7), layout.side, 1.25, 1.1, "archive-secret-drawer"),
      rectAlongAxis(furniturePoint(-1.2, 4.1), layout.side, 1.6, 1.2, "archive-crates"),
    );
  } else if (roomId === "listening") {
    colliders.push(
      rectAlongAxis(furniturePoint(0.8, -1.1), layout.side, 3.2, 1.55, "listening-sofa"),
      rectAlongAxis(furniturePoint(3.7, 3.8), layout.normal, 1.1, 2.0, "listening-speakers"),
      rectAlongAxis(furniturePoint(-3.65, 3.7), layout.normal, 1.0, 0.8, "listening-equipment"),
    );
  } else {
    colliders.push(
      rectAlongAxis(furniturePoint(1.8, 2.8), layout.side, 2.0, 1.2, "secret-secure-cabinet"),
      rectAlongAxis(furniturePoint(-3.6, 3.6), layout.normal, 1.0, 0.8, "secret-file-shelves"),
    );
  }

  return createStudioCollisionConfig({
    minX: center.x - size.width / 2,
    maxX: center.x + size.width / 2,
    minZ: center.z - size.depth / 2,
    maxZ: center.z + size.depth / 2,
    radius: 0.28,
    colliders,
  });
}

function material(
  color: number,
  roughness = 0.86,
  metalness = 0,
  emissive = 0x000000,
  emissiveIntensity = 0,
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity });
}

function addBox(
  parent: THREE.Object3D,
  mat: THREE.Material,
  position: [number, number, number],
  size: [number, number, number],
  name: string,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function labelTexture(label: string, accent = "#b58c5a"): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#090807";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 5;
    ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
    ctx.fillStyle = "#e2d0b4";
    ctx.font = "700 28px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label.toUpperCase(), canvas.width / 2, canvas.height / 2, canvas.width - 24);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function addLabel(
  parent: THREE.Object3D,
  label: string,
  position: [number, number, number],
  width = 1.25,
  height = 0.22,
  rotationY = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({
      map: labelTexture(label),
      transparent: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    }),
  );
  mesh.position.set(...position);
  mesh.rotation.y = rotationY;
  mesh.renderOrder = 2;
  mesh.name = "room.label." + label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  parent.add(mesh);
  return mesh;
}

function wallWithOpening(
  group: THREE.Group,
  direction: PointXZ,
  width: number,
  depth: number,
  height: number,
  wallMaterial: THREE.Material,
): void {
  const opening = DOOR_WIDTH + 0.18;
  if (Math.abs(direction.z) > 0) {
    const segmentWidth = (width - opening) / 2;
    const z = direction.z * depth / 2;
    addBox(group, wallMaterial, [-(opening / 2 + segmentWidth / 2), height / 2, z], [segmentWidth, height, WALL_THICKNESS], "room.wall.segment");
    addBox(group, wallMaterial, [opening / 2 + segmentWidth / 2, height / 2, z], [segmentWidth, height, WALL_THICKNESS], "room.wall.segment");
    addBox(group, wallMaterial, [0, (height + DOOR_HEIGHT) / 2, z], [opening, height - DOOR_HEIGHT, WALL_THICKNESS], "room.wall.lintel");
  } else {
    const segmentDepth = (depth - opening) / 2;
    const x = direction.x * width / 2;
    addBox(group, wallMaterial, [x, height / 2, -(opening / 2 + segmentDepth / 2)], [WALL_THICKNESS, height, segmentDepth], "room.wall.segment");
    addBox(group, wallMaterial, [x, height / 2, opening / 2 + segmentDepth / 2], [WALL_THICKNESS, height, segmentDepth], "room.wall.segment");
    addBox(group, wallMaterial, [x, (height + DOOR_HEIGHT) / 2, 0], [WALL_THICKNESS, height - DOOR_HEIGHT, opening], "room.wall.lintel");
  }
}

function addPortal(
  group: THREE.Group,
  id: string,
  label: string,
  direction: PointXZ,
  size: RoomDimensions,
  visible = true,
): THREE.Group {
  const portal = new THREE.Group();
  portal.name = id;
  portal.userData.interactionId = id;
  portal.userData.isRoomDoor = true;
  portal.visible = visible;

  if (Math.abs(direction.x) > 0) {
    portal.position.set(direction.x * size.width / 2, 0, 0);
    portal.rotation.y = direction.x > 0 ? -Math.PI / 2 : Math.PI / 2;
  } else {
    portal.position.set(0, 0, direction.z * size.depth / 2);
    portal.rotation.y = direction.z > 0 ? Math.PI : 0;
  }

  const frame = material(0x393027, 0.67, 0.52);
  const trim = material(0x765337, 0.72, 0.26);
  addBox(portal, frame, [-0.91, 1.24, 0], [0.12, 2.48, 0.18], "room.door.frame-left");
  addBox(portal, frame, [0.91, 1.24, 0], [0.12, 2.48, 0.18], "room.door.frame-right");
  addBox(portal, trim, [0, 2.48, 0], [1.94, 0.14, 0.2], "room.door.frame-top");

  const pivot = new THREE.Group();
  pivot.name = "door-pivot";
  pivot.position.set(-0.82, 0, 0);
  pivot.userData.isDoorPivot = true;
  portal.add(pivot);
  addBox(pivot, material(0x211a13, 0.9), [0.82, 1.2, -0.035], [1.62, 2.36, 0.085], "room.door.leaf");
  addBox(pivot, trim, [0.82, 0.12, 0.02], [1.45, 0.06, 0.025], "room.door.trim");
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 8), material(0xb29a74, 0.3, 0.8));
  knob.position.set(1.42, 1.18, 0.035);
  pivot.add(knob);
  portal.userData.doorPivot = pivot;

  addLabel(portal, label, [0, 2.72, 0.12], 1.85, 0.2);
  group.add(portal);
  return portal;
}

function addRoomShell(
  group: THREE.Group,
  dimensions: RoomDimensions,
  colors: { wall: number; floor: number; ceiling: number; trim: number },
  portals: Array<{ id: string; label: string; direction: PointXZ; visible?: boolean }>,
): void {
  const wallMat = material(colors.wall, 0.92);
  const floorMat = material(colors.floor, 0.75);
  const ceilingMat = material(colors.ceiling, 0.96);
  const trimMat = material(colors.trim, 0.66, 0.3);
  addBox(group, floorMat, [0, -0.075, 0], [dimensions.width, 0.15, dimensions.depth], "room.floor");
  addBox(group, ceilingMat, [0, dimensions.height, 0], [dimensions.width, 0.14, dimensions.depth], "room.ceiling");

  const sideDirs = [
    { x: -1, z: 0 }, { x: 1, z: 0 },
    { x: 0, z: -1 }, { x: 0, z: 1 },
  ];
  for (const side of sideDirs) {
    const portal = portals.find((item) => item.direction.x === side.x && item.direction.z === side.z);
    if (portal) {
      wallWithOpening(group, side, dimensions.width, dimensions.depth, dimensions.height, wallMat);
    } else if (Math.abs(side.z) > 0) {
      addBox(group, wallMat, [0, dimensions.height / 2, side.z * dimensions.depth / 2], [dimensions.width, dimensions.height, WALL_THICKNESS], "room.wall");
    } else {
      addBox(group, wallMat, [side.x * dimensions.width / 2, dimensions.height / 2, 0], [WALL_THICKNESS, dimensions.height, dimensions.depth], "room.wall");
    }
  }

  for (let x = -1; x <= 1; x += 1) {
    const beam = addBox(group, trimMat, [x * dimensions.width * 0.28, dimensions.height - 0.13, 0], [0.09, 0.12, dimensions.depth], "room.ceiling.beam");
    beam.castShadow = false;
  }

  for (const portal of portals) addPortal(group, portal.id, portal.label, portal.direction, dimensions, portal.visible ?? true);

  const practical = new THREE.PointLight(
    dimensions.height < 3 ? 0xffb16b : 0xffc17a,
    dimensions.height < 3 ? 25 : 34,
    Math.max(dimensions.width, dimensions.depth) * 1.35,
    2,
  );
  practical.position.set(0, dimensions.height - 0.38, 0);
  group.add(practical);

  const red = new THREE.PointLight(0x6d1110, 7, 5, 2);
  red.position.set(-dimensions.width * 0.38, 1.5, dimensions.depth * 0.36);
  group.add(red);
}

function atDirections(side: PointXZ, normal: PointXZ, sideOffset: number, normalOffset: number): [number, number, number] {
  return [
    side.x * sideOffset + normal.x * normalOffset,
    0,
    side.z * sideOffset + normal.z * normalOffset,
  ];
}

function addCrate(
  group: THREE.Group,
  position: [number, number, number],
  label: string,
  interactive = false,
): THREE.Group {
  const root = new THREE.Group();
  root.name = interactive ? "room.archive.record-" + label : "room.archive.crate-" + label;
  if (interactive) root.userData.interactionId = "room.archive.records";
  root.position.set(...position);
  const wood = material(0x38271b, 0.94);
  const edge = material(0x705038, 0.82);
  const width = 0.88;
  const height = 0.52;
  const depth = 0.72;
  addBox(root, wood, [0, height / 2, 0], [width, height, depth], "archive.crate.body");
  for (const y of [0.12, 0.34]) {
    addBox(root, edge, [0, y, depth / 2 + 0.009], [width * 0.92, 0.025, 0.025], "archive.crate.brace");
  }
  addLabel(root, "ARCHIVE / " + label, [0, height * 0.62, depth / 2 + 0.024], 0.74, 0.17);
  group.add(root);
  return root;
}

function addArchiveFurniture(group: THREE.Group, layout: CampingRoomLayout, center: PointXZ): void {
  const shelfWood = material(0x241b14, 0.91);
  const shelfMetal = material(0x3f3b35, 0.56, 0.68);
  const paper = material(0xb7a487, 0.95);
  const shelfPosition = atDirections(layout.side, layout.normal, -4.55, 0.0);
  const shelf = new THREE.Group();
  shelf.name = "room.archive.shelf";
  shelf.position.set(shelfPosition[0], 0, shelfPosition[2]);
  addBox(shelf, shelfMetal, [-0.58, 1.28, 0], [0.08, 2.56, 5.4], "archive.shelf.rail");
  addBox(shelf, shelfMetal, [0.58, 1.28, 0], [0.08, 2.56, 5.4], "archive.shelf.rail");
  for (const y of [0.22, 0.82, 1.42, 2.02, 2.58]) {
    addBox(shelf, shelfWood, [0, y, 0], [1.32, 0.09, 5.45], "archive.shelf.plank");
  }
  for (let i = 0; i < 5; i += 1) {
    const file = addBox(shelf, paper, [-0.2 + (i % 3) * 0.28, 0.48, -1.75 + i * 0.78], [0.22, 0.44, 0.52], "archive.file");
    file.rotation.y = i % 2 ? 0.04 : -0.05;
  }
  group.add(shelf);

  const crates = [
    { s: -1.2, n: 0.8, label: "001" },
    { s: -0.4, n: 1.15, label: "002" },
    { s: 0.45, n: 1.0, label: "003" },
    { s: 1.1, n: 0.72, label: "004" },
  ];
  crates.forEach((crate, index) => {
    const p = atDirections(layout.side, layout.normal, crate.s, crate.n);
    addCrate(group, [p[0], 0, p[2]], crate.label, index < 3);
  });

  const drawerPosition = atDirections(layout.side, layout.normal, 4.1, 2.55);
  const drawer = new THREE.Group();
  drawer.name = "studio.secret-drawer";
  drawer.userData.interactionId = "studio.secret-drawer";
  drawer.position.set(drawerPosition[0], 0, drawerPosition[2]);
  addBox(drawer, shelfWood, [0, 0.55, 0], [1.25, 1.1, 0.9], "secret.drawer.cabinet");
  addBox(drawer, shelfMetal, [0, 0.84, 0.466], [0.92, 0.42, 0.07], "secret.drawer.front");
  addBox(drawer, material(0x9a7b50, 0.38, 0.82), [0, 0.84, 0.52], [0.2, 0.045, 0.04], "secret.drawer.handle");
  addLabel(drawer, "UNLISTED / 808", [0, 1.2, 0.47], 1.12, 0.18, 0);
  group.add(drawer);

  const tablePosition = atDirections(layout.side, layout.normal, 0.7, -1.65);
  const table = new THREE.Group();
  table.name = "room.archive.table";
  table.position.set(tablePosition[0], 0, tablePosition[2]);
  addBox(table, shelfWood, [0, 0.88, 0], [2.3, 0.13, 1.15], "archive.table.top");
  for (const x of [-0.93, 0.93]) {
    for (const z of [-0.4, 0.4]) addBox(table, shelfMetal, [x, 0.43, z], [0.09, 0.86, 0.09], "archive.table.leg");
  }
  addLabel(table, "PUBLISHED FILES", [0, 0.98, 0.35], 1.2, 0.16);
  group.add(table);
  void center;
}

function addSofa(group: THREE.Group, side: PointXZ, normal: PointXZ): void {
  const pos = atDirections(side, normal, 1.3, -1.25);
  const sofa = new THREE.Group();
  sofa.name = "room.listening.sofa";
  sofa.position.set(pos[0], 0, pos[2]);
  sofa.rotation.y = Math.abs(side.x) > 0 ? 0 : Math.PI / 2;
  const leather = material(0x171514, 0.82);
  const seam = material(0x292522, 0.9);
  addBox(sofa, leather, [0, 0.38, 0], [3.1, 0.48, 1.15], "listening.sofa.seat");
  addBox(sofa, leather, [0, 0.88, -0.43], [3.1, 0.9, 0.28], "listening.sofa.back");
  addBox(sofa, seam, [-1.48, 0.55, 0], [0.22, 0.66, 1.18], "listening.sofa.arm");
  addBox(sofa, seam, [1.48, 0.55, 0], [0.22, 0.66, 1.18], "listening.sofa.arm");
  group.add(sofa);
}

function addListeningSystem(group: THREE.Group, layout: CampingRoomLayout): void {
  const speakerPosition = atDirections(layout.side, layout.normal, 3.55, 3.6);
  const speakers = new THREE.Group();
  speakers.name = "studio.audio-system";
  speakers.userData.interactionId = "studio.audio-system";
  speakers.position.set(speakerPosition[0], 0, speakerPosition[2]);

  for (const x of [-0.68, 0.68]) {
    addBox(speakers, material(0x0b0b0b, 0.55, 0.12), [x, 0.92, 0], [0.86, 1.6, 0.64], "listening.speaker.cabinet");
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.035, 28), material(0x777168, 0.43, 0.3));
    cone.rotation.x = Math.PI / 2;
    cone.position.set(x, 0.84, 0.33);
    speakers.add(cone);
    const tweeter = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.04, 20), material(0xb49a72, 0.35, 0.55));
    tweeter.rotation.x = Math.PI / 2;
    tweeter.position.set(x, 1.35, 0.34);
    speakers.add(tweeter);
  }
  addLabel(speakers, "FREQUENCIA 808", [0, 1.86, 0.34], 1.75, 0.22);
  group.add(speakers);

  const standPosition = atDirections(layout.side, layout.normal, -3.5, 3.45);
  const console = new THREE.Group();
  console.name = "room.listening.control-console";
  console.position.set(standPosition[0], 0, standPosition[2]);
  addBox(console, material(0x191714, 0.66, 0.36), [0, 0.8, 0], [1.1, 1.6, 0.62], "listening.console");
  addBox(console, material(0x101817, 0.5, 0.12, 0x17342d, 0.45), [0, 1.12, 0.326], [0.72, 0.38, 0.035], "listening.console.screen");
  addLabel(console, "LIVE / CONTROL", [0, 1.42, 0.33], 0.86, 0.14);
  group.add(console);
}

function addSecretVault(group: THREE.Group, layout: CampingRoomLayout): void {
  const position = atDirections(layout.side, layout.normal, 1.8, 2.8);
  const vault = new THREE.Group();
  vault.name = "studio.secret-vault";
  vault.userData.interactionId = "studio.secret-vault";
  vault.position.set(position[0], 0, position[2]);
  const iron = material(0x171716, 0.65, 0.72);
  const trim = material(0x67302a, 0.65, 0.45, 0x330706, 0.15);
  addBox(vault, iron, [0, 1.15, 0], [2.05, 2.3, 0.82], "secret.vault.body");
  addBox(vault, trim, [0, 1.15, 0.43], [1.8, 2.05, 0.09], "secret.vault.front");
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.09, 32), material(0xb59668, 0.37, 0.8));
  dial.rotation.x = Math.PI / 2;
  dial.position.set(0, 1.2, 0.51);
  vault.add(dial);
  addLabel(vault, "ACCESS RESTRICTED", [0, 1.76, 0.5], 1.45, 0.18, 0);
  group.add(vault);
}

export function createCampingInteriorRoom(
  roomId: CampingInteriorRoomId,
  layout: CampingRoomLayout,
): THREE.Group {
  const dimensions = dimensionsFor(roomId);
  const center = layout.centers[roomId];
  const group = new THREE.Group();
  group.name = "CAMPING / ROOM " + roomId.toUpperCase();
  group.position.set(center.x, 0, center.z);
  group.userData.roomId = roomId;
  group.visible = false;

  const toStudio = opposite(layout.normal);
  const toSecret = layout.normal;
  const toListening = layout.side;
  const roomPortals: Array<{ id: string; label: string; direction: PointXZ; visible?: boolean }> = [];

  if (roomId === "archive") {
    roomPortals.push(
      { id: "room.archive.return-door", label: "ROOM 01 / RETURN", direction: toStudio },
      { id: "room.archive.listening-door", label: "LISTENING ROOM", direction: toListening },
      { id: "room.archive.secret-door", label: "UNLISTED / 808", direction: toSecret, visible: false },
    );
    addRoomShell(group, dimensions, { wall: 0x171411, floor: 0x302117, ceiling: 0x201710, trim: 0x725236 }, roomPortals);
    addArchiveFurniture(group, layout, center);
    const lamp = new THREE.PointLight(0xffb36c, 20, 7, 2);
    lamp.position.set(-dimensions.width * 0.18, 2.75, -dimensions.depth * 0.15);
    group.add(lamp);
    const redLamp = new THREE.PointLight(0x6b1110, 8, 5, 2);
    redLamp.position.set(dimensions.width * 0.38, 1.7, dimensions.depth * 0.28);
    group.add(redLamp);
  } else if (roomId === "listening") {
    roomPortals.push(
      { id: "room.listening.return-door", label: "THE ARCHIVE", direction: opposite(layout.side) },
    );
    addRoomShell(group, dimensions, { wall: 0x10100f, floor: 0x241b15, ceiling: 0x12100e, trim: 0x57402b }, roomPortals);
    addSofa(group, layout.side, layout.normal);
    addListeningSystem(group, layout);
    const ambient = new THREE.PointLight(0xff9e57, 17, 7, 2);
    ambient.position.set(-layout.side.x * 2.6, 2.45, -layout.side.z * 2.6);
    group.add(ambient);
    const practical = new THREE.PointLight(0xb14a2c, 5, 4, 2);
    practical.position.set(layout.normal.x * 3.9, 1.5, layout.normal.z * 3.9);
    group.add(practical);
  } else {
    roomPortals.push(
      { id: "room.secret.return-door", label: "RETURN / ARCHIVE", direction: opposite(layout.normal) },
    );
    addRoomShell(group, dimensions, { wall: 0x0c0b0a, floor: 0x16110e, ceiling: 0x0c0b0a, trim: 0x57211e }, roomPortals);
    addSecretVault(group, layout);
    const warning = new THREE.PointLight(0x79100e, 9, 5, 2);
    warning.position.set(0, 2.05, 1.3);
    group.add(warning);
    const lowWarm = new THREE.PointLight(0xff7b42, 4, 4, 2);
    lowWarm.position.set(-2.8, 1.5, -2.7);
    group.add(lowWarm);
    addLabel(group, "YOU WERE NOT SUPPOSED TO FIND THIS", [0, 2.3, -dimensions.depth / 2 + 0.16], 3.9, 0.3);
  }

  return group;
}
