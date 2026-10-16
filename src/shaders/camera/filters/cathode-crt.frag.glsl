uniform float uDistortionK;
uniform float uScanlineCount;
uniform float uChromaticOffset;
uniform float uScanlineIntensity;

uniform float uApplyToAllFilters;


vec2 cathodeUv(vec2 uv) {
  vec2 p = uv * 2.0 - 1.0;
  p *= 1.0 + dot(p, p) * uDistortionK;
  return clamp((p + 1.0) * 0.5, 0.0, 1.0);
}

vec3 cathodeSample(vec2 uv) {
  return sampleColor(cathodeUv(uv));
}

void main() {
  vec2 warped = cathodeUv(v_uv);
  vec2 edge = vec2(uChromaticOffset * smoothstep(0.08, 0.8, dot(warped * 2.0 - 1.0, warped * 2.0 - 1.0)), 0.0);

  vec3 color;
  color.r = cathodeSample(warped + edge).r;
  color.g = cathodeSample(warped).g;
  color.b = cathodeSample(warped - edge).b;

  float scan =
    1.0 -
    uScanlineIntensity *
      (0.5 + 0.5 * sin(warped.y * uScanlineCount + u_time * 5.0));

  float shock = smoothstep(0.18, 0.72, u_faceMotionBurst);
  float shockWave = exp(-abs(warped.y - fract(u_time * (0.35 + shock * 1.8))) * 260.0);
  float chromaShock = shock * shockWave * uChromaticOffset * 8.0;

  vec2 shockOffset = vec2(chromaShock, 0.0);
  color.r = mix(color.r, cathodeSample(warped + shockOffset).r, shock);
  color.b = mix(color.b, cathodeSample(warped - shockOffset).b, shock);

  vec2 centered = warped * 2.0 - 1.0;
  float glass = smoothstep(0.1, 1.15, dot(centered, centered));
  float vignetteFactor = 1.0 - glass * 0.38;

  color = cinematicGrade(
    color,
    vec3(0.0, 0.0, 0.015),
    vec3(0.025, 0.035, 0.05),
    0.9
  );
  color *= scan * vignetteFactor;
  color += vec3(chromaShock * 0.06, 0.0, chromaShock * 0.04);
  color = applyFlash(color);

  gl_FragColor = vec4(saturateColor(color), 1.0);
}
