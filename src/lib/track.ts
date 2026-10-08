import { getPublicSupabaseConfig } from "@/lib/supabase-public";

export type EventName =
  | "gate_open" | "tape_play" | "tape_10s" | "key_earned" | "merch_view" | "cart_add" | "reserve"
  | "proof_sent" | "join_start" | "join_done" | "card_share" | "selo_found" | "live_notify" | "artist_view"
  | "sponsor_click";

export type EventRow = {
  sid: string;
  name: EventName;
  props: Record<string, string | number | boolean>;
};

type Sink = (rows: EventRow[]) => void | Promise<void>;

let sink: Sink | null = null;
let buffer: EventRow[] = [];
let timer: number | null = null;

function sid(): string {
  try {
    let value = sessionStorage.getItem("sdt-sid");
    if (!value) {
      value = Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem("sdt-sid", value);
    }
    return value;
  } catch {
    return "anon";
  }
}

export const setSink = (next: Sink | null): void => {
  sink = next;
};

export function track(name: EventName, props: EventRow["props"] = {}): void {
  if (typeof window === "undefined") return;
  buffer.push({ sid: sid(), name, props });
  window.clearTimeout(timer ?? 0);
  timer = window.setTimeout(() => {
    timer = null;
    flush();
  }, 1500);
}

export function flush(): void {
  if (!sink || buffer.length === 0) return;
  const rows = buffer;
  buffer = [];
  try {
    void Promise.resolve(sink(rows)).catch(() => undefined);
  } catch {
    // Analytics must never break the experience.
  }
}

async function pushEvents(rows: EventRow[]): Promise<void> {
  try {
    const { url, key } = getPublicSupabaseConfig();
    const response = await fetch(url + "/rest/v1/events", {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: "Bearer " + key,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(rows),
    });
    if (!response.ok) await response.text();
  } catch {
    // Network/config/RLS failures must never break UI.
  }
}

setSink(pushEvents);
