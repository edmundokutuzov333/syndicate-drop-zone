void main() {
  float effectTime = max(0.0, u_time - u_filterStart);
  float entry = smoothstep(0.0, 0.55, effectTime);
  float motion = clamp(u_faceMotion + u_faceMotionBurst * 0.75, 0.0, 1.0);

  vec2 uv = liquidWarp(v_uv, 0.32 + u_distortion * 1.9 + motion * 0.12);
  vec3 source = sampleColor(uv);

  vec3 graded = applyLut(source);
  float sourceLum = luma(source);

  float hazeNoise = noise2(uv * 3.2 + vec2(u_time * 0.045, -u_time * 0.032));
  hazeNoise = 0.65 * hazeNoise + 0.35 * noise2(uv * 7.0 - u_time * 0.09);

  vec3 petrolShadow = vec3(0.018, 0.08, 0.09);
  vec3 oliveShadow = vec3(0.12, 0.15, 0.075);
  float shadowMask = 1.0 - smoothstep(0.08, 0.52, sourceLum);
  graded += mix(petrolShadow, oliveShadow, hazeNoise) * shadowMask * 0.34;

  float highlight = smoothstep(0.62, 1.0, sourceLum);
  float bloom = smoothstep(0.48, 0.88, sourceLum);
  graded = softBloom(uv, graded, 0.56, 0.46 + motion * 0.18);
  graded += vec3(0.17, 0.25, 0.20) * bloom * (0.14 + 0.12 * pulse(0.9, 0.4));

  float smoke = smoothstep(0.28, 0.88, hazeNoise + highlight * 0.32);
  graded = mix(graded, graded + vec3(0.11, 0.14, 0.12) * smoke, 0.22 + motion * 0.28);

  vec3 trailA = samplePrevious(distortUv(uv + vec2(0.004 + motion * 0.018, 0.0)));
  vec3 trailB = samplePrevious(distortUv(uv - vec2(0.003 + motion * 0.013, 0.0)));
  vec3 trail = mix(trailA, trailB, 0.5);
  graded = mix(graded, mix(graded, trail, 0.72), motion * 0.44);

  graded += filmGrain(uv, sourceLum) * 0.055;
  graded *= vignette(v_uv, 0.28);

  float entryFlash = 1.0 - smoothstep(0.0, 0.24, effectTime);
  graded += vec3(0.10, 0.14, 0.12) * entryFlash * (0.22 + bloom * 0.5);

  graded = mix(source, graded, entry * 0.92);
  graded = feedbackBlend(uv, graded);
  graded = applyFlash(graded);

  gl_FragColor = vec4(saturateColor(graded), 1.0);
}
