uniform float u_bloomRadius;
uniform float u_threshold;
uniform float u_warmth;

void main() {
  vec2 uv = v_uv;
  uv.x += sin(u_time * 12.0 + floor(uv.y * 8.0)) * 0.0015 * u_intensity;
  vec2 px = 1.0 / max(u_resolution, vec2(1.0));
  vec3 source = sampleColor(uv);
  float luminance = luma(source);
  float radius = 1.5 + u_bloomRadius * 4.0;
  vec3 b0 = max(sampleColor(uv + vec2(px.x * radius, 0.0)) - vec3(u_threshold), vec3(0.0));
  vec3 b1 = max(sampleColor(uv - vec2(px.x * radius, 0.0)) - vec3(u_threshold), vec3(0.0));
  vec3 b2 = max(sampleColor(uv + vec2(0.0, px.y * radius)) - vec3(u_threshold), vec3(0.0));
  vec3 b3 = max(sampleColor(uv - vec2(0.0, px.y * radius)) - vec3(u_threshold), vec3(0.0));
  vec3 bloom = (b0 + b1 + b2 + b3) * 0.25;
  float hot = smoothstep(u_threshold, min(0.999, u_threshold + 0.32), luminance);
  float flicker = 0.91 + 0.09 * hash12(vec2(floor(u_time * 16.0), floor(uv.y * 13.0)));
  vec3 neutral = source * vec3(1.08, 0.92, 0.78);
  vec3 heated = vec3(source.r * 1.24 + hot * 0.16, source.g * 0.58 + hot * 0.24, source.b * 0.32 + hot * 0.035);
  vec3 warm = mix(neutral, heated, u_warmth);
  warm += bloom * (0.55 + u_intensity * 0.75) + vec3(1.0, 0.19, 0.018) * hot * 0.26;
  warm *= flicker;
  warm = vec3(1.0) - exp(-max(warm, vec3(0.0)) * (1.25 + u_intensity * 0.28));
  warm *= scanline(0.42, 0.105);
  warm += vec3(0.025, 0.009, 0.018) * filmGrain(uv, luminance) * u_noise;
  warm *= vignette(v_uv, 0.28);
  gl_FragColor = vec4(saturateColor(applyFlash(warm)), 1.0);
}