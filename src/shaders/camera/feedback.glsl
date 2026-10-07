vec3 feedbackBlend(vec2 uv, vec3 current) {
  if (u_feedback <= 0.001) return current;

  vec2 driftA = vec2(
    sin(u_time * 1.4 + uv.y * 9.0) * 0.004,
    cos(u_time * 1.1 + uv.x * 8.0) * 0.004
  );
  vec2 driftB = driftA * -0.62;

  vec3 previousA = samplePrevious(distortUv(uv + driftA));
  vec3 previousB = samplePrevious(distortUv(uv + driftB));
  vec3 temporal = mix(previousA, previousB, 0.5);

  float weight = clamp(u_feedback, 0.0, 0.72);
  return mix(current, mix(current, temporal, 0.62), weight);
}
