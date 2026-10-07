# Camera Engineering

## Phase 0

Phase 0 establishes the camera subsystem without activating device input, shipping final visual filters or enabling recording.

The public route is `/camera`. It is isolated from the site's global grain, scanline and footer layers so the camera surface owns its visual pipeline.

## Architecture

```
/camera
  ↓
Camera Surface
  ↓
CameraManager / DeviceManager / Orientation / Capabilities
  ↓
MediaStream / HTMLVideoElement
  ↓
TextureManager
  ↓
WebGL Engine
  ↓
ShaderCache / FilterRegistry / FrameBuffer
  ↓
Canvas Output
  ↓
Photo / Video capture
```

The Phase 0 viewport only initializes a black WebGL canvas. It never calls `getUserMedia()` from import, route loading or render.

## Resource ownership

CameraManager owns the MediaStream and video element and stops all tracks on teardown.

WebGLEngine owns the WebGL context, texture manager, framebuffer and shader cache. Resource cleanup is explicit.

Recorder helpers only expose capability and capture contracts in this phase. Object URLs are explicitly revocable.

## Privacy boundary

`device → browser permission → local MediaStream → local WebGL → local canvas → local capture`

There is no Supabase persistence, automatic upload or remote media processing in Phase 0.

## Performance

The initial renderer targets 30 FPS, clamps DPR to 2 and starts at render scale 1. Metrics track FPS, frame time, dropped frames, device tier, DPR and render scale. Adaptive degradation exists as a conservative policy only.

## Technology decisions

Direct WebGL is the initial renderer. Three.js/PostProcessing is not added because Phase 0 needs a controlled 2D texture pipeline, custom GLSL contracts and explicit resource ownership rather than a general scene graph.

WebGL2 is preferred with WebGL1 fallback. `preserveDrawingBuffer` remains disabled by default.

## References

The webcam-shader-boilerplate reference informed the separation between camera capture, video texture and shader surface. Its dependency stack is not copied.

The pmndrs/postprocessing reference informed stable effect definitions, shader composition and cached GPU programs. The library is not a Phase 0 dependency.

The private filters-test-kutu reference informed separation of orientation, recorder, countdown, crossfade, grain and WebGL lifecycle concepts. Its implementation is not copied wholesale.

## Phase boundaries

Phase 0: route, isolation, contracts, managers, renderer foundation, filter registry, shader contracts, tests and documentation.

Phase 1: real permission flow, camera preview, orientation integration and first production filter.

Phase 2+: capture UX, recorder implementation, full filter stack, adaptive performance, device switching and final visual language.

## Exit checklist

- [x] /camera route
- [x] CAMERA navigation slot
- [x] isolated surface
- [x] typed camera contracts
- [x] camera/device/orientation/capability foundations
- [x] WebGL engine, shader cache, texture and framebuffer abstractions
- [x] six-filter registry
- [x] shader contracts without final effects
- [x] capture/recorder contracts
- [x] timer state machine
- [x] performance metrics and policy
- [x] tests
- [x] no camera/microphone auto-start
