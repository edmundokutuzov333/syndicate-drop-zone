void main() {
  vec2 uv = liquidWarp(v_uv, u_distortion);
  vec3 source = sampleColor(uv);
  float lum = luma(source);
  float edge = edgeStrength(uv);

  float beamY = fract(u_time * 0.055);
  float beam = 1.0 - smoothstep(0.0, 0.055, abs(uv.y - beamY));
  float scan = scanline(0.46, 0.075);

  vec3 phosphor = vec3(
    lum * 0.08,
    pow(lum, 0.72) * 0.92,
    lum * 0.20
  );

  float hot = smoothstep(0.78, 1.0, lum);
  phosphor += vec3(0.10, 0.38, 0.07) * hot;
  phosphor = softBloom(uv, phosphor, 0.65, 0.18);

  float leftEye = eyeGlow(uv, u_eyes.xy, 1.25);
  float rightEye = eyeGlow(uv, u_eyes.zw, 1.25);
  float faceRingFx = faceRing(uv, 1.08, 0.10);
  float facePulseFx = facePulse(2.4, 1.2);

  float reticle = abs(sin(uv.x * 95.0)) + abs(sin(uv.y * 74.0));
  float grid = smoothstep(1.88, 1.98, reticle) * 0.045;

  float pixelNoise = filmGrain(uv, lum) * 0.095;
  float hotPixel = step(0.997, hash12(floor(uv * u_resolution * 0.32) + floor(u_time * 2.0)));

  phosphor += vec3(0.10, 0.72, 0.12) * grid;
  phosphor += vec3(0.12, 0.75, 0.18) * hotPixel * 0.32;
  phosphor += vec3(0.05, 0.22, 0.025) * beam * (0.24 + edge * 0.42);
  phosphor += vec3(0.02, 0.65, 0.08) * faceRingFx * (0.12 + facePulseFx * 0.12);
  phosphor += vec3(0.28, 1.0, 0.34) * (leftEye + rightEye) * 0.12;
  phosphor += pixelNoise;

  phosphor *= scan * digitalFlicker(9.0);
  phosphor = mix(sampleColor(v_uv), phosphor, u_intensity);
  phosphor *= vignette(v_uv, 0.52);
  phosphor = mix(phosphor, phosphor + edge * vec3(0.02, 0.12, 0.02), 0.75);
  phosphor = applyFlash(phosphor);

  gl_FragColor = vec4(saturateColor(phosphor), 1.0);
}
