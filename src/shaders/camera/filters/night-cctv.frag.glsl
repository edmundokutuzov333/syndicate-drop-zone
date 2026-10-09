void main() {
  vec2 uv = v_uv;
  float rollPosition = fract(u_time * 0.13 + 0.18);
  float roll = exp(-abs(uv.y - rollPosition) * 145.0);
  uv.x += sin(uv.y * 19.0 + u_time * 1.9) * 0.0014 + roll * 0.006 * u_intensity;
  vec3 source = sampleColor(uv);
  float grey = pow(max(luma(source), 0.0), 1.38);
  float flicker = digitalFlicker(9.0);
  vec3 color = vec3(grey * 0.07, grey * 0.48, grey * 0.88) * flicker;
  vec2 pixel = floor(uv * u_resolution);
  float staticNoise = hash12(pixel + vec2(floor(u_time * 28.0), floor(u_time * 19.0))) - 0.5;
  color += vec3(staticNoise * 0.10, staticNoise * 0.22, staticNoise * 0.31) * u_noise;
  float ghostBand = 1.0 - smoothstep(0.004, 0.019, abs(fract(uv.y * 11.0 + u_time * 0.09) - 0.5));
  color += vec3(0.02, 0.09, 0.16) * luma(samplePrevious(uv)) * ghostBand * u_feedback * 0.32;
  color += vec3(0.02, 0.18, 0.25) * roll * 0.15;
  color *= scanline(0.61, 0.24 * u_intensity) * vignette(uv, 0.66);
  gl_FragColor = vec4(saturateColor(applyFlash(color)), 1.0);
}