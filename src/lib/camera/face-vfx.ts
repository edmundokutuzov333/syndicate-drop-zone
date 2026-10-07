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

const LEFT_EYE_INDICES = [33, 133, 159, 145];
const RIGHT_EYE_INDICES = [362, 263, 386, 374];
const MOUTH_INDICES = [13, 14, 61, 291];

const EMPTY_FACE_VFX: FaceVfxUniformState = {
  face: [0.5, 0.5, 0, 0],
  eyes: [0, 0, 0, 0],
  mouth: [0.5, 0.58, 0, 0],
  details: [0, 0, 0, 0],
};

function averageLandmarks(
  landmarks: NormalizedLandmark[],
  indices: number[],
): [number, number] {
  let x = 0;
  let y = 0;

  for (const index of indices) {
    const point = landmarks[index];
    if (!point) continue;
    x += point.x;
    y += point.y;
  }

  return [x / indices.length, y / indices.length];
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

export function buildFaceVfxUniforms(
  result: FaceLandmarkerResult,
): FaceVfxUniformState {
  const landmarks = result.faceLandmarks?.[0];

  if (!landmarks || landmarks.length < 468) {
    return {
      face: [...EMPTY_FACE_VFX.face] as FaceVfxUniformState["face"],
      eyes: [...EMPTY_FACE_VFX.eyes] as FaceVfxUniformState["eyes"],
      mouth: [...EMPTY_FACE_VFX.mouth] as FaceVfxUniformState["mouth"],
      details: [...EMPTY_FACE_VFX.details] as FaceVfxUniformState["details"],
    };
  }

  const bbox = {
    minX: 1,
    minY: 1,
    maxX: 0,
    maxY: 0,
  };

  const faceOval = [10, 152, 234, 454];

  for (const index of faceOval) {
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

  const eyeDistance = Math.max(
    0.001,
    Math.hypot(rightEye[0] - leftEye[0], rightEye[1] - leftEye[1]),
  );
  const mouthOpenFallback = Math.min(
    1,
    Math.abs((landmarks[13]?.y ?? mouth[1]) - (landmarks[14]?.y ?? mouth[1])) *
      9,
  );

  const jawOpen = Math.max(
    mouthOpenFallback,
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

  return {
    face: [
      (bbox.minX + bbox.maxX) * 0.5,
      (bbox.minY + bbox.maxY) * 0.5,
      Math.max(bbox.maxX - bbox.minX, eyeDistance * 3.0),
      Math.max(bbox.maxY - bbox.minY, eyeDistance * 3.6),
    ],
    eyes: [leftEye[0], leftEye[1], rightEye[0], rightEye[1]],
    mouth: [mouth[0], mouth[1], jawOpen, smile],
    details: [
      1,
      Math.atan2(rightEye[1] - leftEye[1], rightEye[0] - leftEye[0]),
      blink,
      jawOpen,
    ],
  };
}

export class FaceVfxTracker {
  private landmarker: FaceLandmarker | null = null;
  private initialization: Promise<void> | null = null;
  private destroyed = false;
  private lastDetectionAt = -Infinity;
  private lastTimestamp = 0;
  private state: FaceVfxUniformState = {
    face: [...EMPTY_FACE_VFX.face] as FaceVfxUniformState["face"],
    eyes: [...EMPTY_FACE_VFX.eyes] as FaceVfxUniformState["eyes"],
    mouth: [...EMPTY_FACE_VFX.mouth] as FaceVfxUniformState["mouth"],
    details: [...EMPTY_FACE_VFX.details] as FaceVfxUniformState["details"],
  };

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
      this.state = buildFaceVfxUniforms(result);
    } catch {
      // A failed inference must never stop the camera render loop.
    }

    return this.state;
  }

  reset(): FaceVfxUniformState {
    this.state = {
      face: [...EMPTY_FACE_VFX.face] as FaceVfxUniformState["face"],
      eyes: [...EMPTY_FACE_VFX.eyes] as FaceVfxUniformState["eyes"],
      mouth: [...EMPTY_FACE_VFX.mouth] as FaceVfxUniformState["mouth"],
      details: [...EMPTY_FACE_VFX.details] as FaceVfxUniformState["details"],
    };
    return this.state;
  }

  destroy(): void {
    this.destroyed = true;
    this.landmarker?.close();
    this.landmarker = null;
    this.initialization = null;
  }
}
