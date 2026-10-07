import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import logo from "@/assets/brand/sindicato-logo.png.asset.json";
import { loginControlRoom } from "@/lib/control-room-auth";

export const Route = createFileRoute("/control-room/login")({
  component: ControlRoomLogin,
});

function ControlRoomLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSending(true);
    setError("");
    try {
      await loginControlRoom(email.trim(), password);
      navigate({ to: "/control-room", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível iniciar sessão.");
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#090909] px-4 py-10 text-[#efefef]">
      <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center">
        <div className="border border-white/10 bg-[#0d0d0d] p-6 md:p-8">
          <img src={logo.url} alt="O Sindicato do Trap" className="mb-8 h-16 w-auto" />
          <p className="font-mono text-[10px] tracking-[0.28em] text-[#d71920]">ACESSO RESTRITO</p>
          <h1 className="mt-2 font-gothic text-5xl">CONTROL ROOM</h1>
          <p className="mt-3 font-mono text-xs leading-6 text-white/45">
            Autenticação real via Supabase. A conta também precisa de um perfil em <code>admin_profiles</code>.
          </p>

          <form onSubmit={submit} className="mt-8 grid gap-4">
            <label className="grid gap-2 font-mono text-[10px] tracking-[0.15em] text-white/45">
              EMAIL
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-h-12 border border-white/10 bg-[#090909] px-3 text-sm text-white outline-none focus:border-[#d71920]"
              />
            </label>
            <label className="grid gap-2 font-mono text-[10px] tracking-[0.15em] text-white/45">
              PASSWORD
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="min-h-12 border border-white/10 bg-[#090909] px-3 text-sm text-white outline-none focus:border-[#d71920]"
              />
            </label>
            {error && <div className="border border-[#d71920]/50 bg-[#d71920]/5 p-3 font-mono text-xs text-white/70">{error}</div>}
            <button
              type="submit"
              disabled={sending}
              className="mt-2 min-h-12 border border-[#d71920] bg-[#d71920] px-4 font-mono text-xs tracking-[0.18em] text-white transition-opacity disabled:cursor-wait disabled:opacity-60"
            >
              {sending ? "AUTHENTICATING..." : "ENTRAR"}
            </button>
          </form>
        </div>
        <p className="mt-5 font-mono text-[9px] tracking-[0.16em] text-white/25">SINDICATO CONTROL ROOM // AUTH</p>
      </div>
    </main>
  );
}
