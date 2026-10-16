import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, LogOut, Search } from "lucide-react";
import { getControlRoomSession, logoutControlRoom, type ControlRoomRole, type ControlRoomSession } from "@/lib/control-room-auth";

type NavItem = {
  code: string;
  label: string;
  to: string;
  roles: ControlRoomRole[];
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const ALL_ROLES: ControlRoomRole[] = ["OWNER", "ADMIN", "EDITOR", "PARTNERSHIPS", "MERCH"];

const PUBLIC_PREVIEW_SESSION: ControlRoomSession = {
  accessToken: "",
  refreshToken: "",
  userId: "public-preview",
  email: "",
  displayName: "ACESSO DIRECTO",
  role: "OWNER",
};

const GROUPS: NavGroup[] = [
  {
    title: "OPERAÇÃO",
    items: [
      { code: "01", label: "OVERVIEW", to: "/control-room", roles: ALL_ROLES },
      { code: "02", label: "ARTISTAS", to: "/control-room/artistas", roles: ["OWNER", "ADMIN", "EDITOR"] },
      { code: "03", label: "MÚSICA", to: "/control-room/musica", roles: ["OWNER", "ADMIN", "EDITOR"] },
      { code: "04", label: "CAMPING", to: "/control-room/camping", roles: ["OWNER", "ADMIN", "EDITOR"] },
      { code: "05", label: "REVELAÇÃO", to: "/control-room/revelacao", roles: ["OWNER", "ADMIN", "EDITOR"] },
      { code: "06", label: "MEDIA", to: "/control-room/media", roles: ["OWNER", "ADMIN", "EDITOR"] },
      { code: "07", label: "MERCH", to: "/control-room/merch", roles: ["OWNER", "ADMIN", "MERCH"] },
      { code: "08", label: "PARCERIAS", to: "/control-room/parcerias", roles: ["OWNER", "ADMIN", "PARTNERSHIPS"] },
      { code: "09", label: "SINDICALIZADOS", to: "/control-room/sindicalizados", roles: ["OWNER", "ADMIN", "EDITOR"] },
    ],
  },
  {
    title: "PLATAFORMA",
    items: [
      { code: "10", label: "SITE", to: "/control-room/site", roles: ["OWNER", "ADMIN", "EDITOR"] },
      { code: "11", label: "DROP", to: "/control-room/drop", roles: ["OWNER", "ADMIN", "EDITOR"] },
      { code: "12", label: "SEO & SOCIAL", to: "/control-room/seo", roles: ["OWNER", "ADMIN", "EDITOR"] },
      { code: "13", label: "UTILIZADORES", to: "/control-room/utilizadores", roles: ["OWNER", "ADMIN"] },
      { code: "14", label: "ACTIVIDADE", to: "/control-room/actividade", roles: ["OWNER", "ADMIN", "EDITOR"] },
      { code: "15", label: "SISTEMA", to: "/control-room/sistema", roles: ["OWNER", "ADMIN"] },
      { code: "16", label: "RADIO", to: "/control-room/radio", roles: ["OWNER", "ADMIN", "EDITOR"] },
    ],
  },
];

function canAccess(item: NavItem, role: ControlRoomRole) {
  return item.roles.includes(role);
}

export function ControlRoomShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState<ControlRoomSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");

  useEffect(() => {
    getControlRoomSession()
      .then((authenticatedSession) => setSession(authenticatedSession ?? PUBLIC_PREVIEW_SESSION))
      .finally(() => setLoading(false));
  }, []);

  const visibleGroups = useMemo(() => {
    if (!session) return GROUPS;
    return GROUPS
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => canAccess(item, session.role)),
      }))
      .filter((group) => group.items.length > 0);
  }, [session]);

  const visibleItems = useMemo(() => visibleGroups.flatMap((group) => group.items), [visibleGroups]);

  const paletteItems = useMemo(() => {
    const needle = paletteQuery.trim().toLowerCase();
    if (!needle) return visibleItems;
    return visibleItems.filter((item) => (item.code + " " + item.label + " " + item.to).toLowerCase().includes(needle));
  }, [paletteQuery, visibleItems]);

  useEffect(() => {
    if (!session) return;
    const current = visibleItems.find((item) => item.to === location.pathname);
    if (!current && location.pathname.startsWith("/control-room") && location.pathname !== "/control-room/login") {
      navigate({ to: "/control-room", replace: true });
    }
  }, [location.pathname, navigate, session, visibleItems]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
      if (event.key === "Escape") {
        setPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (paletteOpen) {
      setPaletteQuery("");
    }
  }, [paletteOpen]);

  if (loading) {
    return <div className="min-h-screen bg-[#090909] p-8 font-mono text-xs text-white">CONTROL ROOM // LOADING...</div>;
  }

  if (!session) return null;

  const go = (to: string) => {
    setPaletteOpen(false);
    navigate({ to: to as never });
  };

  return (
    <div className="min-h-screen bg-[#090909] text-[#efefef]">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#090909]/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center border border-[#d71920] font-mono text-xs text-[#d71920]">SD</div>
            <div>
              <p className="font-mono text-[10px] tracking-[0.28em] text-[#d71920]">CONTROL ROOM</p>
              <p className="font-gothic text-2xl leading-none">SINDICATO</p>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-[10px]">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden items-center gap-2 border border-white/10 px-2 py-1.5 text-white/45 hover:border-white/30 hover:text-white sm:flex"
              title="Abrir Command Palette"
            >
              <Search size={12} />
              <span>COMMAND</span>
              <kbd className="border border-white/10 px-1 text-[8px]">⌘K</kbd>
            </button>
            <span className="hidden text-white/50 lg:inline">{session.userId === "public-preview" ? "ACESSO DIRECTO · PREVIEW" : `${session.displayName} · ${session.role}`}</span>
            <span className="text-[#d71920]">● ONLINE</span>
            <button
              type="button"
              onClick={() => {
                logoutControlRoom();
                navigate({ to: "/control-room/login", replace: true });
              }}
              className="border border-white/10 px-2 py-1 text-white/60 hover:border-[#d71920] hover:text-white"
              aria-label="Terminar sessão"
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-61px)] lg:grid-cols-[240px_minmax(0,1fr)]">
        <div className="border-b border-white/10 bg-[#0d0d0d] p-3 lg:hidden">
          <div className="mb-3 flex items-center justify-between border border-white/10 px-3 py-2">
            <span className="font-mono text-[9px] tracking-[0.14em] text-white/35">MÓDULOS DISPONÍVEIS</span>
            <button type="button" onClick={() => setPaletteOpen(true)} className="text-white/45 hover:text-white" aria-label="Pesquisar módulo">
              <Search size={13} />
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {visibleItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`shrink-0 border px-3 py-2 font-mono text-[9px] tracking-[0.12em] ${location.pathname === item.to ? "border-[#d71920] text-white" : "border-white/10 text-white/40"}`}
              >
                {item.code} {item.label}
              </Link>
            ))}
          </div>
        </div>

        <aside className="hidden border-r border-white/10 bg-[#0d0d0d] lg:block">
          <div className="sticky top-[61px] max-h-[calc(100vh-61px)] overflow-y-auto p-3">
            {visibleGroups.map((group) => (
              <div key={group.title} className="mb-6">
                <p className="px-3 pb-2 font-mono text-[9px] tracking-[0.24em] text-white/30">{group.title}</p>
                <nav className="grid gap-1">
                  {group.items.map((item) => {
                    const active = location.pathname === item.to;
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        className={`group flex items-center justify-between border px-3 py-2 font-mono text-[10px] tracking-[0.13em] transition ${active ? "border-[#d71920] bg-[#d71920]/10 text-white" : "border-transparent text-white/45 hover:border-white/10 hover:text-white"}`}
                      >
                        <span><span className={active ? "text-[#d71920]" : "text-white/20"}>{item.code}</span> {item.label}</span>
                        {active && <ArrowUpRight size={12} className="text-[#d71920]" />}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            ))}
          </div>
        </aside>

        <main className="min-w-0 p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      <div className="border-t border-white/10 px-4 py-3 font-mono text-[9px] tracking-[0.18em] text-white/25 md:px-6">
        SINDICATO CONTROL ROOM · {location.pathname}
      </div>

      {paletteOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/70 p-4 pt-[10vh] backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Navegação do Control Room"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setPaletteOpen(false);
          }}
        >
          <div className="w-full max-w-2xl border border-white/10 bg-[#0d0d0d] shadow-2xl">
            <div className="flex items-center gap-3 border-b border-white/10 px-4">
              <Search size={15} className="text-[#d71920]" />
              <input
                autoFocus
                value={paletteQuery}
                onChange={(event) => setPaletteQuery(event.target.value)}
                placeholder="PESQUISAR MÓDULO..."
                className="h-14 flex-1 bg-transparent font-mono text-xs text-white outline-none"
              />
              <kbd className="border border-white/10 px-2 py-1 font-mono text-[8px] text-white/30">ESC</kbd>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {visibleGroups.map((group) => {
                const items = group.items.filter((item) => paletteItems.includes(item));
                if (!items.length) return null;
                return (
                  <div key={group.title} className="mb-3">
                    <p className="px-3 py-2 font-mono text-[8px] tracking-[0.22em] text-white/25">{group.title}</p>
                    <div className="grid gap-1">
                      {items.map((item) => (
                        <button
                          key={item.to}
                          type="button"
                          onClick={() => go(item.to)}
                          className="flex items-center justify-between border border-transparent px-3 py-3 text-left hover:border-white/10 hover:bg-white/[0.02]"
                        >
                          <span className="font-mono text-[10px] tracking-[0.12em] text-white/70">
                            <span className="mr-2 text-[#d71920]">{item.code}</span>{item.label}
                          </span>
                          <span className="font-mono text-[9px] text-white/20">{item.to}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              {!paletteItems.length && (
                <div className="p-8 text-center font-mono text-[10px] text-white/30">NENHUM MÓDULO ENCONTRADO.</div>
              )}
            </div>
            <div className="border-t border-white/10 px-4 py-2 font-mono text-[8px] tracking-[0.16em] text-white/20">
              COMMAND PALETTE · ACESSO DIRECTO / PREVIEW
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
