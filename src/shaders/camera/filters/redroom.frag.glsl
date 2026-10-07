void main() {
  vec2 uv = distortUv(v_uv);
  vec3 color = chromaticSample(uv);
  float lum = luma(color);

  float highlights = smoothstep(0.68, 0.98, lum);
  float body = pow(max(lum, 0.0), 0.82);

  vec3 red = vec3(
    body * 0.60 + highlights * 0.38,
    body * 0.025,
    body * 0.015
  );

  red += vec3(0.08, 0.0, 0.0) * filmGrain(uv, lum);
  red *= vignette(v_uv, 0.5);
  red = feedbackBlend(uv, red);

  float drift = sin(u_time * 1.3 + uv.y * 22.0) * 0.012 * u_chromatic;
  red.r += drift;
  red.b += drift * 0.2;

  gl_FragColor = vec4(clamp(red * (0.9 + u_intensity * 0.1), 0.0, 1.0), 1.0);
}