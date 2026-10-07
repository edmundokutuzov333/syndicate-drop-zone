vec2 distortUv(vec2 uv) {
  vec2 p = uv * 2.0 - 1.0;
  float radius = dot(p, p);
  float lens = 1.0 + radius * u_distortion * 0.36;

  p *= lens;
  p.x += sin((uv.y + u_time * 0.15) * 22.0) * u_distortion * 0.012;
  p.y += sin((uv.x - u_time * 0.11) * 18.0) * u_distortion * 0.008;

  return clamp(p * 0.5 + 0.5, 0.0, 1.0);
}