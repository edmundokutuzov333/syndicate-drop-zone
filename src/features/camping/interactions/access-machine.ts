export type CampingPhase =
  | "LOCKED"
  | "CODE_ENTRY"
  | "ACCESS_GRANTED"
  | "DOOR_OPENING"
  | "ENTERING_STUDIO"
  | "EXPLORATION"
  | "INTERACTION_FOCUS"
  | "ERROR";

export type CampingAccessState = {
  phase: CampingPhase;
  code: string;
  message: string | null;
  attempts: number;
  focusedId?: string;
};

export type CampingAccessAction =
  | { type: "DIGIT"; digit: string }
  | { type: "BACKSPACE" }
  | { type: "CLEAR" }
  | { type: "SUBMIT" }
  | { type: "DOOR_OPENING" }
  | { type: "ENTERING_STUDIO" }
  | { type: "EXPLORE" }
  | { type: "FOCUS_OBJECT"; id: string }
  | { type: "CLOSE_FOCUS" }
  | { type: "LOAD_ERROR"; message: string }
  | { type: "RETRY_LOAD" };

export const CAMPING_ACCESS_CODE = "808";

export const initialCampingAccessState: CampingAccessState = {
  phase: "LOCKED",
  code: "",
  message: null,
  attempts: 0,
};

const acceptsCode = (phase: CampingPhase) =>
  phase === "LOCKED" || phase === "CODE_ENTRY";

export function campingAccessReducer(
  state: CampingAccessState,
  action: CampingAccessAction,
): CampingAccessState {
  switch (action.type) {
    case "DIGIT": {
      if (!acceptsCode(state.phase) || !/^\d$/.test(action.digit)) return state;
      return {
        ...state,
        phase: "CODE_ENTRY",
        code: (state.code + action.digit).slice(-3),
        message: null,
      };
    }
    case "BACKSPACE":
      if (!acceptsCode(state.phase)) return state;
      return {
        ...state,
        phase: state.code.length > 1 ? "CODE_ENTRY" : "LOCKED",
        code: state.code.slice(0, -1),
        message: null,
      };
    case "CLEAR":
      if (!acceptsCode(state.phase)) return state;
      return { ...state, phase: "LOCKED", code: "", message: null };
    case "SUBMIT":
      if (!acceptsCode(state.phase)) return state;
      if (state.code === CAMPING_ACCESS_CODE) {
        return { ...state, phase: "ACCESS_GRANTED", message: "ACCESS GRANTED" };
      }
      return {
        ...state,
        phase: "LOCKED",
        code: "",
        attempts: state.attempts + 1,
        message: "INVALID CODE",
      };
    case "DOOR_OPENING":
      return state.phase === "ACCESS_GRANTED"
        ? { ...state, phase: "DOOR_OPENING", message: "ACCESS GRANTED" }
        : state;
    case "ENTERING_STUDIO":
      return state.phase === "DOOR_OPENING"
        ? { ...state, phase: "ENTERING_STUDIO", message: "ENTERING STUDIO" }
        : state;
    case "EXPLORE":
      return state.phase === "ENTERING_STUDIO"
        ? { ...state, phase: "EXPLORATION", code: "", message: null }
        : state;
    case "FOCUS_OBJECT":
      return state.phase === "EXPLORATION" && action.id.trim()
        ? { ...state, phase: "INTERACTION_FOCUS", focusedId: action.id }
        : state;
    case "CLOSE_FOCUS":
      return state.phase === "INTERACTION_FOCUS"
        ? { ...state, phase: "EXPLORATION", focusedId: undefined }
        : state;
    case "LOAD_ERROR":
      return { ...state, phase: "ERROR", message: action.message };
    case "RETRY_LOAD":
      return state.phase === "ERROR" && state.code === CAMPING_ACCESS_CODE
        ? { ...state, phase: "ACCESS_GRANTED", message: "RETRYING STUDIO LOAD" }
        : state;
    default:
      return state;
  }
}

export function isCampingWalkEnabled(phase: CampingPhase): boolean {
  return phase === "EXPLORATION";
}
