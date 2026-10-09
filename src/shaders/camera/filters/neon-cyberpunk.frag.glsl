uniform float u_glitchAmount;

void main() {
  vec2 uv = v_uv;
  float row = floor(uv.y * u_resolution.y / 3.0);
  float lineClock = floor(u_time * 10.0);
  float glitchLine = step(0.94, hash12(vec2(row, lineClock)));
  uv.x += (hash12(vec2(row + 17.0, lineClock)) - 0.5) * glitchLine * (0.004 + u_glitchAmount * 0.06);
  vec2 split = vec2((0.003 + u_chromatic * 0.62) * u_intensity, 0.0);
  vec3 color = vec3(sampleColor(uv + split).r, sampleColor(uv).g, sampleColor(uv - split).b);
  float y = luma(color);
  color = mix(vec3(y), color, 1.75 + u_intensity * 0.32);
  color = mix(color, vec3(0.92, 0.025, 0.46), 0.105);
  color = mix(color, vec3(0.015, 0.76, 0.96), 0.08 + glitchLine * 0.22);
  color = pow(max(color, vec3(0.0)), vec3(0.82));
  float poster = 8.0 + u_intensity * 4.0;
  vec3 quantized = floor(clamp(color, 0.0, 1.0) * poster) / poster;
  color = mix(color, quantized, 0.32);
  color += vec3(0.15, 0.018, 0.10) * glitchLine * 0.18;
  color *= scanline(0.44, 0.13);
  color += vec3(0.035, 0.018, 0.045) * filmGrain(uv, y) * u_noise;
  color *= vignette(v_uv, 0.27);
  gl_FragColor = vec4(saturateColor(applyFlash(color)), 1.0);
}