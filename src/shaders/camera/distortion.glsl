vec2 distortUv(vec2 uv) {
  vec2 p = uv * 2.0 - 1.0;
  float radius = dot(p, p);
  float breathing = 1.0 + sin(u_time * 0.72) * 0.0024;
  float lens = 1.0 + radius * u_distortion * 0.46;

  p *= lens * breathing;
  p.x += sin((uv.y + u_time * 0.17) * 25.0) * u_distortion * 0.014;
  p.y += sin((uv.x - u_time * 0.13) * 21.0) * u_distortion * 0.010;

  float scanWarp = sin(uv.y * 150.0 - u_time * 5.0) * u_distortion * 0.0018;
  p.x += scanWarp;

  return clamp(p * 0.5 + 0.5, 0.0, 1.0);
}
