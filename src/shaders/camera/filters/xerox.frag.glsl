void main() {
  vec2 uv = distortUv(v_uv);
  vec3 color = sampleColor(uv);
  float center = luma(color);

  float edgeX = abs(luma(sampleColor(uv + vec2(0.004, 0.0))) - luma(sampleColor(uv - vec2(0.004, 0.0))));
  float edgeY = abs(luma(sampleColor(uv + vec2(0.0, 0.004))) - luma(sampleColor(uv - vec2(0.0, 0.004))));
  float edge = clamp((edgeX + edgeY) * 6.5, 0.0, 1.0);

  float paper = filmGrain(uv * 1.35 + 0.07, center) * 0.18;
  float poster = floor(clamp(center + paper, 0.0, 1.0) * 4.0) / 3.0;

  float threshold = smoothstep(0.22, 0.68, poster + edge * 0.24);
  vec3 ink = mix(vec3(0.035), vec3(0.9), threshold);

  ink -= vec3(max(0.0, edge - 0.28) * 0.32);
  ink *= 0.92 + filmGrain(uv * 2.4, center) * 0.035;

  gl_FragColor = vec4(clamp(ink, 0.0, 1.0), 1.0);
}