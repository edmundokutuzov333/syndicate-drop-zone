import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import type { FaceVfxUniformState } from "./types";

const VISION_WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm";
const FACE_LANDMARKER_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const DETECTION_INTERVAL_MS = 1000 / 15;
const IDENTITY_MATRIX = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
] as const;

const LEFT_EYE_INDICES = [33, 133, 159, 145];
const RIGHT_EYE_INDICES = [362, 263, 386, 374];
const MOUTH_INDICES = [13, 14, 61, 291];
const NOSE_INDEX = 1;

const EMPTY_FACE_VFX: FaceVfxUniformState = {
  face: [0.5, 0.5, 0, 0],
  eyes: [0, 0, 0, 0],
  mouth: [0.5, 0.58, 0, 0],
  details: [0, 0, 0, 0],
  pose: [0, 0, 0, 0],
  matrix: [...IDENTITY_MATRIX],
  motion: 0,
  motionBurst: 0,
  present: 0,
};

function averageLandmarks(
  landmarks: NormalizedLandmark[],
  indices: number[],
): [number, number, number] {
  let x = 0;
  let y = 0;
  let z = 0;
  let count = 0;

  for (const index of indices) {
    const point = landmarks[index];
    if (!point) continue;
    x += point.x;
    y += point.y;
    z += point.z ?? 0;
    count += 1;
  }

  if (count === 0) return [0, 0, 0];

  return [x / count, y / count, z / count];
}

function scoreByName(result: FaceLandmarkerResult, names: string[]): number {
  const categories = result.faceBlendshapes?.[0]?.categories ?? [];

  for (const category of categories) {
    if (names.includes(category.categoryName ?? "")) {
      return category.score ?? 0;
    }
  }

  return 0;
}

function readTransformationMatrix(
  result: FaceLandmarkerResult,
): FaceVfxUniformState["matrix"] {
  const matrixData = (
    result.facialTransformationMatrixes?.[0] as
      | { data?: ArrayLike<number> }
      | undefined
  )?.data;

  if (!matrixData || matrixData.length !== 16) {
    return [...IDENTITY_MATRIX];
  }

  return Array.from(matrixData) as FaceVfxUniformState["matrix"];
}

export function buildFaceVfxUniforms(
  result: FaceLandmarkerResult,
): FaceVfxUniformState {
  const landmarks = result.faceLandmarks?.[0];

  if (!landmarks || landmarks.length < 468) {
    return {
      face: [...EMPTY_FACE_VFX.face],
      eyes: [...EMPTY_FACE_VFX.eyes],
      mouth: [...EMPTY_FACE_VFX.mouth],
      details: [...EMPTY_FACE_VFX.details],
      pose: [...EMPTY_FACE_VFX.pose],
      matrix: [...IDENTITY_MATRIX],
      motion: 0,
      motionBurst: 0,
      present: 0,
    };
  }

  const bbox = {
    minX: 1,
    minY: 1,
    maxX: 0,
    maxY: 0,
  };

  for (const index of [10, 152, 234, 454]) {
    const point = landmarks[index];
    if (!point) continue;
    bbox.minX = Math.min(bbox.minX, point.x);
    bbox.minY = Math.min(bbox.minY, point.y);
    bbox.maxX = Math.max(bbox.maxX, point.x);
    bbox.maxY = Math.max(bbox.maxY, point.y);
  }

  const leftEye = averageLandmarks(landmarks, LEFT_EYE_INDICES);
  const rightEye = averageLandmarks(landmarks, RIGHT_EYE_INDICES);
  const mouth = averageLandmarks(landmarks, MOUTH_INDICES);
  const nose = landmarks[NOSE_INDEX];

  const eyeDx = rightEye[0] - leftEye[0];
  const eyeDy = rightEye[1] - leftEye[1];
  const eyeDistance = Math.max(0.001, Math.hypot(eyeDx, eyeDy));
  const eyeMidZ = (leftEye[2] + rightEye[2]) * 0.5;
  const yaw = Math.max(
    -0.85,
    Math.min(0.85, ((rightEye[2] - leftEye[2]) / eyeDistance) * 2.8),
  );
  const pitch = Math.max(
    -0.72,
    Math.min(
      0.72,
      (((nose?.y ?? mouth[1]) - (leftEye[1] + rightEye[1]) * 0.5) / eyeDistance -
        0.82) *
        0.72,
    ),
  );
  const roll = Math.atan2(eyeDy, eyeDx);

  const jawOpen = Math.max(
    Math.min(
      1,
      Math.abs((landmarks[13]?.y ?? mouth[1]) - (landmarks[14]?.y ?? mouth[1])) *
        9,
    ),
    scoreByName(result, ["jawOpen"]),
  );
  const smile = Math.min(
    1,
    (scoreByName(result, ["mouthSmileLeft"]) +
      scoreByName(result, ["mouthSmileRight"])) *
      0.5,
  );
  const blink = Math.min(
    1,
    (scoreByName(result, ["eyeBlinkLeft"]) +
      scoreByName(result, ["eyeBlinkRight"])) *
      0.5,
  );

  const matrix = readTransformationMatrix(result);

  return {
    face: [
      (bbox.minX + bbox.maxX) * 0.5,
      (bbox.minY + bbox.maxY) * 0.5,
      Math.max(bbox.maxX - bbox.minX, eyeDistance * 3.0),
      Math.max(bbox.maxY - bbox.minY, eyeDistance * 3.6),
    ],
    eyes: [leftEye[0], leftEye[1], rightEye[0], rightEye[1]],
    mouth: [mouth[0], mouth[1], jawOpen, smile],
    details: [1, roll, blink, jawOpen],
    pose: [yaw, pitch, roll, Math.max(0.01, eyeDistance)],
    matrix,
    motion: 0,
    motionBurst: 0,
    present: eyeMidZ === eyeMidZ ? 1 : 0,
  };
}

