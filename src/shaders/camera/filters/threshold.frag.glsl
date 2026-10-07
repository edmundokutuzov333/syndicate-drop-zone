void main() {
  vec3 source = sampleColor(v_uv);
  float luminance = dot(source, vec3(0.2126, 0.7152, 0.0722));

  float frameSeed = floor(u_time * 24.0);
  float temporalNoise = hash12(vec2(frameSeed, 71.13)) - 0.5;
  float exposureFlicker = sin(u_time * 12.0) * 0.02;
  float motionFlicker = u_faceMotionBurst * 0.035;
  float dynamicThreshold =
    uThreshold +
    exposureFlicker * uFlickerIntensity +
    temporalNoise * 0.006 * uFlickerIntensity -
    motionFlicker;

  vec2 noiseUv =
    v_uv * max(u_resolution, vec2(1.0)) * 0.72 +
    vec2(u_time * 31.0, u_time * 19.0);
  float highFrequencyNoise = noise2(noiseUv);
  float grain = highFrequencyNoise - 0.5;

  float edge = max(uEdgeSmoothness, 0.0001);
  float organicThreshold = dynamicThreshold + grain * edge * 1.8;
  float mask = smoothstep(
    organicThreshold - edge,
    organicThreshold + edge,
    luminance
  );

  float face = faceMask(v_uv, 1.03);
  float eye = eyeGlow(v_uv, u_eyes.xy, 1.12) + eyeGlow(v_uv, u_eyes.zw, 1.12);
  float mouth = mouthGlow(v_uv, 1.0);
  float facialDetail = face * highFrequencyNoise * (0.05 + uFlickerIntensity * 0.35);
  float exposureDetail = smoothstep(0.52, 0.86, luminance) * uFlickerIntensity;

  float finalMask = clamp(
    mask +
    facialDetail * temporalNoise +
    exposureDetail * (0.3 + u_faceMotionBurst * 0.7),
    0.0,
    1.0
  );

  vec3 black = vec3(0.0);
  vec3 white = vec3(1.0);
  vec3 result = mix(black, white, finalMask);

  result -= eye * vec3(0.08);
  result += mouth * vec3(0.08, 0.015, 0.0);
  result += grain * (0.012 + u_noise * 0.018);

  result *= filmGate(v_uv, 0.015);
  result = applyFlash(saturateColor(result));

  gl_FragColor = vec4(saturateColor(result), 1.0);
}
