import { useEffect, useState, useSyncExternalStore } from "react";
import { getStoredMemberCode, memberPublic, type MemberPublic } from "@/lib/membership";

const cache = new Map<string, MemberPublic | null>();
const pending = new Map<string, Promise<MemberPublic | null>>();

const subscribe = (listener: () => void) => {
  if (typeof window === "undefined") return () => undefined;
  const handler = () => listener();
  window.addEventListener("sdt-member", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("sdt-member", handler);
    window.removeEventListener("storage", handler);
  };
};

function fetchMember(code: string): Promise<MemberPublic | null> {
  const cached = cache.get(code);
  if (cached !== undefined) return Promise.resolve(cached);
  const active = pending.get(code);
  if (active) return active;
  const request = memberPublic(code)
    .then((value) => {
      cache.set(code, value);
      return value;
    })
    .finally(() => pending.delete(code));
  pending.set(code, request);
  return request;
}

export function useMember(): {
  code: string | null;
  member: MemberPublic | null;
  loading: boolean;
} {
  const code = useSyncExternalStore(subscribe, getStoredMemberCode, () => null);
  const [member, setMember] = useState<MemberPublic | null>(() => (code ? cache.get(code) ?? null : null));
  const [loading, setLoading] = useState(Boolean(code && !cache.has(code)));

  useEffect(() => {
    let active = true;
    if (!code) {
      setMember(null);
      setLoading(false);
      return;
    }

    if (cache.has(code)) {
      setMember(cache.get(code) ?? null);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchMember(code)
      .then((value) => {
        if (!active) return;
        setMember(value);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        cache.set(code, null);
        setMember(null);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [code]);

  return { code, member, loading };
}
