void main() {
  vec3 source = sampleColor(v_uv);
  gl_FragColor = vec4(source, 1.0);
}
