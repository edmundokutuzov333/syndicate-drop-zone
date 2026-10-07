void main() {
  vec2 uv = distortUv(v_uv);
  vec3 source = sampleColor(uv);
  float lum = luma(source);
  float edge = edgeStrength(uv);

  float scanner = 1.0 - smoothstep(
    0.0,
    0.10,
    abs(fract(uv.y + u_time * 0.055) - 0.5)
  );

  float inkNoise = filmGrain(uv * 1.4 + 0.11, lum);
  float paperNoise = noise2(uv * 22.0 + vec2(0.0, u_time * 0.15));
  float halftoneDot = halftone(uv, 145.0, 0.13);

  float copyTone = smoothstep(
    0.18,
    0.78,
    lum + inkNoise * 0.09 + edge * 0.34
  );
  copyTone = mix(copyTone, halftoneDot, 0.42);

  vec3 paper = vec3(0.82, 0.80, 0.75) + paperNoise * 0.035;
  vec3 ink = vec3(0.028, 0.025, 0.023);
  vec3 color = mix(ink, paper, copyTone);

  float misregister = sin(uv.y * 36.0 + u_time * 1.7) * 0.018;
  color.r += misregister * edge * 0.42;
  color.b -= misregister * edge * 0.28;

  float fold = smoothstep(
    0.012,
    0.0,
    abs(uv.x - (0.5 + sin(u_time * 0.08) * 0.05))
  );
  color += vec3(0.085) * fold;

  color += vec3(scanner) * 0.055;
  color += filmGrain(uv, lum) * 0.045;
  color *= 0.94 + 0.06 * scanner;
  color *= vignette(v_uv, 0.18);
  color = applyFlash(color);

  gl_FragColor = vec4(saturateColor(color), 1.0);
}
