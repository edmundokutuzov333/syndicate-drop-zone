vec3 chromaticSample(vec2 uv) {
  float pulseAmount = 0.62 + 0.38 * sin(u_time * 2.15);
  float amount = u_chromatic * pulseAmount;
  vec2 drift = vec2(amount, amount * 0.34);
  vec3 color;
  color.r = sampleColor(distortUv(uv + drift)).r;
  color.g = sampleColor(distortUv(uv)).g;
  color.b = sampleColor(distortUv(uv - drift)).b;
  return color;
}
