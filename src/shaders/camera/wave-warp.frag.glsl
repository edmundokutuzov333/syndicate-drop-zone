precision mediump float;

uniform sampler2D u_input;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_waveAmount;

varying vec2 v_uv;

void main() {
  vec2 uv = v_uv;
  float row = floor(uv.y * max(u_resolution.y, 1.0) / 3.0);
  float slowBand = sin(uv.y * 24.0 + u_time * 1.7) * 0.0022;
  float fineBand = sin(uv.y * 82.0 - u_time * 5.2 + row * 0.018) * 0.0014;
  float roll = sin(uv.y * 7.5 + u_time * 0.72) * 0.0035;
  float amount = clamp(u_waveAmount, 0.0, 1.0);

  uv.x += (slowBand + fineBand + roll) * amount;
  uv.y += sin(uv.x * 18.0 - u_time * 1.25) * 0.0012 * amount;
  uv = clamp(uv, vec2(0.001), vec2(0.999));

  gl_FragColor = texture2D(u_input, uv);
}
