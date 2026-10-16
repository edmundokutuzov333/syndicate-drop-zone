precision mediump float;
uniform sampler2D u_input;
uniform sampler2D u_glow;
uniform float uHalationIntensity;
uniform float uGlowThreshold;
varying vec2 v_uv;

float lumaLocal(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

void main() {
  vec3 original = texture2D(u_input, v_uv).rgb;
  vec3 glow = texture2D(u_glow, v_uv).rgb;

  float lightEdge = smoothstep(
    uGlowThreshold - 0.08,
    uGlowThreshold + 0.08,
    lumaLocal(original)
  );

  float adjacentShadow =
    1.0 - smoothstep(0.18, 0.72, lumaLocal(original));

  vec3 halation = glow * (0.24 + uHalationIntensity * 0.92);
  halation.r += glow.r * (0.12 + uHalationIntensity * 0.38) * lightEdge * adjacentShadow;

  vec3 result = 1.0 - (1.0 - original) * (1.0 - halation);
  result += vec3(glow.r * 0.018, 0.003, 0.0) * uHalationIntensity;

  gl_FragColor = vec4(clamp(result, 0.0, 1.0), 1.0);
}
