vec3 thermalPalette(float value) {
  value = clamp(value, 0.0, 1.0);
  vec3 low = vec3(0.02, 0.04, 0.23);
  vec3 mid = vec3(0.74, 0.02, 0.08);
  vec3 high = vec3(1.0, 0.82, 0.16);

  vec3 cold = mix(low, mid, smoothstep(0.08, 0.58, value));
  return mix(cold, high, smoothstep(0.52, 0.96, value));
}

void main() {
  vec2 uv = distortUv(v_uv);
  vec3 source = sampleColor(uv);
  float lum = luma(source);

  float edgeX = abs(luma(sampleColor(uv + vec2(0.006, 0.0))) - luma(sampleColor(uv - vec2(0.006, 0.0))));
  float edgeY = abs(luma(sampleColor(uv + vec2(0.0, 0.006))) - luma(sampleColor(uv - vec2(0.0, 0.006))));
  float edge = clamp((edgeX + edgeY) * 4.8, 0.0, 1.0);

  float sensor = filmGrain(uv, lum) * 0.12;
  vec3 color = thermalPalette(lum + sensor + edge * 0.04);
  color = mix(color, color + vec3(edge * 0.18), 0.7);
  color *= vignette(v_uv, 0.26);

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}