import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearMemberCode,
  getDelegates,
  getMemberCount,
  getStoredMemberCode,
  memberPublic,
  storeMemberCode,
} from "@/lib/membership";

describe("FASE 5 membership", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("persists the local member code", () => {
    storeMemberCode("A3F9C2");
    expect(getStoredMemberCode()).toBe("A3F9C2");
    clearMemberCode();
    expect(getStoredMemberCode()).toBeNull();
  });

  it("maps only safe public member fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify([
            {
              code: "A3F9C2",
              member_number: 12,
              alias: "KUTZ",
              since: "2026-10-08T10:00:00Z",
            },
          ]),
          { status: 200 },
        ),
      ),
    );

    await expect(memberPublic("A3F9C2")).resolves.toEqual({
      code: "A3F9C2",
      memberNumber: 12,
      alias: "KUTZ",
      since: "2026-10-08T10:00:00Z",
    });
  });

  it("fails soft when public membership metrics are unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("offline", { status: 503 })));
    await expect(getMemberCount()).resolves.toBe(0);
    await expect(getDelegates()).resolves.toEqual([]);
  });
});
