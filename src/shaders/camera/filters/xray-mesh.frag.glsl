void main() {
  vec3 source = sampleColor(v_uv);
  float luminance = luma(source);

  vec3 phosphor = vec3(0.012, 0.045, 0.03);
  phosphor += vec3(0.018, 0.14, 0.07) * luminance;
  phosphor += vec3(0.012, 0.30, 0.15) * edgeStrength(v_uv) * 0.55;
  phosphor += vec3(0.02, 0.5, 0.28) * (eyeGlow(v_uv, u_eyes.xy, 1.15) + eyeGlow(v_uv, u_eyes.zw, 1.15)) * 0.08;
  phosphor += vec3(0.01, 0.16, 0.08) * faceMask(v_uv, 1.06) * 0.08;

  float scan = scanline(0.45, 0.12);
  float flicker = digitalFlicker(10.0);

  phosphor *= scan * flicker;
  phosphor = mix(sampleColor(v_uv), phosphor, u_intensity);
  gl_FragColor = vec4(saturateColor(phosphor), 1.0);
}