function copyEmptyFaceState(): FaceVfxUniformState {
  return {
    face: [...EMPTY_FACE_VFX.face],
    eyes: [...EMPTY_FACE_VFX.eyes],
    mouth: [...EMPTY_FACE_VFX.mouth],
    details: [...EMPTY_FACE_VFX.details],
    pose: [...EMPTY_FACE_VFX.pose],
    matrix: [...IDENTITY_MATRIX],
    motion: 0,
    motionBurst: 0,
    present: 0,
  };
}

export class FaceVfxTracker {
  private landmarker: FaceLandmarker | null = null;
  private initialization: Promise<void> | null = null;
  private destroyed = false;
  private lastDetectionAt = -Infinity;
  private lastTimestamp = 0;
  private previousFace: [number, number, number, number] | null = null;
  private previousPose: [number, number, number, number] | null = null;
  private motion = 0;
  private motionBurst = 0;
  private state: FaceVfxUniformState = copyEmptyFaceState();

  async warmup(): Promise<void> {
    if (this.destroyed || this.landmarker) return;
    if (this.initialization) return this.initialization;

    this.initialization = (async () => {
      const vision = await FilesetResolver.forVisionTasks(VISION_WASM_URL);

      if (this.destroyed) return;

      this.landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: FACE_LANDMARKER_MODEL_URL,
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numFaces: 1,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      });
    })()
      .catch(() => {
        this.landmarker = null;
      })
      .finally(() => {
        this.initialization = null;
      });

    return this.initialization;
  }

  detect(video: HTMLVideoElement, timestamp: number): FaceVfxUniformState {
    if (
      this.destroyed ||
      !this.landmarker ||
      video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      video.videoWidth <= 0 ||
      video.videoHeight <= 0 ||
      timestamp - this.lastDetectionAt < DETECTION_INTERVAL_MS
    ) {
      return this.state;
    }

    this.lastDetectionAt = timestamp;

    const monotonicTimestamp = Math.max(
      this.lastTimestamp + 1,
      Math.round(timestamp),
    );
    this.lastTimestamp = monotonicTimestamp;

    try {
      const result = this.landmarker.detectForVideo(
        video,
        monotonicTimestamp,
      );
      const next = buildFaceVfxUniforms(result);

      if (next.present > 0.5 && this.previousFace && this.previousPose) {
        const dt = Math.max(0.012, (timestamp - this.lastDetectionAt) / 1000);
        const positionDelta = Math.hypot(
          next.face[0] - this.previousFace[0],
          next.face[1] - this.previousFace[1],
        );
        const scaleDelta = Math.abs(next.face[2] - this.previousFace[2]);
        const rollDelta = Math.abs(next.pose[2] - this.previousPose[2]);
        const rawMotion = Math.min(
          1,
          positionDelta / dt * 0.085 +
            scaleDelta * 1.8 +
            rollDelta / dt * 0.018,
        );

        this.motion = this.motion * 0.64 + rawMotion * 0.36;
        this.motionBurst = Math.max(rawMotion, this.motionBurst * 0.68);
      } else if (next.present < 0.5) {
        this.motion *= 0.7;
        this.motionBurst *= 0.62;
      }

      this.previousFace = [...next.face];
      this.previousPose = [...next.pose];
      this.state = {
        ...next,
        motion: this.motion,
        motionBurst: this.motionBurst,
      };
    } catch {
      // A failed inference must never stop the camera render loop.
    }

    return this.state;
  }

  reset(): FaceVfxUniformState {
    this.previousFace = null;
    this.previousPose = null;
    this.motion = 0;
    this.motionBurst = 0;
    this.state = copyEmptyFaceState();
    return this.state;
  }

  destroy(): void {
    this.destroyed = true;
    this.landmarker?.close();
    this.landmarker = null;
    this.initialization = null;
    this.reset();
  }
}
