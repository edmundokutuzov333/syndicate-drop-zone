import { expect, test } from "@playwright/test";

test("public CAMPING serves the promoted manifest and no legacy GLB", async ({ request }) => {
  const manifestResponse = await request.get("/models/camping/manifest.json", { headers: { "cache-control": "no-cache" } });
  expect(manifestResponse.ok()).toBeTruthy();
  const manifest = await manifestResponse.json();
  expect(manifest.schema).toBe(1);
  expect(Number(manifest.phase)).toBeGreaterThanOrEqual(14);
  expect(manifest.files).toEqual(expect.arrayContaining([
    expect.objectContaining({ role: "visual", tier: "high" }),
    expect.objectContaining({ role: "collider", tier: "canonical" }),
  ]));
  for (const record of manifest.files) {
    const response = await request.get("/" + String(record.path).replace(/^\/+/, ""), { headers: { "cache-control": "no-cache" } });
    expect(response.ok(), record.path).toBeTruthy();
    expect((await response.body()).byteLength).toBe(Number(record.bytes));
  }
  expect((await request.get("/models/camping/xoyens-studio.legacy.glb")).status()).toBe(404);
});
