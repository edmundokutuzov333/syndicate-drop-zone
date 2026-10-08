export const GATE_SESSION_KEY = "sdt-open";

export const GATE_BOOT =
  'try{document.documentElement.dataset.gate=sessionStorage.getItem("sdt-open")==="1"?"open":"locked"}catch(e){document.documentElement.dataset.gate="locked"}';

export function isGateOpen(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.gate === "open";
}

export function openGate(): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.gate = "open";
  try {
    sessionStorage.setItem(GATE_SESSION_KEY, "1");
  } catch {
    // Storage can be blocked in private/sandboxed contexts.
  }
}
