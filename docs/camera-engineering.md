# Camera Engineering

## Phase 0, Phase 1, Phase 2, Phase 3 and Phase 4

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
CaptureEngine
  ├── Photo
  └── Video + microphone

Phase 3 connects the existing WebGL output to real local capture without introducing camera media persistence or Control Room coupling.

## Phase 3 lifecycle

### Photo

1. Verify camera is active, WebGL is available and the delivered camera source is at least 3840×2160.
2. Optional 3 s or 10 s countdown is rendered in the interface only.
3. Trigger a short 90 ms visual flash outside the capture canvas.
4. Force the WebGL canvas to the orientation-correct 4K dimensions.
5. Wait for a rendered frame at the capture resolution.
6. Export the rendered canvas to JPEG or PNG.
7. Restore the adaptive preview resolution.
8. Create a local object URL and open CapturePreview.
9. User downloads the original local blob using the generated filename.

### Video

1. Verify camera, WebGL and 4K source capability.
2. Optional 3 s or 10 s countdown runs before recording.
3. Force the WebGL canvas to the orientation-correct 4K dimensions.
4. Call canvas.captureStream(60).
5. Route the microphone through AudioContext + MediaStreamDestination when the browser exposes the API.
6. Combine the canvas video track with the processed microphone track.
7. Create MediaRecorder only after runtime codec capability detection.
8. Collect chunks without touching Supabase or remote storage.
9. On STOP, close the recorder, build the blob, restore preview resolution and open CapturePreview.

The interface countdown, flash and HUD are DOM overlays and are therefore not inserted into the canvas recording. The recorded pixels are the WebGL canvas output.

## 4K rule

The capture engine does not upscale a lower-resolution camera stream and call it native 4K.

When the delivered camera source is true 4K or higher, capture targets 3840×2160 in landscape or 2160×3840 in portrait.

When 4K is unavailable, capture is still allowed at the maximum real camera resolution actually delivered by the track. The interface exposes that resolution and the filename uses the actual dimensions instead of a false 4K tag.

The preview renderer may use adaptive DPR/render scale for performance, while capture temporarily forces the output canvas to the true 4K dimensions or the actual maximum source dimensions.

## Video format capability policy

The application checks MediaRecorder.isTypeSupported() at runtime.

Requested formats are represented explicitly:
- MP4: H.264 / AAC
- MOV: ProRes 422 HQ / 4444
- MKV: H.265 / HEVC

A requested format is selectable only when the current browser exposes a matching MediaRecorder MIME/codec combination. Otherwise it stays visible as unavailable instead of producing a file with the wrong codec and extension.

WEBM / VP9 is retained as a browser-native fallback so that a browser with no requested MP4/MOV/MKV encoder can still record a real video.

The same principle applies to TIFF. Native browser canvas export does not provide the requested Adobe RGB / CMYK TIFF pipeline, so TIFF remains unavailable until a dedicated encoder is introduced. JPEG and PNG remain native sRGB exports.

## Filename strategy

Files follow:

SDT_YYYYMMDD_HHMMSS_FILTER_FRONT_4K.ext

or

SDT_YYYYMMDD_HHMMSS_FILTER_BACK_4K.ext

Below 4K, the source dimensions are used instead of a false 4K tag, for example:

SDT_YYYYMMDD_HHMMSS_FILTER_BACK_1920x1080.ext

The actual output extension is derived from the MIME type emitted by the recorder.

## Audio routing

The camera stream remains owned by CameraManager.

For video capture:
camera MediaStream
  ↓
microphone audio track
  ↓
AudioContext
  ↓
MediaStreamDestination
  ↓
recording MediaStream

No audio node is connected to speakers, preventing the recorder path from intentionally feeding the microphone back to the output.

When AudioContext is unavailable, the engine falls back to the camera stream's live audio track where the browser exposes one.

## Capture preview and cleanup

CapturePreview owns only the local object URL reference.

Closing the preview revokes the object URL.

Route exit:
- stops MediaRecorder when active
- closes the audio context
- stops capture tracks
- restores preview resolution
- destroys WebGL resources
- CameraManager stops camera and microphone tracks

## Existing architecture preserved

Phase 3 does not change:
- route topology
- global shell behaviour
- Supabase tables
- Control Room contracts
- privacy boundary
- Phase 2 filter shaders
- adaptive preview rendering

The camera feature remains isolated to /camera.

## Phase boundaries

Phase 1: real camera + microphone, front default, device detection, switching, permission flow, native fallback, live WebGL preview, orientation and cleanup.

Phase 2: real-time FX engine, dynamic grain/noise/distortion/chromatic/feedback, six filter programs, shader cache, 300 ms cross-fade, GPU resource reuse and adaptive render policy.

Phase 3: photo/video capture, countdown, flash, MediaRecorder, audio routing, preview, download, filename strategy, 4K capture gate and runtime format capabilities.

Phase 4: profiling, shader/uniform/texture optimisation, low-end hardening and browser lifecycle hardening.

## Phase 4 engineering

### Render profiling

The WebGL engine now records:
- rolling FPS and frame time
- render CPU time
- texture upload time
- shader compile time
- draw calls per frame
- JavaScript heap usage when the browser exposes it
- GC event count when the browser exposes a GC PerformanceObserver entry type
- device tier, DPR and adaptive render scale

GPU cost is treated as a workload proxy through render time, texture upload time and draw-call count because WebGL does not expose a portable synchronous GPU timing API across all target browsers.

### Shader and uniform optimisation

- shader programs remain cached by stable program key
- program compilation is measured and never repeated for ordinary uniform changes
- uniform locations are cached
- unchanged uniforms are skipped instead of issuing redundant GL calls
- dynamic values remain uniforms rather than shader defines
- the normal render path remains one filter pass
- two filter passes plus a blend pass are used only during the 300 ms filter transition

