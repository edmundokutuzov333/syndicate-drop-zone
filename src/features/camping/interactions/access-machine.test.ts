import { describe, expect, it } from "vitest";
import {
  campingAccessReducer,
  initialCampingAccessState,
  isCampingWalkEnabled,
} from "./access-machine";

const type = (digits: string) =>
  [...digits].reduce(
    (state, digit) => campingAccessReducer(state, { type: "DIGIT", digit }),
    initialCampingAccessState,
  );

describe("CAMPING 808 access machine", () => {
  it("accepts exactly the 808 sequence and advances through the door states", () => {
    const entered = campingAccessReducer(type("808"), { type: "SUBMIT" });
    expect(entered.phase).toBe("ACCESS_GRANTED");
    expect(entered.message).toBe("ACCESS GRANTED");
    expect(campingAccessReducer(entered, { type: "DOOR_OPENING" }).phase).toBe("DOOR_OPENING");
    expect(campingAccessReducer({ ...entered, phase: "DOOR_OPENING" }, { type: "ENTERING_STUDIO" }).phase).toBe("ENTERING_STUDIO");
    expect(campingAccessReducer({ ...entered, phase: "ENTERING_STUDIO" }, { type: "EXPLORE" }).phase).toBe("EXPLORATION");
  });

  it("rejects a wrong code, increments attempts and resets input", () => {
    const state = campingAccessReducer(type("809"), { type: "SUBMIT" });
    expect(state.phase).toBe("LOCKED");
    expect(state.code).toBe("");
    expect(state.attempts).toBe(1);
    expect(state.message).toBe("INVALID CODE");
  });

  it("limits input to three digits and supports clear/backspace", () => {
    const typed = type("1808");
    expect(typed.code).toBe("808");
    expect(campingAccessReducer(typed, { type: "BACKSPACE" }).code).toBe("80");
    expect(campingAccessReducer(typed, { type: "CLEAR" }).code).toBe("");
  });

  it("does not accept a non-digit or transition out of order", () => {
    const initial = campingAccessReducer(initialCampingAccessState, { type: "DIGIT", digit: "x" });
    expect(initial).toEqual(initialCampingAccessState);
    expect(campingAccessReducer(initial, { type: "ENTERING_STUDIO" as never })).toEqual(initial);
  });

  it("enables free movement only after the studio entrance transition", () => {
    expect(isCampingWalkEnabled("LOCKED")).toBe(false);
    expect(isCampingWalkEnabled("ENTERING_STUDIO")).toBe(false);
    expect(isCampingWalkEnabled("EXPLORATION")).toBe(true);
  });

  it("does not reopen or submit twice after access is granted", () => {
    const entered = campingAccessReducer(type("808"), { type: "SUBMIT" });
    expect(campingAccessReducer(entered, { type: "SUBMIT" })).toEqual(entered);
    expect(campingAccessReducer(entered, { type: "DOOR_OPENING" }).phase).toBe("DOOR_OPENING");
  });
});
