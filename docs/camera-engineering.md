# Camera Engineering

## Phase 0, Phase 1 and Phase 2

The camera feature is an isolated local capture surface. The global site shell does not render TacticalNav, footer, grain or scanlines on /camera.

## Architecture

/camera
  ↓
Camera Surface
  ↓
CameraManager / DeviceManager / OrientationManager / CapabilityDetector
  ↓
MediaStream + HTMLVideoElement
  ↓
TextureManager
  ↓
WebGL FX engine
  ↓
ShaderCache / FilterRegistry / FrameBuffer
  ↓
Canvas Output
  ↓
Photo / Video capture

Phase 2 activates the real-time visual FX layer while capture remains deliberately outside the phase boundary.

## Phase 2 lifecycle

1. /camera mounts and requests camera + microphone through the existing CameraManager.
2. WebGLEngine initializes WebGL2 first and WebGL1 as fallback.
3. The engine precompiles the six visible filter programs into the ShaderCache before normal filter interaction.
4. Each live frame reuses a primary GPU texture and a previous-frame texture instead of allocating textures per frame.
5. The selected filter runs in one fullscreen shader pass during normal operation.
6. Feedback-capable filters can sample the previous frame for temporal drift, trails and echo-like motion.
7. Filter changes use a dedicated two-filter cross-fade path for exactly 300 ms. The normal steady-state path remains single-pass.
8. Dynamic values such as time, grain, distortion, chromatic shift and feedback are uniforms, not shader defines.
9. Adaptive render policy observes frame time and FPS and can lower DPR/render scale without changing the source camera resolution.
10. Route exit destroys the engine, programs, framebuffers, textures and media tracks.

## FX pipeline

camera frame
  ↓
current GPU texture + previous GPU texture
  ↓
filter shader
  ├── dynamic grain
  ├── procedural noise
  ├── lens / line distortion
  ├── chromatic aberration
  └── optional feedback
  ↓
Canvas Output

During the 300 ms transition:

previous filter → offscreen framebuffer A
current filter  → offscreen framebuffer B
A + B           → crossfade shader → Canvas Output

The additional passes exist only during the transition, not during the normal steady-state render loop.

## Shader architecture

Shared modules:
- common.glsl
- grain.glsl
- distortion.glsl
- chromatic.glsl
- feedback.glsl

Filter bodies:
- op1um.frag.glsl
- xerox.frag.glsl
- corrupt.frag.glsl
- nightvision.frag.glsl
- thermal.frag.glsl
- redroom.frag.glsl

The source is composed at build/runtime into individual filter programs. The project does not use one monolithic shaders.ts file.

## Filter behaviour

OP1UM:
deep blacks, high contrast, controlled blood-red grading, dynamic grain, chromatic drift, lens distortion and restrained feedback.

XEROX:
luminance posterisation, thresholding, edge extraction, paper noise and black crush.

CORRUPT:
time-varying RGB split, scanline jitter, block displacement, frame tearing and temporal noise.

NIGHTVISION:
green phosphor response, scanlines, rolling beam, vignette and procedural sensor grain.

THERMAL:
luminance-to-thermal palette, edge enhancement, sensor noise and subtle lens distortion.

REDROOM:
monochrome red treatment, deep shadows, highlight extraction, grain, chromatic drift, vignette and restrained feedback.

## Cross-fade

The transition duration is 300 ms.

The steady render path does not render two filters every frame. Only a filter change enters the transition compositor.

The transition compositor blends two reusable offscreen textures and then returns to the single-filter direct-to-canvas path.

## Performance

The phase keeps these constraints:
- one primary fullscreen draw in steady state
- two reusable video textures
- zero texture creation during normal frame updates
- shader programs compiled once and cached
- uniforms for dynamic parameters
- bounded DPR
- adaptive render scale when frame budget degrades
- no preserveDrawingBuffer dependency

The source camera stream remains at its browser-delivered capability. Performance adaptation changes the WebGL output resolution, not the camera track.

The target remains adaptive rather than absolute:
- modern desktop: approximately 60 FPS
- recent iPhone: approximately 60 FPS
- mid Android: approximately 45-60 FPS
- constrained hardware: stable lower frame rates are accepted rather than forcing a costly 60 FPS claim

## Existing site integrity

The camera feature remains imported only by /camera. The rest of the application does not load the FX shader bundle or camera runtime.

Supabase, Control Room and public content tables remain unchanged. Camera frames still stay local and are not uploaded automatically.

## Phase boundaries

Phase 1: real camera + microphone, front default, device detection, switching, permission flow, native fallback, live WebGL preview, orientation and cleanup.

Phase 2: real-time FX engine, dynamic grain/noise/distortion/chromatic/feedback, six filter programs, shader cache, 300 ms cross-fade, GPU resource reuse and adaptive render policy.

Phase 3: photo/video capture, countdown, flash, MediaRecorder, audio routing, preview, download and capture tests.

Phase 4: profiling, shader/uniform/texture optimisation, low-end hardening and cross-browser lifecycle tests.

## Phase 2 definition of done

- [x] six visible filters enabled
- [x] filter shader programs separated by file
- [x] shared shader modules
- [x] dynamic film grain
- [x] procedural noise
- [x] distortion
- [x] chromatic aberration
- [x] previous-frame feedback path
- [x] ShaderCache prewarming
- [x] 300 ms cross-fade
- [x] reusable frame textures
- [x] adaptive DPR/render scale
- [x] camera surface remains immersive and minimal
- [x] Phase 1 camera lifecycle preserved
- [x] no capture/upload/backend changes
- [ ] physical browser/device matrix still requires real-device validation in Phase 4
