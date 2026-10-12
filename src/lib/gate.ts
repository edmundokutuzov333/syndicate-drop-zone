export const GATE_SESSION_KEY = "sdt-open";

export const GATE_BOOT =
  'try{let gateBootOpen=sessionStorage.getItem("sdt-open")==="1";document.documentElement.dataset.gate=gateBootOpen?"open":"locked";if(gateBootOpen){document.documentElement.dataset.gateBoot="open"}else{delete document.documentElement.dataset.gateBoot}}catch(e){document.documentElement.dataset.gate="locked";delete document.documentElement.dataset.gateBoot}';

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
