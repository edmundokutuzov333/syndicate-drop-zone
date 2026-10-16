precision mediump float;
uniform sampler2D u_input;
uniform vec2 u_resolution;
uniform float uGlowRadius;
varying vec2 v_uv;

void main() {
  vec2 texel = 1.0 / max(u_resolution, vec2(1.0));
  float radius = max(uGlowRadius, 0.002);
  vec2 dy = vec2(0.0, texel.y * radius * u_resolution.y);

  vec3 sum = vec3(0.0);
  sum += texture2D(u_input, v_uv - dy * 4.0).rgb * 0.06136;
  sum += texture2D(u_input, v_uv - dy * 3.0).rgb * 0.08427;
  sum += texture2D(u_input, v_uv - dy * 2.0).rgb * 0.10458;
  sum += texture2D(u_input, v_uv - dy).rgb * 0.11795;
  sum += texture2D(u_input, v_uv).rgb * 0.12368;
  sum += texture2D(u_input, v_uv + dy).rgb * 0.11795;
  sum += texture2D(u_input, v_uv + dy * 2.0).rgb * 0.10458;
  sum += texture2D(u_input, v_uv + dy * 3.0).rgb * 0.08427;
  sum += texture2D(u_input, v_uv + dy * 4.0).rgb * 0.06136;

  gl_FragColor = vec4(sum, 1.0);
}
