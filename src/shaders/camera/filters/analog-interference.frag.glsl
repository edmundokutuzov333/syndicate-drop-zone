void main() {
  vec2 uv = v_uv;
  float lineIndex = floor(uv.y * u_resolution.y / 3.0);
  float clock = floor(u_time * 6.0);
  float lineNoise = hash12(vec2(lineIndex, clock));
  float burst = step(0.965, lineNoise);
  float rollDistance = abs(fract(uv.y * 12.0 - u_time * 0.11) - 0.5);
  float roll = 1.0 - smoothstep(0.006, 0.026, rollDistance);
  uv.x += sin(uv.y * 31.0 + u_time * 1.7) * 0.0017;
  uv.x = clamp(uv.x + (lineNoise - 0.5) * burst * (0.045 + u_distortion * 0.08), 0.001, 0.999);
  vec3 source = sampleColor(uv);
  float y = luma(source);
  float contrast = clamp((y - 0.26) * (0.7 + u_intensity * 0.92) + 0.20, 0.0, 1.0);
  vec3 olive = mix(vec3(0.018, 0.032, 0.024), vec3(0.78, 0.74, 0.47), contrast);
  vec3 previous = samplePrevious(uv);
  olive = mix(olive, mix(vec3(luma(previous)), previous, 0.28), roll * u_feedback * 0.28);
  olive *= digitalFlicker(5.0);
  olive *= (1.0 - burst * 0.34) * (1.0 - roll * 0.17);
  olive += vec3(0.10, 0.095, 0.048) * hairline(uv, 0.08, 0.13);
  olive += vec3(0.045, 0.048, 0.024) * filmGrain(uv, y) * (0.65 + u_noise);
  olive *= scanline(0.48, 0.14) * vignette(v_uv, 0.38);
  gl_FragColor = vec4(saturateColor(applyFlash(olive)), 1.0);
}