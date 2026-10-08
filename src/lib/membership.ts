import { getPublicSupabaseConfig } from "@/lib/supabase-public";

export type MemberPublic = {
  code: string;
  memberNumber: number;
  alias: string;
  since: string;
};

export type JoinResult =
  | {
      alreadyMember: true;
      code: null;
      memberNumber: null;
      alias: null;
      since: null;
    }
  | {
      alreadyMember: false;
      code: string;
      memberNumber: number;
      alias: string;
      since: string;
    };

type Delegate = {
  alias: string;
  referrals: number;
};

function cfg() {
  return getPublicSupabaseConfig();
}

async function rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { url, key } = cfg();
  const response = await fetch(url + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Serviço do Sindicato indisponível.");
  }

  return (await response.json()) as T;
}

export async function joinUnion(input: {
  alias: string;
  contactType: "whatsapp" | "email";
  contactValue: string;
  referredBy?: string | null;
  signaturePresent: boolean;
}): Promise<JoinResult> {
  const result = await rpc<{
    code: string | null;
    member_number: number | null;
    alias: string | null;
    since: string | null;
    already_member: boolean;
  }>("join_union", {
    p_alias: input.alias,
    p_contact_type: input.contactType,
    p_contact_value: input.contactValue,
    p_referred_by: input.referredBy ?? null,
    p_statute_version: "v1",
    p_signature_present: input.signaturePresent,
  });

  return {
    alreadyMember: Boolean(result.already_member),
    code: result.code,
    memberNumber: result.member_number,
    alias: result.alias,
    since: result.since,
  } as JoinResult;
}

export async function memberPublic(code: string): Promise<MemberPublic | null> {
  if (!code.trim()) return null;
  const result = await rpc<
    Array<{
      code: string;
      member_number: number;
      alias: string;
      since: string;
    }>
  >("member_public", { p_code: code.trim() });

  const row = result[0];
  if (!row) return null;
  return {
    code: row.code,
    memberNumber: row.member_number,
    alias: row.alias,
    since: row.since,
  };
}

export async function getMemberCount(): Promise<number> {
  try {
    const result = await rpc<number>("member_count", {});
    return Number(result) || 0;
  } catch {
    return 0;
  }
}

export async function getDelegates(): Promise<Delegate[]> {
  try {
    const result = await rpc<Delegate[]>("delegados", {});
    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
}

export function getStoredMemberCode(): string | null {
  try {
    return localStorage.getItem("sdt-member");
  } catch {
    return null;
  }
}

export function storeMemberCode(code: string): void {
  try {
    localStorage.setItem("sdt-member", code);
  } catch {
    // Storage can be unavailable.
  }
  window.dispatchEvent(new Event("sdt-member"));
}

export function clearMemberCode(): void {
  try {
    localStorage.removeItem("sdt-member");
  } catch {
    // Storage can be unavailable.
  }
  window.dispatchEvent(new Event("sdt-member"));
}
