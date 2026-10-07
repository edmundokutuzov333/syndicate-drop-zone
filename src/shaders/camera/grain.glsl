float filmGrain(vec2 uv, float luminance) {
  float fine = hash12(uv * u_resolution + u_time * 37.0);
  float coarse = noise2(uv * 42.0 + u_time * 2.7);
  float shadowWeight = 1.0 - smoothstep(0.15, 0.82, luminance);
  float temporal = hash12(uv * 91.0 + vec2(u_time * 19.0, -u_time * 13.0));
  float grain = mix(fine, coarse, 0.32);
  grain = mix(grain, temporal, 0.2);
  grain = (grain - 0.5) * 2.0;
  return grain * u_noise * mix(0.5, 1.15, shadowWeight);
}