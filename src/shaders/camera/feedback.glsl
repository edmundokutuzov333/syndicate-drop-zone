vec3 feedbackBlend(vec2 uv, vec3 current) {
  if (u_feedback <= 0.001) return current;
  // Temporal persistence uses the same coordinates; it does not bend the source.
  vec3 previous = samplePrevious(uv);
  float weight = clamp(u_feedback, 0.0, 0.72);
  return mix(current, previous, weight * 0.62);
}
