import { getPublicSupabaseConfig, publicSupabaseHeaders } from "@/lib/supabase-public";

export type FanPublic = {
  code: string;
  fanNumber: number;
  alias: string;
  since: string;
};

type FanRow = { code: string; fan_number: number; alias: string; since: string };

function mapFan(row: FanRow): FanPublic {
  return { code: row.code, fanNumber: Number(row.fan_number), alias: row.alias, since: row.since };
}

async function rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { url, key } = getPublicSupabaseConfig();
  const response = await fetch(url + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: publicSupabaseHeaders(key, { "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error((await response.text()) || "O serviço do Sindicato está indisponível.");
  return (await response.json()) as T;
}

export async function registerFan(input: {
  alias: string;
  rulesVersion?: string;
  referredBy?: string | null;
}): Promise<FanPublic> {
  const alias = input.alias.trim();
  if (alias.length < 2 || alias.length > 20) throw new Error("NOME_INVALIDO");
  const payload = await rpc<FanRow[] | FanRow>("register_fan", {
    p_alias: alias,
    p_rules_version: input.rulesVersion ?? "v1",
    p_referred_by: input.referredBy ?? null,
  });
  const row = Array.isArray(payload) ? payload[0] : payload;
  if (!row?.code || !row.fan_number || !row.since || !row.alias) {
    throw new Error("O serviço do Sindicato não devolveu o cartão.");
  }
  return mapFan(row);
}

export async function fanPublic(code: string): Promise<FanPublic | null> {
  const safeCode = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(safeCode)) return null;
  const result = await rpc<FanRow[]>("fan_public", { p_code: safeCode });
  return result[0] ? mapFan(result[0]) : null;
}

export function getStoredFanCode(): string | null {
  try { return localStorage.getItem("sdt-fan"); } catch { return null; }
}

export function storeFanCode(code: string): void {
  try { localStorage.setItem("sdt-fan", code); } catch {
    // The shareable URL works even when local storage is unavailable.
  }
}
