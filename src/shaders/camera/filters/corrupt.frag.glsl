void main() {
  float glitchFrame = floor(u_time * 12.0);
  float frameRandom = hash12(vec2(glitchFrame, 91.0));

  vec2 uv = v_uv;
  float face = faceMask(uv, 1.08);
  float faceRingFx = faceRing(uv, 1.12, 0.12);
  float tearBand = step(0.86, hash12(vec2(floor(uv.y * 72.0), glitchFrame)));
  float tearDirection = sign(hash12(vec2(floor(uv.y * 72.0), glitchFrame + 7.0)) - 0.5);
  float faceTear = step(0.58, hash12(vec2(floor(uv.y * 120.0), glitchFrame + 31.0))) * face;

  uv.x += tearBand * tearDirection * (0.018 + 0.050 * u_distortion);
  uv.x += faceTear * (hash12(vec2(glitchFrame, 37.0)) - 0.5) * (0.018 + 0.025 * u_distortion);
  uv.y += (hash12(vec2(floor(uv.x * 34.0), glitchFrame + 3.0)) - 0.5)
    * 0.010 * u_distortion;

  vec2 block = floor(uv * vec2(30.0, 22.0));
  float blockSeed = hash12(block + glitchFrame);
  float blockHit = step(0.80, blockSeed);

  uv.x += blockHit * (hash12(block + 4.0) - 0.5) * 0.08 * u_distortion;

  vec2 channel = vec2(0.006 + u_chromatic * 0.8, 0.0);
  vec3 color;
  color.r = sampleColor(uv + channel * (1.0 + blockHit * 1.8 + face * 1.7)).r;
  color.g = sampleColor(uv).g;
  color.b = sampleColor(uv - channel * (1.0 + tearBand * 1.6 + faceTear * 1.9)).b;

  float scan = scanline(0.62, 0.095);
  float frameFlicker = 0.72 + 0.28 * frameRandom;

  float data = noise2(vec2(
    floor(uv.x * 190.0) + glitchFrame,
    floor(uv.y * 120.0)
  ));

  float poster = floor(luma(color) * 8.0) / 7.0;
  color = mix(color, vec3(poster), blockHit * 0.12);
  color += (data - 0.5) * 0.06;
  color += vec3(0.70, 0.03, 0.18) * faceRingFx * (0.14 + 0.18 * pulse(5.0, 0.6));

  float tearFlash = step(0.94, hash12(vec2(glitchFrame, floor(uv.y * 80.0))));
  color += vec3(0.75, 0.05, 0.02) * tearFlash * 0.12;

  color = feedbackBlend(uv, color);
  color *= scan * frameFlicker;
  color += filmGrain(uv, luma(color)) * 0.075;
  color *= vignette(v_uv, 0.22);
  color = applyFlash(color);

  gl_FragColor = vec4(saturateColor(color * (0.88 + 0.18 * u_intensity)), 1.0);
}
