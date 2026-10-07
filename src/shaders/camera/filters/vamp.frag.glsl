void main() {
  float effectTime = max(0.0, u_time - u_filterStart);
  float entry = smoothstep(0.0, 0.34, effectTime);
  float tapeBurst = 1.0 - smoothstep(0.015, 0.16, effectTime);
  float motionPulse = max(u_faceMotion, u_faceMotionBurst);

  vec2 uv = fisheyeUv(v_uv, 0.06 + u_distortion * 0.34);
  vec2 glitchDrift = vec2(
    sin(u_time * 27.0) * 0.004 * tapeBurst,
    cos(u_time * 19.0) * 0.002 * tapeBurst
  );
  vec3 source = chromaticSample(uv + glitchDrift * (1.0 + motionPulse));
  float y = luma(source);

  float leather = noise2(
    uv * 92.0 + vec2(u_time * 0.65, -u_time * 0.41)
  );
  float micro = noise2(uv * 210.0 - u_time * 0.28);

  vec3 grade = cinematicGrade(
    vec3(y),
    vec3(0.015, 0.018, 0.022),
    vec3(0.16, 0.15, 0.14),
    1.34
  );

  grade += vec3((leather - 0.5) * 0.075 + (micro - 0.5) * 0.024);
  grade = mix(source, grade, 1.0 - 0.08 * entry);

  float eyeLeft = eyeGlow(uv, u_eyes.xy, 1.45);
  float eyeRight = eyeGlow(uv, u_eyes.zw, 1.45);
  float eyes = clamp((eyeLeft + eyeRight) * 1.45, 0.0, 1.0);
  float pupils = pow(clamp(eyeLeft + eyeRight, 0.0, 1.0), 7.5);

  grade = mix(grade, grade * vec3(0.035, 0.038, 0.040), eyes * 0.94);
  grade += vec3(0.97, 0.98, 1.0) * pupils * 0.38;

  float faceHalo = faceMask(uv, 1.05);
  float specPulse = 0.08 + 0.12 * pulse(1.7, 0.9);
  grade += vec3(0.20, 0.22, 0.24) * faceHalo * specPulse;

  float gate = filmGate(v_uv, 0.07);
  float grain = filmGrain(uv * 1.1, y) * 0.095;
  float scan = scanline(0.26, 0.026);

  grade += grain;
  grade *= gate * scan * vignette(v_uv, 0.74);

  grade = mix(
    grade,
    chromaticSample(uv + vec2(0.006, 0.0)),
    tapeBurst * 0.22
  );

  grade = feedbackBlend(uv, grade);
  grade = applyFlash(grade);

  gl_FragColor = vec4(saturateColor(grade), 1.0);
}
