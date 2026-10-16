/**
 * Compare production metadata with the model metadata promoted from the current checkout.
 * A stale GLB and its stale manifest can agree with each other; that is not publication proof.
 */
export function productionMetadataMismatches(expected, actual) {
  const failures = [];
  const expectedSha = expected?.geometry?.sha256;
  const expectedBytes = expected?.geometry?.bytes;
  const expectedModel = expected?.model;
  const expectedSourceCommit = expected?.sourceCommit;

  if (actual?.geometry?.sha256 !== expectedSha) failures.push("geometry.sha256 differs from current checkout");
  if (actual?.frontendDelivery?.sha256 !== expectedSha) failures.push("frontendDelivery.sha256 differs from current checkout");
  if (actual?.geometry?.bytes !== expectedBytes) failures.push("geometry.bytes differs from current checkout");
  if (actual?.frontendDelivery?.bytes !== expectedBytes) failures.push("frontendDelivery.bytes differs from current checkout");
  if (actual?.model !== expectedModel) failures.push("model URL differs from current checkout");
  if (actual?.frontendDelivery?.canonicalUrl !== expectedModel) failures.push("frontendDelivery.canonicalUrl differs from current checkout");
  if (actual?.sourceCommit !== expectedSourceCommit) failures.push("sourceCommit differs from current checkout");
  for (const key of ["version", "phase", "productionPhase", "surfacePhase", "status"]) {
    if (actual?.[key] !== expected?.[key]) failures.push(key + " differs from current checkout");
  }
  return failures;
}
