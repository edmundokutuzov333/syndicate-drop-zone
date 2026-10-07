precision mediump float;
uniform sampler2D u_input;
uniform sampler2D u_previousFrame;
uniform vec2 u_resolution;
varying vec2 v_uv;

float lumaFlow(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

void main() {
  vec2 px = 1.0 / max(u_resolution, vec2(1.0));

  vec3 current = texture2D(u_input, v_uv).rgb;
  float temporal = lumaFlow(current) - lumaFlow(texture2D(u_previousFrame, v_uv).rgb);

  float bestScore = abs(temporal);
  vec2 bestVelocity = vec2(0.0);

  const int radius = 2;
  for (int y = -radius; y <= radius; y++) {
    for (int x = -radius; x <= radius; x++) {
      if (x == 0 && y == 0) continue;

      vec2 offset = vec2(float(x), float(y)) * px * 1.6;
      float candidate =
        lumaFlow(texture2D(u_previousFrame, v_uv + offset).rgb);
      float score = abs(lumaFlow(current) - candidate);

      if (score < bestScore) {
        bestScore = score;
        bestVelocity = -offset;
      }
    }
  }

  float magnitude = clamp(
    length(bestVelocity) * 26.0 + abs(temporal) * 3.2,
    0.0,
    1.0
  );

  gl_FragColor = vec4(
    bestVelocity * 48.0,
    magnitude,
    1.0
  );
}
