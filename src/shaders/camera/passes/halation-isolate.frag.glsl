precision mediump float;
uniform sampler2D u_input;
uniform float uGlowThreshold;
varying vec2 v_uv;

void main() {
  vec3 color = texture2D(u_input, v_uv).rgb;
  vec3 highlights = max(color - vec3(uGlowThreshold), vec3(0.0)) * 4.0;
  gl_FragColor = vec4(highlights, 1.0);
}
