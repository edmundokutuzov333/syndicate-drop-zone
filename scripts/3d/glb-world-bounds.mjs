/**
 * Convert local glTF POSITION accessor bounds to world-space bounds.
 * Quantized POSITION values may be integer coordinates scaled by node/ancestor
 * transforms. The verifier must not interpret those encoded values as metres.
 */
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function multiply4(a, b) {
  const out = new Array(16).fill(0);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      for (let k = 0; k < 4; k += 1) out[column * 4 + row] += a[k * 4 + row] * b[column * 4 + k];
    }
  }
  return out;
}

function localMatrix(node) {
  if (Array.isArray(node.matrix)) {
    if (node.matrix.length !== 16 || !node.matrix.every(Number.isFinite)) throw new Error("Invalid glTF node matrix");
    return [...node.matrix];
  }
  const t = node.translation ?? [0, 0, 0];
  const r = node.rotation ?? [0, 0, 0, 1];
  const s = node.scale ?? [1, 1, 1];
  if (t.length !== 3 || r.length !== 4 || s.length !== 3 || ![...t, ...r, ...s].every(Number.isFinite)) {
    throw new Error("Invalid glTF node TRS");
  }
  const [tx, ty, tz] = t;
  const [x, y, z, w] = r;
  const [sx, sy, sz] = s;
  const xx = x * x, yy = y * y, zz = z * z;
  const xy = x * y, xz = x * z, yz = y * z;
  const wx = w * x, wy = w * y, wz = w * z;
  return [
    (1 - 2 * (yy + zz)) * sx, (2 * (xy + wz)) * sx, (2 * (xz - wy)) * sx, 0,
    (2 * (xy - wz)) * sy, (1 - 2 * (xx + zz)) * sy, (2 * (yz + wx)) * sy, 0,
    (2 * (xz + wy)) * sz, (2 * (yz - wx)) * sz, (1 - 2 * (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ];
}

function worldMatrixForNode(gltf, nodeIndex) {
  const nodes = gltf?.nodes;
  if (!Array.isArray(nodes) || !Number.isInteger(nodeIndex) || nodeIndex < 0 || nodeIndex >= nodes.length) {
    throw new Error("Invalid glTF node index");
  }
  const parents = new Array(nodes.length).fill(-1);
  for (let parent = 0; parent < nodes.length; parent += 1) {
    for (const child of nodes[parent].children ?? []) {
      if (!Number.isInteger(child) || child < 0 || child >= nodes.length) throw new Error("Invalid glTF child index");
      if (parents[child] !== -1 && parents[child] !== parent) throw new Error("glTF node has multiple parents");
      parents[child] = parent;
    }
  }
  const chain = [];
  const seen = new Set();
  let current = nodeIndex;
  while (current !== -1) {
    if (seen.has(current)) throw new Error("Cyclic glTF node hierarchy");
    seen.add(current);
    chain.unshift(current);
    current = parents[current];
  }
  let world = [...IDENTITY];
  for (const index of chain) world = multiply4(world, localMatrix(nodes[index]));
  return world;
}

function transformPoint(matrix, point) {
  const [x, y, z] = point;
  const values = [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
  ];
  const w = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
  if (!Number.isFinite(w) || Math.abs(w) < 1e-12) throw new Error("Invalid homogeneous glTF transform");
  const result = values.map((value) => value / w);
  if (!result.every(Number.isFinite)) throw new Error("Non-finite glTF world coordinate");
  return result;
}


/**
 * Decode glTF accessor min/max from the component storage domain to the
 * values consumed by the vertex shader. Normalized integer POSITION accessors
 * store raw integer bounds in JSON; those values must be normalized before
 * applying node/ancestor transforms or they appear tens of thousands of metres
 * wide. Float and non-normalized accessors remain in their original domain.
 */
export function decodeAccessorBounds(accessor) {
  const { min, max, componentType, normalized = false } = accessor ?? {};
  if (!Array.isArray(min) || !Array.isArray(max) || min.length !== 3 || max.length !== 3 ||
      ![...min, ...max].every(Number.isFinite) ||
      min.some((value, axis) => value > max[axis])) {
    throw new Error("Invalid glTF accessor bounds");
  }
  if (!normalized) return { min: [...min], max: [...max] };

  const normalizers = {
    5120: (value) => Math.max(value / 127, -1),       // BYTE
    5121: (value) => value / 255,                     // UNSIGNED_BYTE
    5122: (value) => Math.max(value / 32767, -1),     // SHORT
    5123: (value) => value / 65535,                   // UNSIGNED_SHORT
  };
  const normalize = normalizers[componentType];
  if (!normalize) {
    throw new Error("Unsupported normalized glTF accessor componentType: " + componentType);
  }
  return { min: min.map(normalize), max: max.map(normalize) };
}

export function getNodeWorldBounds(gltf, nodeIndex, localMin, localMax) {
  if (!Array.isArray(localMin) || !Array.isArray(localMax) || localMin.length !== 3 || localMax.length !== 3 ||
      ![...localMin, ...localMax].every(Number.isFinite) ||
      localMin.some((value, axis) => value > localMax[axis])) {
    throw new Error("Invalid local glTF bounds");
  }
  const matrix = worldMatrixForNode(gltf, nodeIndex);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const x of [localMin[0], localMax[0]]) {
    for (const y of [localMin[1], localMax[1]]) {
      for (const z of [localMin[2], localMax[2]]) {
        const point = transformPoint(matrix, [x, y, z]);
        for (let axis = 0; axis < 3; axis += 1) {
          min[axis] = Math.min(min[axis], point[axis]);
          max[axis] = Math.max(max[axis], point[axis]);
        }
      }
    }
  }
  return { min, max, size: max.map((value, axis) => value - min[axis]) };
}
