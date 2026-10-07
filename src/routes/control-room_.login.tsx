import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import logo from "@/assets/brand/sindicato-logo.png.asset.json";

export const Route = createFileRoute("/control-room/login")({
  component: ControlRoomLogin,
});

function ControlRoomLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    navigate({ to: "/control-room", replace: true });
  };

  return (
    <main className="min-h-screen bg-[#090909] px-4 py-10 text-[#efefef]">
      <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center">
        <div className="border border-white/10 bg-[#0d0d0d] p-6 md:p-8">
          <img src={logo.url} alt="O Sindicato do Trap" className="mb-8 h-16 w-auto" />
          <p className="font-mono text-[10px] tracking-[0.28em] text-[#d71920]">ACESSO DIRECTO</p>
          <h1 className="mt-2 font-gothic text-5xl">CONTROL ROOM</h1>
          <p className="mt-3 font-mono text-xs leading-6 text-white/45">
            O painel abre directamente. Os campos abaixo permanecem disponíveis para o Auth real, mas não bloqueiam a entrada.
          </p>

          <form onSubmit={submit} className="mt-8 grid gap-4">
            <label className="grid gap-2 font-mono text-[10px] tracking-[0.15em] text-white/45">
              EMAIL
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="opcional"
                className="min-h-12 border border-white/10 bg-[#090909] px-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-[#d71920]"
              />
            </label>
            <label className="grid gap-2 font-mono text-[10px] tracking-[0.15em] text-white/45">
              PASSWORD
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="opcional"
                className="min-h-12 border border-white/10 bg-[#090909] px-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-[#d71920]"
              />
            </label>
            <button
              type="submit"
              className="mt-2 min-h-12 border border-[#d71920] bg-[#d71920] px-4 font-mono text-xs tracking-[0.18em] text-white transition-opacity disabled:cursor-wait disabled:opacity-60"
            >
              ENTRAR
            </button>
          </form>
        </div>
        <p className="mt-5 font-mono text-[9px] tracking-[0.16em] text-white/25">SINDICATO CONTROL ROOM // DIRECT ACCESS</p>
      </div>
    </main>
  );
}
