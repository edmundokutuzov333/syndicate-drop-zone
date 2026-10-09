uniform float u_scanlineStrength;

vec3 crtThermalPalette(float value) {
  float t = clamp(value, 0.0, 1.0);
  vec3 blue = vec3(0.005, 0.035, 0.37);
  vec3 cyan = vec3(0.0, 0.76, 1.0);
  vec3 magenta = vec3(0.78, 0.015, 0.62);
  vec3 orange = vec3(1.0, 0.19, 0.025);
  vec3 yellow = vec3(1.0, 0.94, 0.28);

  vec3 color = mix(blue, cyan, smoothstep(0.0, 0.27, t));
  color = mix(color, magenta, smoothstep(0.22, 0.52, t));
  color = mix(color, orange, smoothstep(0.48, 0.78, t));
  color = mix(color, yellow, smoothstep(0.73, 1.0, t));
  return color;
}

vec2 crtClassicWarp(vec2 uv) {
  vec2 p = uv * 2.0 - 1.0;
  float radius = dot(p, p);
  p *= 1.0 + radius * (0.035 + u_distortion * 0.22);
  return p * 0.5 + 0.5;
}

void main() {
  vec2 uv = crtClassicWarp(v_uv);
  vec2 centered = uv * 2.0 - 1.0;
  float roundedEdge = max(abs(centered.x), abs(centered.y)) +
    min(abs(centered.x), abs(centered.y)) * 0.055;
  float glass = 1.0 - smoothstep(0.91, 1.015, roundedEdge);
  vec2 split = vec2((0.002 + u_chromatic * 0.52) * u_intensity, 0.0);
  vec3 color = vec3(sampleColor(uv + split).r, sampleColor(uv).g, sampleColor(uv - split).b);
  float sourceLuma = luma(color);
  float thermalPulse = sin(u_time * 0.42 + uv.y * 4.5 + uv.x * 1.5) * 0.024;
  float thermalValue = clamp(pow(max(sourceLuma, 0.0), 0.82) + thermalPulse, 0.0, 1.0);
  vec3 thermal = crtThermalPalette(thermalValue);
  color = mix(color, thermal, 0.74 * u_intensity);
  float y = luma(color);
  color = mix(color, vec3(color.r, y * 0.94, color.b * 1.06), 0.14 * u_intensity);
  color = softBloom(uv, color, 0.65, 0.16 * u_intensity);
  float scan = scanline(0.46, u_scanlineStrength * u_intensity);
  float phosphor = 0.965 + 0.035 * sin(uv.x * u_resolution.x * 1.02);
  float shimmer = 0.97 + 0.03 * sin(u_time * 2.0 + uv.y * 5.0);
  color += vec3(0.012, 0.025, 0.055) * filmGrain(uv, y) * (0.3 + u_noise);
  color *= scan * phosphor * shimmer * vignette(v_uv, 0.42) * glass;
  color += vec3(0.02, 0.05, 0.11) * smoothstep(0.75, 0.98, y) * 0.07;
  gl_FragColor = vec4(saturateColor(applyFlash(color)), 1.0);
}
