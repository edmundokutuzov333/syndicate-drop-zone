precision mediump float;
uniform sampler2D u_input;
uniform sampler2D u_previousFrame;
uniform sampler2D u_motion;
uniform sampler2D u_feedback;
uniform float uMeltStrength;
uniform float uVelocityThreshold;
uniform float uPersistence;
uniform float u_faceMotion;
uniform float u_faceMotionBurst;
varying vec2 v_uv;

void main() {
  vec4 flow = texture2D(u_motion, v_uv);
  vec2 velocity = flow.xy / 48.0;
  float speed = flow.z;

  float trigger = smoothstep(
    uVelocityThreshold,
    uVelocityThreshold + 0.035,
    speed + u_faceMotion * 0.12
  );

  float directionStrength =
    uMeltStrength *
    (0.55 + speed * 2.4 + u_faceMotionBurst * 0.8);

  vec2 displacedUv = clamp(
    v_uv - velocity * directionStrength,
    0.0,
    1.0
  );

  vec3 current = texture2D(u_input, v_uv).rgb;
  vec3 previous = texture2D(u_previousFrame, displacedUv).rgb;
  vec3 feedback = texture2D(u_feedback, displacedUv).rgb;

  float persistence = mix(0.0, uPersistence, trigger);
  vec3 melted = mix(previous, feedback, persistence);
  vec3 result = mix(current, melted, trigger * 0.88);

  float trail = smoothstep(0.35, 1.0, speed) * u_faceMotionBurst;
  result += (feedback - current) * trail * 0.18;

  gl_FragColor = vec4(clamp(result, 0.0, 1.0), 1.0);
}
