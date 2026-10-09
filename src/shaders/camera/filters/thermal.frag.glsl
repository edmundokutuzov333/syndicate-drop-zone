vec3 thermalPalette(float value) {
  value = clamp(value, 0.0, 1.0);

  vec3 c0 = vec3(0.015, 0.02, 0.16);
  vec3 c1 = vec3(0.05, 0.32, 0.86);
  vec3 c2 = vec3(0.82, 0.03, 0.17);
  vec3 c3 = vec3(1.00, 0.44, 0.03);
  vec3 c4 = vec3(1.00, 0.95, 0.55);

  if (value < 0.28) {
    return mix(c0, c1, smoothstep(0.0, 0.28, value));
  }
  if (value < 0.57) {
    return mix(c1, c2, smoothstep(0.28, 0.57, value));
  }
  if (value < 0.80) {
    return mix(c2, c3, smoothstep(0.57, 0.80, value));
  }
  return mix(c3, c4, smoothstep(0.80, 1.0, value));
}

void main() {
  vec2 uv = liquidWarp(v_uv, u_distortion);
  vec3 source = sampleColor(uv);
  float lum = luma(source);

  float edge = edgeStrength(uv);
  float face = faceMask(uv, 1.04);
  float eyeHeat = eyeGlow(uv, u_eyes.xy, 1.25) + eyeGlow(uv, u_eyes.zw, 1.25);
  float mouthHeat = mouthGlow(uv, 1.0);
  float heatNoise = filmGrain(uv, lum) * 0.12;
  float heat = saturate(lum + heatNoise + edge * 0.06 + face * 0.08);
  heat += eyeHeat * 0.16 + mouthHeat * (0.08 + u_mouth.z * 0.12);

  vec3 color = thermalPalette(heat);
  float hot = smoothstep(0.70, 0.98, heat);

  color = softBloom(uv, color, 0.70, 0.32);
  color += vec3(1.0, 0.20, 0.02) * hot * 0.08;
  color += vec3(1.0, 0.78, 0.12) * eyeHeat * 0.20;

  float contour = smoothstep(0.22, 0.62, edge) * (0.35 + 0.25 * sin(u_time * 2.8 + uv.y * 30.0));
  color += vec3(1.0, 0.54, 0.05) * contour * 0.15;

  float scan = scanline(0.36, 0.06);
  color *= scan * vignette(v_uv, 0.24);

  color = feedbackBlend(uv, color);
  color += vec3(0.16, 0.02, 0.0) * pulse(1.1, 0.7) * hot * 0.04;
  color = mix(source, color, u_intensity);
  color = applyFlash(color);

  gl_FragColor = vec4(saturateColor(color), 1.0);
}
