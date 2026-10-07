export type ControlRoomRole = "OWNER" | "ADMIN" | "EDITOR" | "PARTNERSHIPS" | "MERCH";

export type ControlRoomSession = {
  accessToken: string;
  refreshToken: string;
  userId: string;
  email: string;
  displayName: string;
  role: ControlRoomRole;
};

const ACCESS_KEY = "sdt-control-access";
const REFRESH_KEY = "sdt-control-refresh";
const USER_KEY = "sdt-control-user";

function getSupabaseConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key =
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);
  if (!url || !key) throw new Error("O Control Room não está configurado.");
  return { url, key };
}

function saveSession(session: ControlRoomSession) {
  sessionStorage.setItem(ACCESS_KEY, session.accessToken);
  sessionStorage.setItem(REFRESH_KEY, session.refreshToken);
  sessionStorage.setItem(
    USER_KEY,
    JSON.stringify({
      userId: session.userId,
      email: session.email,
      displayName: session.displayName,
      role: session.role,
    }),
  );
}

function clearSession() {
  sessionStorage.removeItem(ACCESS_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
  sessionStorage.removeItem(USER_KEY);
}

async function supabaseRequest<T>(
  path: string,
  init: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  const { url, key } = getSupabaseConfig();
  const response = await fetch(url + path, {
    ...init,
    headers: {
      apikey: key,
      ...(accessToken ? { Authorization: "Bearer " + accessToken } : {}),
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || "Pedido ao Supabase falhou.");
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function loginControlRoom(email: string, password: string) {
  const { url, key } = getSupabaseConfig();
  const response = await fetch(url + "/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: {
      apikey: key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const payload = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    user?: { id: string; email?: string };
    error_description?: string;
    msg?: string;
  };

  if (!response.ok || !payload.access_token || !payload.refresh_token || !payload.user) {
    throw new Error(payload.error_description ?? payload.msg ?? "Credenciais inválidas.");
  }

  const profile = await supabaseRequest<Array<{ display_name: string; role: ControlRoomRole; active: boolean }>>(
    "/rest/v1/admin_profiles?select=display_name,role,active&user_id=eq." +
      encodeURIComponent(payload.user.id),
    {},
    payload.access_token,
  );

  const admin = profile[0];
  if (!admin?.active) {
    throw new Error("Esta conta não tem acesso ao Control Room.");
  }

  const session: ControlRoomSession = {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    userId: payload.user.id,
    email: payload.user.email ?? email,
    displayName: admin.display_name,
    role: admin.role,
  };
  saveSession(session);
  return session;
}

export async function refreshControlRoom(): Promise<ControlRoomSession | null> {
  const refreshToken = sessionStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return null;

  try {
    const { url, key } = getSupabaseConfig();
    const response = await fetch(url + "/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      headers: {
        apikey: key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    const payload = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      user?: { id: string; email?: string };
    };

    if (!response.ok || !payload.access_token || !payload.refresh_token || !payload.user) {
      clearSession();
      return null;
    }

    const profile = await supabaseRequest<Array<{ display_name: string; role: ControlRoomRole; active: boolean }>>(
      "/rest/v1/admin_profiles?select=display_name,role,active&user_id=eq." +
        encodeURIComponent(payload.user.id),
      {},
      payload.access_token,
    );
    const admin = profile[0];
    if (!admin?.active) {
      clearSession();
      return null;
    }

    const session: ControlRoomSession = {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      userId: payload.user.id,
      email: payload.user.email ?? "",
      displayName: admin.display_name,
      role: admin.role,
    };
    saveSession(session);
    return session;
  } catch {
    clearSession();
    return null;
  }
}

export async function getControlRoomSession() {
  const accessToken = sessionStorage.getItem(ACCESS_KEY);
  const rawUser = sessionStorage.getItem(USER_KEY);
  if (!accessToken || !rawUser) return null;

  try {
    const user = JSON.parse(rawUser) as Omit<ControlRoomSession, "accessToken" | "refreshToken">;
    const profile = await supabaseRequest<Array<{ display_name: string; role: ControlRoomRole; active: boolean }>>(
      "/rest/v1/admin_profiles?select=display_name,role,active&user_id=eq." +
        encodeURIComponent(user.userId),
      {},
      accessToken,
    );
    const admin = profile[0];
    if (admin?.active) {
      return {
        accessToken,
        refreshToken: sessionStorage.getItem(REFRESH_KEY) ?? "",
        userId: user.userId,
        email: user.email,
        displayName: admin.display_name,
        role: admin.role,
      } satisfies ControlRoomSession;
    }
  } catch {
    // Refresh below.
  }

  return refreshControlRoom();
}

export function logoutControlRoom() {
  clearSession();
}

export async function adminQuery<T>(path: string, init: RequestInit = {}) {
  const session = await getControlRoomSession();
  if (!session) throw new Error("Sessão do Control Room expirada.");
  return supabaseRequest<T>(path, init, session.accessToken);
}

export async function publicQuery<T>(path: string) {
  return supabaseRequest<T>(path);
}
