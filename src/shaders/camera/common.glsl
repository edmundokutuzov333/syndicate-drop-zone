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

float vignette(vec2 uv, float strength) {
  vec2 p = uv * 2.0 - 1.0;
  float edge = smoothstep(0.25, 1.05, dot(p, p));
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