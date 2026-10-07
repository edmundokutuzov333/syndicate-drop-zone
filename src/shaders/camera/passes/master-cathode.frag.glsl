precision mediump float;
uniform sampler2D u_input;
uniform float u_time;
uniform float uDistortionK;
uniform float uScanlineCount;
uniform float uChromaticOffset;
uniform float u_faceMotionBurst;

uniform float uApplyToAllFilters;
varying vec2 v_uv;

vec2 warp(vec2 uv) {
  vec2 p = uv * 2.0 - 1.0;
  p *= 1.0 + dot(p, p) * uDistortionK;
  return clamp(p * 0.5 + 0.5, 0.0, 1.0);
}

void main() {
  vec2 uv = warp(v_uv);
  vec2 center = uv * 2.0 - 1.0;
  float edge = smoothstep(0.06, 0.84, dot(center, center));
  float motionShock = smoothstep(0.1, 0.72, u_faceMotionBurst);

  vec2 rgbOffset =
    vec2(uChromaticOffset * (0.2 + edge * 1.8 + motionShock * 1.4), 0.0);

  float r = texture2D(u_input, clamp(uv + rgbOffset, 0.0, 1.0)).r;
  float g = texture2D(u_input, uv).g;
  float b = texture2D(u_input, clamp(uv - rgbOffset, 0.0, 1.0)).b;

  float scan = 1.0 -
    0.13 * (0.5 + 0.5 * sin(v_uv.y * uScanlineCount + u_time * 5.0));
  float glass = 1.0 - edge * 0.33;

  vec3 processed = clamp(vec3(r, g, b) * scan * glass, 0.0, 1.0);
  vec3 original = texture2D(u_input, v_uv).rgb;
  float enabled = clamp(uApplyToAllFilters, 0.0, 1.0);

  gl_FragColor = vec4(
    mix(original, processed, enabled),
    1.0
  );
}
