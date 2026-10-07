import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Activity,
  Archive,
  ArrowUpRight,
  BarChart3,
  Boxes,
  FileImage,
  Gauge,
  GitBranch,
  Image,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Package,
  Radio,
  Search,
  Settings,
  Shield,
  Store,
  Ticket,
  Users,
  Video,
} from "lucide-react";
import { getControlRoomSession, logoutControlRoom, type ControlRoomSession } from "@/lib/control-room-auth";

const GROUPS = [
  {
    title: "OPERAÇÃO",
    items: [
      ["01", "OVERVIEW", "/control-room"],
      ["02", "ARTISTAS", "/control-room/artistas"],
      ["03", "MÚSICA", "/control-room/musica"],
      ["04", "CAMPING", "/control-room/camping"],
      ["05", "REVELAÇÃO", "/control-room/revelacao"],
      ["06", "MEDIA", "/control-room/media"],
      ["07", "MERCH", "/control-room/merch"],
      ["08", "PARCERIAS", "/control-room/parcerias"],
    ],
  },
  {
    title: "PLATAFORMA",
    items: [
      ["09", "SITE", "/control-room/site"],
      ["10", "DROP", "/control-room/drop"],
      ["11", "SEO & SOCIAL", "/control-room/seo"],
      ["12", "UTILIZADORES", "/control-room/utilizadores"],
      ["13", "ACTIVIDADE", "/control-room/actividade"],
      ["14", "SISTEMA", "/control-room/sistema"],
    ],
  },
] as const;

export function ControlRoomShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState<ControlRoomSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getControlRoomSession()
      .then(setSession)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: "/control-room/login", replace: true });
    }
  }, [loading, session, navigate]);

  if (loading) {
    return <div className="min-h-screen bg-[#090909] p-8 font-mono text-xs text-white">CONTROL ROOM // AUTHENTICATING...</div>;
  }

  if (!session) return null;

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
          <div className="flex items-center gap-4 font-mono text-[10px]">
            <span className="hidden text-white/50 sm:inline">{session.displayName} · {session.role}</span>
            <span className="text-[#d71920]">● ONLINE</span>
            <button
              type="button"
              onClick={() => {
                logoutControlRoom();
                navigate({ to: "/control-room/login", replace: true });
              }}
              className="border border-white/10 px-2 py-1 text-white/60 hover:border-[#d71920] hover:text-white"
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-61px)] lg:grid-cols-[240px_minmax(0,1fr)]">
        <div className="border-b border-white/10 bg-[#0d0d0d] p-3 lg:hidden">
          <div className="flex gap-2 overflow-x-auto">
            {GROUPS.flatMap((group) => group.items).map(([code, label, to]) => (
              <Link
                key={to}
                to={to}
                className={`shrink-0 border px-3 py-2 font-mono text-[9px] tracking-[0.12em] ${location.pathname === to ? "border-[#d71920] text-white" : "border-white/10 text-white/40"}`}
              >
                {code} {label}
              </Link>
            ))}
          </div>
        </div>

        <aside className="hidden border-r border-white/10 bg-[#0d0d0d] lg:block">
          <div className="sticky top-[61px] max-h-[calc(100vh-61px)] overflow-y-auto p-3">
            {GROUPS.map((group) => (
              <div key={group.title} className="mb-6">
                <p className="px-3 pb-2 font-mono text-[9px] tracking-[0.24em] text-white/30">{group.title}</p>
                <nav className="grid gap-1">
                  {group.items.map(([code, label, to]) => {
                    const active = location.pathname === to;
                    return (
                      <Link
                        key={to}
                        to={to}
                        className={`group flex items-center justify-between border px-3 py-2 font-mono text-[10px] tracking-[0.13em] transition ${active ? "border-[#d71920] bg-[#d71920]/10 text-white" : "border-transparent text-white/45 hover:border-white/10 hover:text-white"}`}
                      >
                        <span><span className={active ? "text-[#d71920]" : "text-white/20"}>{code}</span> {label}</span>
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
    </div>
  );
}
