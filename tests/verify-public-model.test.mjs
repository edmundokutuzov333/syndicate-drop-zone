import test from "node:test";
import assert from "node:assert/strict";
import { glbMetrics, inspectGlb } from "../scripts/ci/verify-public-model.mjs";

function fixtureGlb() {
  const json = Buffer.from(JSON.stringify({
    asset: { version: "2.0" },
    nodes: [{ name: "COL_floor", mesh: 0, extras: { collider: "box" } }],
    meshes: [{ primitives: [{ indices: 0 }] }],
    accessors: [{ count: 3 }],
  }).padEnd(Math.ceil(JSON.stringify({}).length / 4) * 4, " "));
  const paddedLength = Math.ceil(json.length / 4) * 4;
  const body = Buffer.alloc(paddedLength, 0x20);
  json.copy(body);
  const header = Buffer.alloc(12);
  header.write("glTF", 0, "ascii");
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + body.length, 8);
  const chunk = Buffer.alloc(8);
  chunk.writeUInt32LE(body.length, 0);
  chunk.writeUInt32LE(0x4e4f534a, 4);
  return Buffer.concat([header, chunk, body]);
}

test("public model verifier parses GLB JSON and metrics", () => {
  const bytes = fixtureGlb();
  const json = inspectGlb(bytes);
  assert.equal(json.asset.version, "2.0");
  const metrics = glbMetrics(bytes);
  assert.equal(metrics.triangles, 1);
  assert.equal(metrics.hasColliderNodes, true);
  assert.equal(metrics.colliderNodes[0].extras.collider, "box");
});

test("public model verifier rejects malformed GLB", () => {
  assert.throws(() => inspectGlb(Buffer.from("not-a-glb")), /invalid GLB header/);
});
