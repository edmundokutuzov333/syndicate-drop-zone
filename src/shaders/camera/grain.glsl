float filmGrain(vec2 uv, float luminance) {
  float fine = hash12(uv * u_resolution + u_time * 53.0);
  float coarse = noise2(uv * 46.0 + u_time * 2.1);
  float temporal = hash12(uv * 117.0 + vec2(u_time * 17.0, -u_time * 23.0));
  float shadowWeight = 1.0 - smoothstep(0.10, 0.78, luminance);

  float grain = mix(fine, coarse, 0.38);
  grain = mix(grain, temporal, 0.22);
  grain = (grain - 0.5) * 2.0;

  return grain * u_noise * mix(0.45, 1.35, shadowWeight);
}

float dustSpeck(vec2 uv, float scale, float threshold) {
  vec2 cell = floor(uv * scale);
  float seed = hash12(cell + floor(u_time * 0.35));
  float local = hash12(cell + fract(uv * scale));
  return step(threshold, seed) * smoothstep(0.1, 0.9, local);
}

float hairline(vec2 uv, float speed, float amount) {
  float seed = noise2(vec2(floor(uv.x * 150.0), floor((uv.y + u_time * speed) * 280.0)));
  float streak = smoothstep(0.985, 1.0, seed);
  return streak * amount;
}
