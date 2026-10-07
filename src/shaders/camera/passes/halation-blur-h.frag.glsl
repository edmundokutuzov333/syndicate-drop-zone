precision mediump float;
uniform sampler2D u_input;
uniform vec2 u_resolution;
uniform float uGlowRadius;
varying vec2 v_uv;

void main() {
  vec2 texel = 1.0 / max(u_resolution, vec2(1.0));
  float radius = max(uGlowRadius, 0.002);
  vec2 dx = vec2(texel.x * radius * u_resolution.x, 0.0);

  vec3 sum = vec3(0.0);
  sum += texture2D(u_input, v_uv - dx * 4.0).rgb * 0.06136;
  sum += texture2D(u_input, v_uv - dx * 3.0).rgb * 0.08427;
  sum += texture2D(u_input, v_uv - dx * 2.0).rgb * 0.10458;
  sum += texture2D(u_input, v_uv - dx).rgb * 0.11795;
  sum += texture2D(u_input, v_uv).rgb * 0.12368;
  sum += texture2D(u_input, v_uv + dx).rgb * 0.11795;
  sum += texture2D(u_input, v_uv + dx * 2.0).rgb * 0.10458;
  sum += texture2D(u_input, v_uv + dx * 3.0).rgb * 0.08427;
  sum += texture2D(u_input, v_uv + dx * 4.0).rgb * 0.06136;

  gl_FragColor = vec4(sum, 1.0);
}
