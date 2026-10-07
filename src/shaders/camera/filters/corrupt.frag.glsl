void main() {
  vec2 uv = v_uv;

  float lineSeed = noise2(vec2(floor(uv.y * 180.0), floor(u_time * 7.0)));
  float lineJitter = (lineSeed - 0.5) * 0.045 * u_distortion;
  uv.x += lineJitter * smoothstep(0.12, 0.9, abs(sin(uv.y * 31.0 + u_time * 2.6)));

  vec2 block = floor(uv * vec2(24.0, 18.0));
  float blockNoise = hash12(block + floor(u_time * 2.0));
  uv.x += (step(0.82, blockNoise) - 0.5) * 0.06 * u_distortion;
  uv.y += (step(0.93, hash12(block + 8.0)) - 0.5) * 0.025 * u_distortion;

  vec3 color = chromaticSample(clamp(uv, 0.0, 1.0));

  float scan = sin(uv.y * u_resolution.y * 0.22 + u_time * 22.0) * 0.045;
  color += scan * (0.55 + 0.45 * noise2(uv * 50.0));

  float tear = step(0.94, noise2(vec2(floor(u_time * 3.0), floor(uv.y * 60.0))));
  color.rb += vec2(tear * 0.12, tear * 0.03);

  color += filmGrain(uv, luma(color)) * 0.065;
  color = feedbackBlend(uv, color);

  gl_FragColor = vec4(clamp(color * u_intensity, 0.0, 1.0), 1.0);
}