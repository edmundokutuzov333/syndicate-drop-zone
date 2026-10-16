import { useSyncExternalStore } from "react";
import { IDLE_STATE, tape, type TapeState } from "@/lib/tape-engine";

export function useTape(): TapeState {
  return useSyncExternalStore(tape.subscribe, tape.getState, () => IDLE_STATE);
}
