void main() {
  vec2 uv = liquidWarp(v_uv, u_distortion);
  vec3 color = chromaticSample(uv);
  float lum = luma(color);

  float low = pow(max(lum, 0.0), 1.55);
  float body = pow(max(lum, 0.0), 0.78);
  float highlight = smoothstep(0.55, 0.97, lum);

  vec3 red = vec3(
    body * 0.54 + highlight * 0.42,
    body * 0.018 + highlight * 0.035,
    body * 0.026 + highlight * 0.095
  );

  red = cinematicGrade(
    red,
    vec3(0.14, 0.0, 0.0),
    vec3(0.32, 0.0, 0.05),
    1.16
  );

  float face = faceMask(uv, 1.05);
  float faceRingFx = faceRing(uv, 1.14, 0.14);
  float eyeGlowFx = eyeGlow(uv, u_eyes.xy, 1.35) + eyeGlow(uv, u_eyes.zw, 1.35);
  float mouthPulseFx = mouthGlow(uv, 1.05) * (0.7 + u_mouth.z * 0.6);
  float breath = 0.90 + 0.10 * sin(u_time * 0.86);

  red = softBloom(uv, red, 0.68, 0.18 + breath * 0.06);
  red += vec3(0.48, 0.0, 0.055) * faceRingFx * (0.18 + 0.12 * breath);
  red += vec3(0.80, 0.0, 0.10) * eyeGlowFx * (0.08 + 0.10 * pulse(2.2, 0.5));
  red += vec3(0.32, 0.0, 0.18) * mouthPulseFx * 0.13;
  red += vec3(0.08, 0.0, 0.025) * face * 0.05;

  float sideLeak = smoothstep(0.68, 1.0, uv.x);
  float pulseLeak = 0.4 + 0.6 * pulse(0.47, 0.9);
  red += vec3(0.42, 0.01, 0.05) * sideLeak * pulseLeak * 0.16;

  float streak = smoothstep(
    0.996,
    1.0,
    sin((uv.y + u_time * 0.035) * 120.0) * 0.5 + 0.5
  );
  red += vec3(0.50, 0.01, 0.035) * streak * highlight * 0.10;

  float dust = dustSpeck(uv, 280.0, 0.9982);
  red += vec3(dust * 0.35, dust * 0.015, dust * 0.05);

  red = mix(sampleColor(v_uv), red, u_intensity);
  red = feedbackBlend(uv, red);
  red += filmGrain(uv, lum) * 0.072;
  red *= vignette(v_uv, 0.58);
  red *= filmGate(v_uv, 0.045);

  red += low * vec3(0.05, 0.0, 0.025);
  red = applyFlash(red);

  gl_FragColor = vec4(saturateColor(red * (0.92 + 0.10 * u_intensity)), 1.0);
}
