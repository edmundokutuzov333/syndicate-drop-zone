void main() {
  vec2 uv = distortUv(v_uv);
  vec3 source = sampleColor(uv);
  float lum = luma(source);

  float scanline = 0.88 + 0.12 * sin((uv.y * u_resolution.y) * 0.45);
  float rollingBeam = 1.0 - smoothstep(0.0, 0.04, abs(fract(uv.y + u_time * 0.055) - 0.5));

  vec3 green = vec3(lum * 0.18, lum * 0.84, lum * 0.28);
  green += vec3(0.02, 0.06, 0.01) * rollingBeam;
  green += filmGrain(uv, lum) * 0.11;

  float hudGrid = step(0.985, sin(uv.x * 120.0) * sin(uv.y * 96.0));
  green += vec3(0.18, 0.52, 0.2) * hudGrid * 0.18;
  green *= scanline * vignette(v_uv, 0.48);

  gl_FragColor = vec4(clamp(green * (0.92 + u_intensity * 0.18), 0.0, 1.0), 1.0);
}