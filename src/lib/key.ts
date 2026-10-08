import { KEY_TTL_MS } from "./config";

const KEY_STORAGE = "sdt-key";
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;

function storage(): Store {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function grantKey(at = Date.now(), target: Store = storage()): void {
  try {
    target?.setItem(KEY_STORAGE, String(at));
  } catch {
    // Storage can be unavailable.
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event("sdt-key"));
}

export function hasKey(at = Date.now(), target: Store = storage()): boolean {
  try {
    const value = Number(target?.getItem(KEY_STORAGE));
    return Number.isFinite(value) && value > 0 && at - value < KEY_TTL_MS;
  } catch {
    return false;
  }
}

export function keyLeftMs(at = Date.now(), target: Store = storage()): number {
  try {
    const value = Number(target?.getItem(KEY_STORAGE));
    return Number.isFinite(value) && value > 0 ? Math.max(0, KEY_TTL_MS - (at - value)) : 0;
  } catch {
    return 0;
  }
}

export function canEnterMerch(
  hasValidKey: boolean,
  options?: { isSyndicateMember?: boolean; phase?: string },
): boolean {
  if (hasValidKey) return true;
  if (options?.isSyndicateMember) return true;
  return options?.phase === "dropday" || options?.phase === "released";
}
