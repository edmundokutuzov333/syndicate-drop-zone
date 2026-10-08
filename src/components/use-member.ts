import { useEffect, useState, useSyncExternalStore } from "react";
import { getStoredMemberCode, memberPublic, type MemberPublic } from "@/lib/membership";

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

export function useMember(): {
  code: string | null;
  member: MemberPublic | null;
  loading: boolean;
} {
  const code = useSyncExternalStore(subscribe, getStoredMemberCode, () => null);
  const [member, setMember] = useState<MemberPublic | null>(null);
  const [loading, setLoading] = useState(Boolean(code));

  useEffect(() => {
    let active = true;
    if (!code) {
      setMember(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    memberPublic(code)
      .then((value) => {
        if (!active) return;
        setMember(value);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setMember(null);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [code]);

  return { code, member, loading };
}
