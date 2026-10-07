void main() {
  vec2 uv = distortUv(v_uv);
  vec3 color = chromaticSample(uv);

  float lum = luma(color);
  float contrast = mix(1.0, 1.58, u_intensity);
  color = (color - 0.5) * contrast + 0.5;

  color.r += 0.14 * u_intensity;
  color.g *= 0.87;
  color.b *= 0.80;

  float bloom = max(0.0, luma(color) - 0.72);
  color += vec3(0.55, 0.08, 0.04) * bloom * 0.16;

  float grain = filmGrain(uv, lum);
  color += grain * 0.075;

  color *= vignette(v_uv, 0.44);
  color = feedbackBlend(uv, color);

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}