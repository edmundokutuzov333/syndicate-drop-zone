vec3 chromaticSample(vec2 uv) {
  float amount = u_chromatic * (0.55 + 0.45 * sin(u_time * 1.7));
  vec2 drift = vec2(amount, amount * 0.35);
  vec3 color;
  color.r = sampleColor(distortUv(uv + drift)).r;
  color.g = sampleColor(distortUv(uv)).g;
  color.b = sampleColor(distortUv(uv - drift)).b;
  return color;
}