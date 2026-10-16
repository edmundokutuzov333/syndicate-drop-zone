vec2 distortUv(vec2 uv) {
  // Geometric lens curvature only. Animated signal waves are an opt-in post effect.
  vec2 p = uv * 2.0 - 1.0;
  float radius = dot(p, p);
  p *= 1.0 + radius * u_distortion * 0.46;
  return clamp(p * 0.5 + 0.5, 0.0, 1.0);
}
