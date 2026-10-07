uniform float uGrainIntensity;
uniform float uDirtFrequency;
uniform float uJitterAmount;

uniform float uApplyToAllFilters;


float paperNoise(vec2 uv, float time) {
  return fract(
    sin(dot(uv * time, vec2(12.9898, 78.233))) * 43758.5453
  );
}

float dirtMask(vec2 uv, float time) {
  vec2 cell = floor(uv * vec2(180.0, 240.0));
  float seed = floor(time * 24.0);
  float a = hash12(cell + seed);
  float b = hash12(cell * 1.71 + seed * 0.37);

  float dotDirt = step(1.0 - uDirtFrequency * 0.055, a) * smoothstep(0.996, 0.9998, b);

  float scratchX = fract(
    sin((cell.x + seed * 0.23) * 17.13) * 43758.5453
  );
  float scratch = step(0.997, scratchX) *
    smoothstep(0.2, 0.8, sin(v_uv.y * 8.0 + seed * 0.21) * 0.5 + 0.5);

  return clamp(dotDirt + scratch * 0.9, 0.0, 1.0);
}

void main() {
  float filmFrame = floor(u_time * 24.0) / 24.0;
  vec2 jitterSeed = vec2(
    hash12(vec2(filmFrame, 31.0)),
    hash12(vec2(filmFrame, 53.0))
  );
  vec2 jitter = (jitterSeed - 0.5) * uJitterAmount;

  vec3 source = sampleColor(v_uv + jitter);

  float n = paperNoise(v_uv + jitter, filmFrame * 27.0 + 1.0);
  float dirt = dirtMask(v_uv + jitter, filmFrame);
  float scan = 1.0 - scanline(0.18, 0.06);

  source = mix(source, source + vec3(n) * 0.22, uGrainIntensity);
  source -= vec3(dirt) * 0.42;
  source += vec3(0.85, 0.78, 0.62) * dirt * 0.16;
  source -= vec3(scan * 0.015);

  gl_FragColor = vec4(
    saturateColor(source),
    1.0
  );
}
