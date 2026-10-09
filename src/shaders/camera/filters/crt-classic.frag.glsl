vec2 crtClassicWarp(vec2 uv) {
  vec2 p = uv * 2.0 - 1.0;
  float radius = dot(p, p);
  p *= 1.0 + radius * (0.035 + u_distortion * 0.22);
  p.x += sin(p.y * 24.0 + u_time * 1.4) * 0.0012 * u_intensity;
  return p * 0.5 + 0.5;
}

void main() {
  vec2 uv = crtClassicWarp(v_uv);
  vec2 centered = uv * 2.0 - 1.0;
  float roundedEdge = max(abs(centered.x), abs(centered.y)) +
    min(abs(centered.x), abs(centered.y)) * 0.055;
  float glass = 1.0 - smoothstep(0.91, 1.015, roundedEdge);
  vec2 split = vec2((0.002 + u_chromatic * 0.52) * u_intensity, 0.0);
  vec3 color = vec3(sampleColor(uv + split).r, sampleColor(uv).g, sampleColor(uv - split).b);
  float y = luma(color);
  color = mix(color, vec3(color.r, y * 0.94, color.b * 1.06), 0.24 * u_intensity);
  color = softBloom(uv, color, 0.65, 0.16 * u_intensity);
  float scan = scanline(0.46, 0.23 * u_intensity);
  float phosphor = 0.965 + 0.035 * sin(uv.x * u_resolution.x * 1.02);
  float shimmer = 0.97 + 0.03 * sin(u_time * 2.0 + uv.y * 5.0);
  color += vec3(0.012, 0.025, 0.055) * filmGrain(uv, y) * (0.3 + u_noise);
  color *= scan * phosphor * shimmer * vignette(v_uv, 0.42) * glass;
  color += vec3(0.02, 0.05, 0.11) * smoothstep(0.75, 0.98, y) * 0.07;
  gl_FragColor = vec4(saturateColor(applyFlash(color)), 1.0);
}