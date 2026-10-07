precision mediump float;

uniform sampler2D u_texture;
uniform sampler2D u_previousFrame;
uniform vec2 u_resolution;
uniform vec2 u_videoResolution;
uniform float u_time;
uniform float u_intensity;
uniform float u_noise;
uniform float u_distortion;
uniform float u_chromatic;
uniform float u_feedback;
uniform float u_flash;
uniform float u_rotation;
uniform float u_mirror;

varying vec2 v_uv;

float hash12(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float luma(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

float saturate(float value) {
  return clamp(value, 0.0, 1.0);
}

vec3 saturateColor(vec3 color) {
  return clamp(color, 0.0, 1.0);
}

float vignette(vec2 uv, float strength) {
  vec2 p = uv * 2.0 - 1.0;
  float edge = smoothstep(0.22, 1.05, dot(p, p));
  return 1.0 - edge * strength;
}

vec2 rotateUv(vec2 uv, float degrees) {
  if (degrees < 45.0) return uv;
  if (degrees < 135.0) return vec2(uv.y, 1.0 - uv.x);
  if (degrees < 225.0) return vec2(1.0 - uv.x, 1.0 - uv.y);
  if (degrees < 315.0) return vec2(1.0 - uv.y, uv.x);
  return uv;
}

vec2 coverUv(vec2 uv) {
  float videoAspect = u_videoResolution.x / max(u_videoResolution.y, 1.0);
  float viewAspect = u_resolution.x / max(u_resolution.y, 1.0);

  if (u_rotation > 45.0 && u_rotation < 315.0) {
    videoAspect = 1.0 / videoAspect;
  }

  if (videoAspect > viewAspect) {
    float visibleWidth = viewAspect / videoAspect;
    uv.x = uv.x * visibleWidth + (1.0 - visibleWidth) * 0.5;
  } else {
    float visibleHeight = videoAspect / viewAspect;
    uv.y = uv.y * visibleHeight + (1.0 - visibleHeight) * 0.5;
  }

  return uv;
}

vec2 cameraUv(vec2 uv) {
  vec2 transformed = uv;

  if (u_mirror > 0.5) {
    transformed.x = 1.0 - transformed.x;
  }

  transformed = rotateUv(transformed, u_rotation);
  transformed = coverUv(transformed);

  return clamp(transformed, 0.0, 1.0);
}

vec3 sampleColor(vec2 uv) {
  return texture2D(u_texture, cameraUv(uv)).rgb;
}

vec3 samplePrevious(vec2 uv) {
  return texture2D(u_previousFrame, cameraUv(uv)).rgb;
}

vec3 filmic(vec3 color) {
  color = max(color, vec3(0.0));
  color = color / (color + vec3(0.155));
  color = pow(color, vec3(0.92));
  return saturateColor(color);
}

vec3 cinematicGrade(vec3 color, vec3 shadowTint, vec3 highlightTint, float contrast) {
  float y = luma(color);
  vec3 graded = mix(vec3(y), color, 1.0 + contrast * 0.18);
  graded += shadowTint * (1.0 - smoothstep(0.12, 0.72, y));
  graded += highlightTint * smoothstep(0.48, 0.96, y);
  graded = (graded - 0.5) * (1.0 + contrast * 0.42) + 0.5;
  return filmic(graded);
}

vec3 softBloom(vec2 uv, vec3 current, float threshold, float intensity) {
  vec2 px = 1.0 / max(u_resolution, vec2(1.0));
  vec3 b0 = max(sampleColor(uv + px * vec2(2.0, 0.0)) - threshold, vec3(0.0));
  vec3 b1 = max(sampleColor(uv + px * vec2(-2.0, 0.0)) - threshold, vec3(0.0));
  vec3 b2 = max(sampleColor(uv + px * vec2(0.0, 2.0)) - threshold, vec3(0.0));
  vec3 b3 = max(sampleColor(uv + px * vec2(0.0, -2.0)) - threshold, vec3(0.0));
  vec3 bloom = (b0 + b1 + b2 + b3) * 0.25;
  return current + bloom * intensity;
}

float scanline(float density, float strength) {
  float line = 0.5 + 0.5 * sin(v_uv.y * u_resolution.y * density + u_time * 7.0);
  return 1.0 - line * strength;
}

float filmGate(vec2 uv, float strength) {
  float top = smoothstep(0.0, 0.045, uv.y);
  float bottom = smoothstep(0.0, 0.045, 1.0 - uv.y);
  float left = smoothstep(0.0, 0.035, uv.x);
  float right = smoothstep(0.0, 0.035, 1.0 - uv.x);
  return mix(1.0 - strength, 1.0, top * bottom * left * right);
}

float edgeStrength(vec2 uv) {
  vec2 px = 1.0 / max(u_resolution, vec2(1.0));
  float x = abs(luma(sampleColor(uv + vec2(px.x * 2.0, 0.0))) - luma(sampleColor(uv - vec2(px.x * 2.0, 0.0))));
  float y = abs(luma(sampleColor(uv + vec2(0.0, px.y * 2.0))) - luma(sampleColor(uv - vec2(0.0, px.y * 2.0))));
  return saturate((x + y) * 4.5);
}

float halftone(vec2 uv, float scale, float softness) {
  vec2 grid = uv * scale;
  vec2 cell = fract(grid) - 0.5;
  float distanceToCenter = length(cell);
  float tone = luma(sampleColor(uv));
  float radius = mix(0.46, 0.06, tone);
  return 1.0 - smoothstep(radius, radius + softness, distanceToCenter);
}

float pulse(float speed, float phase) {
  return 0.5 + 0.5 * sin(u_time * speed + phase);
}

float digitalFlicker(float speed) {
  float frame = floor(u_time * speed);
  return 0.88 + 0.12 * hash12(vec2(frame, 13.7));
}

vec2 liquidWarp(vec2 uv, float amount) {
  vec2 p = uv * 2.0 - 1.0;
  float waveA = sin(p.y * 18.0 + u_time * 2.7);
  float waveB = cos(p.x * 15.0 - u_time * 2.1);
  p += vec2(waveA, waveB) * amount * 0.018;
  float r2 = dot(p, p);
  p *= 1.0 + r2 * amount * 0.14;
  return clamp(p * 0.5 + 0.5, 0.0, 1.0);
}

vec3 chromaticSample(vec2 uv) {
  float amount = u_chromatic * (0.6 + 0.4 * sin(u_time * 2.0));
  vec2 drift = vec2(amount, amount * 0.35);
  vec3 color;
  color.r = sampleColor(distortUv(uv + drift)).r;
  color.g = sampleColor(distortUv(uv)).g;
  color.b = sampleColor(distortUv(uv - drift)).b;
  return color;
}

vec2 distortUv(vec2 uv) {
  vec2 p = uv * 2.0 - 1.0;
  float radius = dot(p, p);
  float lens = 1.0 + radius * u_distortion * 0.42;

  p *= lens;
  p.x += sin((uv.y + u_time * 0.15) * 24.0) * u_distortion * 0.013;
  p.y += sin((uv.x - u_time * 0.11) * 19.0) * u_distortion * 0.009;

  return clamp(p * 0.5 + 0.5, 0.0, 1.0);
}

vec3 feedbackBlend(vec2 uv, vec3 current) {
  if (u_feedback <= 0.001) return current;

  vec2 drift = vec2(
    sin(u_time * 1.4 + uv.y * 9.0) * 0.004,
    cos(u_time * 1.1 + uv.x * 8.0) * 0.004
  );

  vec3 previous = samplePrevious(distortUv(uv + drift));
  float weight = clamp(u_feedback, 0.0, 0.72);
  return mix(current, mix(current, previous, 0.58), weight);
}

vec3 applyFlash(vec3 color) {
  float flash = clamp(u_flash, 0.0, 1.0);
  color += vec3(flash * 0.18);
  color += color * flash * 0.38;
  return saturateColor(color);
}
