void main() {
  vec3 source = sampleColor(v_uv);
  gl_FragColor = vec4(saturateColor(filmic(source)), 1.0);
}
