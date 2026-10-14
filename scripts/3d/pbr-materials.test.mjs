import test from "node:test";
import assert from "node:assert/strict";
import { invertDirectXGreenChannel, outputRelativePath, packOrmChannels, PROFILES, REQUIRED_MAPS } from "../fetch-cc0-materials.mjs";
import { isLfsPointer, pngDimensions, renderLicenseRows } from "../validate-pbr-materials.mjs";

test("PBR profiles cover the material library and use unique stable names", () => {
  assert.ok(PROFILES.length >= 18);
  assert.equal(new Set(PROFILES.map(item => item.name)).size, PROFILES.length);
  assert.deepEqual(REQUIRED_MAPS, ["BC", "N", "ORM"]);
  assert.ok(PROFILES.every(item => item.search && item.tags.length && item.roughness >= 0 && item.roughness <= 1));
});
test("ORM packing preserves R=AO, G=roughness, B=metallic", () => {
  assert.deepEqual([...packOrmChannels(Buffer.from([10,20]),Buffer.from([30,40]),Buffer.from([50,60]),2)],[10,30,50,20,40,60]);
  assert.throws(()=>packOrmChannels(Buffer.from([1]),Buffer.from([2]),Buffer.from([3]),2),/length/);
});
test("DirectX normal conversion flips only the green channel", () => {
  const input=Buffer.from([1,20,3,4,200,6]);
  assert.deepEqual([...invertDirectXGreenChannel(input,2,1)],[1,235,3,4,55,6]);
  assert.deepEqual([...input],[1,20,3,4,200,6]);
});
test("PNG dimensions and LFS pointer detection are deterministic", () => {
  const png=Buffer.alloc(24);Buffer.from("89504e470d0a1a0a","hex").copy(png);png.writeUInt32BE(2048,16);png.writeUInt32BE(2048,20);
  assert.deepEqual(pngDimensions(png),{width:2048,height:2048});
  assert.equal(pngDimensions(Buffer.from("no")),null);
  assert.equal(isLfsPointer(Buffer.from("version https://git-lfs.github.com/spec/v1\n")),true);
});
test("license table includes exact IDs, authors and CC0", () => {
  const rows=renderLicenseRows([{material:"wood",sourceAsset:{id:"test_asset",url:"https://polyhaven.com/a/test_asset",authors:["Test Author"]},sourceMaps:{N:{convention:"OpenGL"}}}]);
  const tick=String.fromCharCode(96);
  assert.ok(rows.includes(tick+"test_asset"+tick));assert.ok(rows.includes("CC0 1.0"));assert.ok(rows.includes("Test Author"));
});

test("material manifest paths target final directory, not transient staging", () => {
  assert.equal(
    outputRelativePath("/repo/art/textures/materials.staging/T_wood_BC.png"),
    "art/textures/materials/T_wood_BC.png",
  );
});
