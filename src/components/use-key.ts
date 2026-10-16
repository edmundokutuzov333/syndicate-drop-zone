import { useSyncExternalStore } from "react";
import { hasKey } from "@/lib/key";

const subscribe = (listener: () => void) => {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("sdt-key", listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener("sdt-key", listener);
    window.removeEventListener("storage", listener);
  };
};

export function useKey(): boolean {
  return useSyncExternalStore(subscribe, () => hasKey(), () => false);
}
