void main() {
  float effectTime = max(0.0, u_time - u_filterStart);
  float crtBoot = 1.0 - smoothstep(0.0, 0.44, effectTime);
  float motion = clamp(u_faceMotion, 0.0, 1.0);
  float burst = clamp(u_faceMotionBurst, 0.0, 1.0);

  vec2 uv = fisheyeUv(v_uv, 0.09 + u_distortion * 0.42);

  float glitchFrame = floor(u_time * (16.0 + burst * 42.0));
  float tearSeed = hash12(vec2(glitchFrame, floor(uv.y * 90.0)));
  float tear = step(0.84, tearSeed) * (0.35 + burst * 0.85);

  uv.x += tear * (hash12(vec2(glitchFrame, 19.0)) - 0.5) * (0.04 + u_distortion * 0.10);
  uv.y += sin(uv.x * 72.0 + u_time * 13.0) * burst * 0.0035;

  float split = u_chromatic + burst * 0.047 + motion * 0.016 + crtBoot * 0.024;
  vec2 rgbOffset = vec2(split, 0.0);

  vec3 color;
  color.r = sampleColor(uv + rgbOffset).r;
  color.g = sampleColor(uv).g;
  color.b = sampleColor(uv - rgbOffset).b;

  float lum = luma(color);
  float staticNoise = noise2(
    vec2(
      floor(uv.x * 160.0) + glitchFrame * 0.31,
      floor(uv.y * 110.0)
    )
  );

  color = vec3(
    lum * 0.20 + staticNoise * 0.025,
    lum * 0.84 + staticNoise * 0.09,
    lum * 0.29 + staticNoise * 0.035
  );

  float scan = scanline(0.54 + burst * 0.32, 0.14);
  float scanWarp = sin(uv.y * u_resolution.y * 0.05 + u_time * 3.0);
  color += vec3(0.01, 0.08, 0.025) * scanWarp * 0.05;

  float faceEdge = faceRing(uv, 1.08, 0.10);
  color += vec3(0.02, 0.42, 0.11) * faceEdge * (0.24 + burst * 0.32);

  float hotSpot = eyeGlow(uv, u_eyes.xy, 1.12) + eyeGlow(uv, u_eyes.zw, 1.12);
  color += vec3(0.18, 0.92, 0.26) * hotSpot * 0.10;

  color = mix(color, color * 0.18, crtBoot);
  color *= scan * digitalFlicker(13.0 + burst * 28.0);
  color += filmGrain(uv, lum) * 0.07;

  color = feedbackBlend(uv, color);
  color *= vignette(v_uv, 0.56);
  color *= filmGate(v_uv, 0.035);
  color = applyFlash(color);

  gl_FragColor = vec4(
    saturateColor(color * (0.92 + 0.16 * u_intensity)),
    1.0
  );
}
