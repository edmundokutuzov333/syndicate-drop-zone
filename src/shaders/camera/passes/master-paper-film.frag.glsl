precision mediump float;
uniform sampler2D u_input;
uniform float u_time;
uniform float uGrainIntensity;
uniform float uDirtFrequency;
uniform float uJitterAmount;

uniform float uApplyToAllFilters;
varying vec2 v_uv;

float hashFilm(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float proceduralPaperNoise(vec2 uv, float time) {
  return fract(
    sin(dot(uv * time, vec2(12.9898, 78.233))) * 43758.5453
  );
}

void main() {
  float filmTime = floor(u_time * 24.0) / 24.0;
  vec2 jitterSeed = vec2(
    hashFilm(vec2(filmTime, 23.1)),
    hashFilm(vec2(filmTime, 71.7))
  );
  vec2 uv = clamp(
    v_uv + (jitterSeed - 0.5) * uJitterAmount,
    0.0,
    1.0
  );

  vec3 color = texture2D(u_input, uv).rgb;
  float grain = proceduralPaperNoise(uv + 0.17, filmTime * 31.0 + 1.0);

  vec2 cell = floor(uv * vec2(180.0, 260.0));
  float seed = floor(filmTime * 24.0);
  float point = hashFilm(cell + seed * 0.73);
  float pointFine = hashFilm(cell * 2.13 + seed * 1.31);

  float dirt = step(1.0 - uDirtFrequency * 0.045, point) *
    step(0.995, pointFine);

  float scratch = step(
    0.9975,
    hashFilm(vec2(floor(uv.x * 420.0) + seed * 0.11, 17.0))
  );

  color += vec3(grain - 0.5) * uGrainIntensity;
  color = mix(color, color * vec3(0.52), dirt * 0.62);
  color += vec3(0.42, 0.37, 0.28) * scratch * 0.16;

  vec2 p = v_uv * 2.0 - 1.0;
  float vignette = smoothstep(1.2, 0.18, length(p));
  color *= mix(0.92, 1.0, vignette);

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
