void main() {
  vec2 uv = v_uv;
  vec3 current = sampleColor(uv);
  vec3 previousInput = samplePrevious(uv);
  float motion = clamp(length(current - previousInput) * 3.7, 0.0, 1.0);
  float row = floor(uv.y * u_resolution.y / 4.0);
  float block = floor(uv.x * 18.0);
  float clock = floor(u_time * 8.5);
  float tearNoise = hash12(vec2(row, clock));
  float blockNoise = hash12(vec2(block, floor(u_time * 5.0)));
  float tear = step(0.79, tearNoise) * step(0.25, blockNoise);
  float displacement = (motion * 0.055 + tear * 0.075) * u_intensity * (0.35 + u_feedback);
  vec2 smearUv = clamp(uv - vec2(displacement, 0.0), vec2(0.001), vec2(0.999));
  vec3 smear = sampleColor(smearUv);
  vec3 color = mix(current, smear, clamp(motion * 0.58 + tear * 0.66, 0.0, 0.88));
  vec3 processedHistory = previousInput;
  if (u_feedbackReady > 0.5) {
    processedHistory = texture2D(u_feedbackFrame, clamp(uv, vec2(0.001), vec2(0.999))).rgb;
  }
  float feedbackWeight = clamp(u_feedback * (0.22 + motion * 0.52), 0.0, 0.82);
  color = mix(color, processedHistory, feedbackWeight * (0.35 + 0.65 * step(0.5, u_feedbackReady)));
  float slice = 1.0 - smoothstep(0.006, 0.023, abs(fract(uv.y * 9.0 + u_time * 0.08) - 0.5));
  vec2 split = vec2(0.001 + u_chromatic * 0.20 + tear * 0.018, 0.0);
  color.r = mix(color.r, sampleColor(smearUv + split).r, tear * 0.62);
  color.b = mix(color.b, sampleColor(smearUv - split).b, tear * 0.68);
  float mono = luma(color);
  color = mix(color, vec3(mono * 1.05, mono * 1.03, mono * 0.84), 0.16);
  color *= 1.0 - slice * 0.27;
  color += vec3(0.018, 0.023, 0.006) * filmGrain(uv, mono) * (0.45 + u_noise);
  color *= vignette(uv, 0.2);
  gl_FragColor = vec4(saturateColor(applyFlash(color)), 1.0);
}