import { beforeEach, describe, expect, it, vi } from "vitest";
import { KEY_TTL_MS } from "@/lib/config";
import { canEnterMerch, grantKey, hasKey, keyLeftMs } from "@/lib/key";
import { IDLE_STATE, tape } from "@/lib/tape-engine";
import { GATE_BOOT, GATE_SESSION_KEY, isGateOpen, openGate } from "@/lib/gate";
import { isMuted, setMuted, subscribeMute } from "@/lib/audio-bus";
import { flush, setSink, track } from "@/lib/track";

describe("FASE 1 gate", () => {
  beforeEach(() => {
    sessionStorage.clear();
    document.documentElement.dataset.gate = "locked";
  });

  it("boots synchronously from sessionStorage", () => {
    expect(GATE_BOOT).toContain('sessionStorage.getItem("sdt-open")');
    expect(GATE_BOOT).toContain("dataset.gate");
  });

  it("opens the gate without waiting for a React effect", () => {
    openGate();
    expect(isGateOpen()).toBe(true);
    expect(sessionStorage.getItem(GATE_SESSION_KEY)).toBe("1");
  });
});

describe("FASE 1 key", () => {
  beforeEach(() => localStorage.clear());

  it("grants a 24 hour key", () => {
    const now = Date.now();
    grantKey(now);
    expect(hasKey(now + 1000)).toBe(true);
    expect(keyLeftMs(now + 1000)).toBe(KEY_TTL_MS - 1000);
  });

  it("unlocks merch only after a valid listening key is granted", () => {
    const now = Date.now();
    expect(canEnterMerch(hasKey(now))).toBe(false);
    grantKey(now);
    expect(canEnterMerch(hasKey(now + 10_000))).toBe(true);
  });

  it("expires after 24 hours", () => {
    const now = Date.now();
    grantKey(now);
    expect(hasKey(now + KEY_TTL_MS + 1)).toBe(false);
  });
});

describe("FASE 1 audio bus", () => {
  beforeEach(() => localStorage.clear());

  it("persists mute and notifies subscribers", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeMute(listener);
    setMuted(true);
    expect(isMuted()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    setMuted(false);
    expect(isMuted()).toBe(false);
    unsubscribe();
  });
});

describe("FASE 1 tape", () => {
  it("exports one persistent singleton with an idle initial state", () => {
    expect(tape.getState()).toEqual(IDLE_STATE);
    expect(tape.getQueue()).toEqual([]);
  });
});

describe("FASE 1 analytics", () => {
  it("buffers and flushes events through the configured sink", () => {
    const sink = vi.fn();
    setSink(sink);
    track("gate_open");
    flush();
    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink.mock.calls[0]?.[0]?.[0]?.name).toBe("gate_open");
    expect(sink.mock.calls[0]?.[0]?.[0]?.sid).toBeTruthy();
    expect(typeof sink.mock.calls[0]?.[0]?.[0]?.props).toBe("object");
  });
});
