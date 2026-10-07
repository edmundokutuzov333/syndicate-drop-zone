vec3 feedbackBlend(vec2 uv, vec3 current) {
  if (u_feedback <= 0.001) return current;

  vec3 previous = samplePrevious(distortUv(uv + vec2(
    sin(u_time * 1.4 + uv.y * 8.0) * 0.003,
    cos(u_time * 1.1 + uv.x * 7.0) * 0.003
  )));

  float weight = clamp(u_feedback, 0.0, 0.65);
  return mix(current, mix(current, previous, 0.58), weight);
}