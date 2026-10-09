void main() {
  vec2 uv = v_uv;
  float row = floor(uv.y * u_resolution.y / 2.0);
  float clock = floor(u_time * 11.0);
  float rowNoise = hash12(vec2(row, clock));
  float tear = step(0.91, rowNoise) * step(0.28, hash12(vec2(clock + 7.0, row)));
  float tracking = sin(uv.y * 34.0 - u_time * 4.2) * 0.0035;
  uv.x = clamp(uv.x + tracking + (rowNoise - 0.5) * tear * (0.035 + u_distortion * 0.07), 0.001, 0.999);
  vec2 split = vec2(0.0015 + u_chromatic * 0.42, 0.0);
  vec3 color = vec3(sampleColor(uv + split).r, sampleColor(uv).g, sampleColor(uv - split).b);
  float mono = luma(color);
  color = mix(color, vec3(mono * 0.82, mono * 0.91, mono * 1.08), 0.76);
  float bandDistance = abs(fract(v_uv.y * 7.0 - u_time * 0.19) - 0.5);
  float trackingBand = 1.0 - smoothstep(0.008, 0.027, bandDistance);
  color = mix(color, samplePrevious(uv), trackingBand * u_feedback * 0.28);
  color *= (1.0 - tear * 0.18) * scanline(0.57, 0.19 * u_intensity);
  color += vec3(0.02, 0.045, 0.075) * filmGrain(uv, mono) * (0.7 + u_noise);
  color += vec3(0.08, 0.11, 0.14) * trackingBand * (0.07 + tear * 0.28);
  color *= vignette(v_uv, 0.22);
  gl_FragColor = vec4(saturateColor(applyFlash(color)), 1.0);
}