void main() {
  vec2 breathing = vec2(
    sin(u_time * 0.72) * 0.002,
    cos(u_time * 0.52) * 0.0014
  );
  vec2 uv = distortUv(v_uv + breathing);
  vec3 color = chromaticSample(uv);

  float lum = luma(color);
  color = cinematicGrade(
    color,
    vec3(0.015, 0.025, 0.055),
    vec3(0.18, 0.035, -0.015),
    1.0
  );

  color = softBloom(uv, color, 0.70, 0.24);

  float halo = smoothstep(
    0.85,
    0.15,
    distance(uv, vec2(0.78 + sin(u_time * 0.22) * 0.06, 0.20))
  );
  float leak = smoothstep(0.80, 0.99, uv.x) * (0.45 + 0.55 * pulse(0.75, 1.2));
  color += vec3(0.65, 0.16, 0.03) * halo * 0.075;
  color += vec3(0.34, 0.025, 0.008) * leak * 0.09;

  float gate = filmGate(v_uv, 0.06);
  float scan = scanline(0.32, 0.028);
  float dust = dustSpeck(uv, 310.0, 0.9975);
  float hair = hairline(uv, 0.55, 0.032);

  color += filmGrain(uv, lum) * 0.065;
  color += vec3(dust + hair) * 0.035;
  color *= gate * scan * vignette(v_uv, 0.34);

  color = feedbackBlend(uv, color);
  color = applyFlash(color);

  gl_FragColor = vec4(saturateColor(color), 1.0);
}
