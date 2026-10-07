import { type CaptureTimer } from "./types";

export type CaptureTimerState =
  | { status: "idle"; timer: CaptureTimer }
  | { status: "capturing"; timer: CaptureTimer }
  | { status: "done"; timer: CaptureTimer }
  | { status: "cancelled"; timer: CaptureTimer };

export type CaptureTimerEvent =
  | { type: "SET_TIMER"; timer: CaptureTimer }
  | { type: "START" }
  | { type: "DONE" }
  | { type: "CANCEL" }
  | { type: "RESET" };

export function captureTimerReducer(state: CaptureTimerState, event: CaptureTimerEvent): CaptureTimerState {
  switch (event.type) {
    case "SET_TIMER":
      return state.status === "capturing" ? state : { status: "idle", timer: event.timer };
    case "START":
      return { status: "capturing", timer: state.timer };
    case "DONE":
      return { status: "done", timer: state.timer };
    case "CANCEL":
      return { status: "cancelled", timer: state.timer };
    case "RESET":
      return { status: "idle", timer: state.timer };
    default:
      return state;
  }
}

export function createCaptureTimerState(timer: CaptureTimer = "off"): CaptureTimerState {
  return { status: "idle", timer };
}