### Texture and framebuffer reuse

- two persistent video textures are reused frame-to-frame
- video updates use texSubImage2D after initial allocation
- transition framebuffers are reused when the output resolution has not changed
- capture still allocates the required orientation-correct 4K surfaces only when the capture resolution actually changes
- no per-frame WebGL texture creation is introduced

### Low-end hardening

Adaptive policy lowers render scale/DPR only when the measured frame budget degrades. It never changes the delivered camera track resolution.

The capture path explicitly disables adaptive preview scaling while forcing the true 4K dimensions when the camera supports 4K, or the maximum real source dimensions otherwise. The preview policy is restored after capture.

### Lifecycle hardening

- camera recovery checks for ended video tracks when the page becomes visible again
- camera tracks expose an ended lifecycle state instead of silently rendering a dead stream
- WebGL context loss is intercepted and the engine can reinitialise after context restoration
- hidden tabs stop the live render workload when not recording
- recording keeps the render loop alive while the document is hidden
- route cleanup remains responsible for WebGL, MediaRecorder, audio and camera resources

### Bundle isolation

The /camera route lazy-loads CameraPage so the heavy camera feature is no longer eagerly pulled into the initial application route payload.

### Capability hardening

Requested MP4, MOV and MKV formats remain capability-gated through MediaRecorder.isTypeSupported(). Unsupported encoders are never simulated by changing file extensions.

TIFF remains explicitly unavailable because the requested Adobe RGB / CMYK, lossless browser-native TIFF pipeline does not exist in the current capture layer.

## Phase 4 verification boundary

Static/unit coverage has been expanded for codec capability gating and adaptive performance policy.

Physical validation on real iPhone, Android, Safari, Chrome, Firefox, Edge, low-end GPUs and browser sleep/wake conditions still requires an actual browser/device matrix. The code is hardened for those cases, but no claim of a completed physical matrix is made until those environments have been exercised.

## Phase 3 definition of done

- [x] photo shutter is functional
- [x] video shutter starts and stops recording
- [x] 3 s timer
- [x] 10 s timer
- [x] timer OFF
- [x] countdown is rendered outside the recorded canvas
- [x] short visual flash
- [x] 4K output canvas when the source supports 4K
- [x] maximum real source resolution fallback below 4K
- [x] lower-resolution camera sources are not falsely labelled 4K
- [x] microphone is routed into video when browser audio APIs permit
- [x] runtime MediaRecorder capability detection
- [x] CapturePreview
- [x] local download
- [x] filename strategy
- [x] front/rear capture state preserved
- [x] object URL cleanup
- [x] recorder/audio/WebGL cleanup
- [x] no automatic upload
- [x] no Supabase changes
- [ ] physical browser/device matrix still requires real-device validation in Phase 4


## Camera performance audit — three execution phases

### Phase 1 — expensive VFX only on demand

Implemented in the camera viewport:

- MediaPipe face tracking starts only when a filter consumes face position, expression, pose or movement: `vamp`, `astro-haze`, `xray-mesh` and `kinetic-melt`.
- The separate Three.js/WebGL overlay is constructed only for `vamp`, `astro-haze` and `xray-mesh`.
- Leaving a face-tracked filter resets the face state before the next filter renders, avoiding stale tracking values.
- The 15 filter definitions, filter order, visual controls, transition engine, camera track constraints, capture pipeline, route tree and database contracts remain unchanged.

This phase targets startup latency, memory pressure and GPU-context overhead for the 12 filters that do not need the Three.js overlay, and avoids starting the MediaPipe model until face tracking is requested. This is an architectural workload reduction, not a claim of measured FPS improvement; physical device profiling remains pending.

### Phase 2 — render-pipeline optimisation (implemented)

- [x] Eligible single-pass frames render directly to the visible canvas, bypassing the offscreen final framebuffer and the follow-up full-frame copy.
- [x] Direct rendering is disabled during filter transitions, scene overlays, HUD/countdown clearing or drawing, Master FX, and the `halation`/`kinetic-melt` multipass/feedback pipelines.
- [x] The initially selected filter compiles synchronously; remaining regular filter programs compile incrementally during browser idle time where `requestIdleCallback` exists, while `setFilter` retains an on-demand compilation fallback.
- [x] Cinematic pass shaders are compiled only when their filter/Master FX is used.
- [x] Cinematic framebuffers are allocated only for the pass groups that need them and previously allocated buffers are resized with the preview/capture surface.
- [x] The 300 ms cross-fade, filter registry and IDs, Master FX composition, HUD/countdown overlays, feedback state and local capture contract remain intact.
- [ ] Runtime profiling on real devices remains pending; reduced passes/allocations are structural improvements and are not presented as measured FPS gains.

### Phase 3 — device-aware preview and capture (pending)

- Add explicit adaptive preview profiles based on delivered camera capabilities and observed render cost.
- Keep capture resolution truthful: photo/video output must use the actual source capability and must never label an upscaled lower-resolution source as native 4K.
- Tune face inference cadence and inference input size only after confirming that the 3D effects and kinetic-melt motion remain visually correct.
- Run a real-device matrix: iPhone Safari, Android Chrome, desktop browsers and a lower-end GPU; record startup time, FPS/frame-time metrics, dropped frames, texture upload cost and thermal degradation.

### Phase 1 verification boundary

No camera backend or Supabase schema change is required: capture remains local, with no media upload or camera-specific persistence. No route, global shell or Control Room contract is changed. CI results and the active deployment status are reported separately from physical-device validation; inaccessible preview hosts are not treated as a passed runtime test.
