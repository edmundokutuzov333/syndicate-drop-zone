precision mediump float;

uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform vec2 u_videoResolution;
uniform float u_rotation;
uniform float u_mirror;

varying vec2 v_uv;

vec2 rotateUv(vec2 uv, float degrees) {
  if (degrees < 45.0) return uv;
  if (degrees < 135.0) return vec2(uv.y, 1.0 - uv.x);
  if (degrees < 225.0) return vec2(1.0 - uv.x, 1.0 - uv.y);
  if (degrees < 315.0) return vec2(1.0 - uv.y, uv.x);
  return uv;
}

void main() {
  vec2 uv = v_uv;

  if (u_mirror > 0.5) {
    uv.x = 1.0 - uv.x;
  }

  uv = rotateUv(uv, u_rotation);

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

  gl_FragColor = texture2D(u_texture, uv);
}
