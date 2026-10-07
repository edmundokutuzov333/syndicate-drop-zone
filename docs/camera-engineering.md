# Camera Engineering

## Phase 0 and Phase 1

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
WebGL compositor
  ↓
ShaderCache / FilterRegistry / FrameBuffer
  ↓
Canvas Output
  ↓
Photo / Video capture

Phase 1 activates the first real path from browser device permission to a live WebGL canvas. Recording and final filter effects remain disabled until later phases.

## Phase 1 lifecycle

1. /camera mounts.
2. CameraManager requests camera + microphone together.
3. The default target is user / front camera.
4. Video constraints prefer 3840x2160 and 60 FPS, but use ideal constraints and accept the real capability returned by the browser.
5. The actual track settings drive the HUD, so the UI never claims 4K or 60 FPS when the device did not deliver it.
6. The MediaStream is attached to a single HTMLVideoElement.
7. WebGLEngine consumes that video as a GPU texture.
8. A fullscreen triangle renders the video through one compositor pass.
9. Orientation updates uniforms without restarting the stream.
10. Exiting /camera stops media tracks and tears down the WebGL resources.

## Permission and fallback

The page attempts to open camera + microphone on mount.

If permission is blocked, the surface remains intact and exposes only a small ALLOW/RETRY control.

If WebGL is unavailable, the feature falls back to the native video element instead of crashing the route.

If a microphone is unavailable but camera access succeeds, the camera remains usable and the HUD reports MIC OFF.

## Camera switching

The default direction is user.

Switching is not based only on the facingMode constraint. Device enumeration is used after permission, named devices are classified when possible, and an exact deviceId is preferred when a matching device is known.

If there is no second camera, the current camera is preserved.

## Orientation

OrientationManager separates:
- screen orientation
- viewport orientation
- camera orientation
- render orientation
- capture orientation

Rotation events update WebGL uniforms. The MediaStream is not restarted because the phone or window was rotated.

## WebGL lifecycle

The WebGL engine:
- prefers WebGL2 and falls back to WebGL1
- keeps preserveDrawingBuffer disabled
- creates one reusable fullscreen vertex buffer
- keeps one primary video texture
- uses texImage2D only when source dimensions change
- uses texSubImage2D for normal frame updates
- caches shader programs by key
- updates dynamic values through uniforms
- records FPS, frame time, dropped frames, DPR and render scale

The Phase 1 renderer uses one passthrough shader. The filter registry is already prepared for the production FX layer, but its six visible filters are intentionally disabled until Phase 2.

## Filter registry

Registered identifiers:

- OP1UM
- XEROX
- CORRUPT
- NIGHTVISION
- THERMAL
- REDROOM

Each definition already carries a complexity tier, shader key and feedback capability. No final visual effect is shipped in Phase 1.

## Capture boundary

The WebGL canvas is the future source for photo and video capture.

Phase 1 does not ship:
- MediaRecorder UX
- countdown
- flash
- download
- final photo formats
- final video encoding

The requested future output formats such as H.264 MP4, ProRes MOV and HEVC MKV require runtime capability validation and, where browser recording APIs cannot natively produce the requested container/codec pair, a dedicated encoding path. They are not falsely advertised as available in Phase 1.

## Privacy boundary

device → browser permission → local MediaStream → local WebGL → local canvas → local capture

There is no automatic upload, Supabase persistence, remote camera processing or Control Room integration for camera frames.

## Performance budget

Phase 1 starts with:
- one render loop
- one primary video texture
- one fullscreen draw
- no filter recompilation
- reusable GPU resources
- bounded DPR

Adaptive degradation remains conservative. Phase 4 is responsible for device-specific profiling and more aggressive adaptive resolution.

## Existing site integrity

The camera feature is imported by /camera only. Other routes do not import CameraManager, MediaRecorder or camera shaders.

Supabase remains unchanged by the camera feature. Existing Control Room and public content tables are not part of camera runtime.

## Reference projects

webcam-shader-boilerplate informed the webcam-to-texture-to-shader flow and feedback concepts.

pmndrs/postprocessing informed effect lifecycle, uniform discipline, caching and composition concepts.

filters-test-kutu informed orientation, recording contracts, countdown, crossfade, dynamic grain, thermal/phosphor concepts, camera switching and cleanup.

No repository is copied wholesale.

## Phase boundaries

Phase 1: real camera + microphone, front default, device detection, switching, permission flow, native fallback, live WebGL preview, orientation and cleanup.

Phase 2: real-time FX engine, dynamic grain/noise/distortion/chromatic/feedback, filter programs and 300 ms cross-fade.

Phase 3: photo/video capture, countdown, flash, MediaRecorder, audio routing, preview, download and capture tests.

Phase 4: profiling, shader/uniform/texture optimisation, adaptive render resolution, low-end hardening and cross-browser lifecycle tests.

## Phase 1 definition of done

- [x] camera starts on /camera
- [x] microphone requested with camera
- [x] front camera is the default target
- [x] device enumeration and front/back switching foundation
- [x] live video reaches WebGL
- [x] WebGL2/WebGL1 fallback
- [x] native video fallback when WebGL is unavailable
- [x] orientation changes without stream restart
- [x] actual resolution/FPS shown in HUD
- [x] cleanup on route exit
- [x] camera feature isolated from the rest of the application
- [x] no automatic upload/persistence
- [x] unit coverage for camera foundations
