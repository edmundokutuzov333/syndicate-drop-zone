import { useEffect, useMemo, useState } from "react";
import { Check, Eye, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import {
  adminQuery,
  getControlRoomSession,
  isPublicPreviewSession,
  type ControlRoomRole,
} from "@/lib/control-room-auth";

type Row = Record<string, unknown>;

const PROTECTED = new Set(["id", "created_at", "updated_at"]);
const EDIT_ROLES: ControlRoomRole[] = ["OWNER", "ADMIN", "EDITOR"];

const DISPLAY_GROUPS = {
  site: {
    title: "SITE",
    eyebrow: "09 · SITE SETTINGS",
    description: "Controlo editorial da homepage e das secções estruturais. O editor só escreve campos que existem no Supabase.",
    tables: ["site_settings", "site_sections"],
  },
  seo: {
    title: "SEO & SOCIAL",
    eyebrow: "11 · METADATA",
    description: "Metadata, OG image e referências sociais sem page builder genérico.",
    tables: ["site_settings"],
  },
  drop: {
    title: "DROP",
    eyebrow: "10 · DROP CAMPAIGN",
    description: "Campanhas, countdown e estados operacionais. O preview é local e não publica nada.",
    tables: ["drop_campaigns"],
  },
} as const;

function label(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).toUpperCase();
}
function editable(role: ControlRoomRole | null) {
  return Boolean(role && EDIT_ROLES.includes(role));
}
function titleOf(row: Row) {
  return String(row.title ?? row.name ?? row.label ?? row.key ?? row.slug ?? row.code ?? row.id ?? "REGISTO");
}
function textOf(row: Row, keys: string[]) {
  for (const key of keys) if (row[key] !== undefined && row[key] !== null && row[key] !== "") return String(row[key]);
  return "";
}
function isLong(key: string, value: unknown) {
  return typeof value === "string" && (value.length > 120 || /bio|description|content|body|text|message|subtitle/i.test(key));
}
function patchFor(row: Row) {
  return Object.fromEntries(Object.entries(row).filter(([key]) => !PROTECTED.has(key)));
}

export function EditorialManager({ mode }: { mode: keyof typeof DISPLAY_GROUPS }) {
  const cfg = DISPLAY_GROUPS[mode];
  const [role, setRole] = useState<ControlRoomRole | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [rowsByTable, setRowsByTable] = useState<Record<string, Row[]>>({});
  const [table, setTable] = useState(cfg.tables[0]);
  const [selected, setSelected] = useState<Row | null>(null);
  const [form, setForm] = useState<Row>({});
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState("");

  const canEdit = !previewMode && editable(role);
  const rows = rowsByTable[table] ?? [];

  const load = async () => {
    setBusy(true);
    setNotice("");
    try {
      const [session, ...sets] = await Promise.all([
        getControlRoomSession(),
        ...cfg.tables.map((name) => adminQuery<Row[]>("/rest/v1/" + name + "?select=*&limit=1000")),
      ]);
      setRole(session?.role ?? null);
      setPreviewMode(isPublicPreviewSession(session));
      const next = Object.fromEntries(cfg.tables.map((name, index) => [name, sets[index]]));
      setRowsByTable(next);
      setSelected((current) => {
        const fresh = next[table] ?? [];
        return current ? fresh.find((row) => String(row.id) === String(current.id)) ?? fresh[0] ?? null : fresh[0] ?? null;
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível carregar o módulo.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void load(); }, [table]);

  useEffect(() => {
    setForm(selected ? JSON.parse(JSON.stringify(selected)) : {});
    setPreview(false);
  }, [selected?.id]);

  const fields = useMemo(() => Object.keys(form), [form]);
  const hasChanges = JSON.stringify(form) !== JSON.stringify(selected ?? {});

  const setField = (key: string, value: unknown) => setForm((current) => ({ ...current, [key]: value }));

  const save = async (status?: string) => {
    if (!canEdit || !selected) return;
    setNotice("A GUARDAR...");
    try {
      const next = { ...form, ...(status ? { status } : {}) };
      const clean = patchFor(next);
      if (!selected.id) {
        await adminQuery("/rest/v1/" + table, {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify(clean),
        });
      } else {
        await adminQuery("/rest/v1/" + table + "?id=eq." + encodeURIComponent(String(selected.id)), {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify(clean),
        });
      }
      setNotice(status === "published" ? "PUBLICADO" : status === "draft" ? "RASCUNHO GUARDADO" : "ALTERAÇÕES GUARDADAS");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível guardar.");
    }
  };

  const create = () => {
    if (!canEdit) return;
    const template = rows[0]
      ? Object.fromEntries(Object.entries(rows[0]).filter(([key]) => !PROTECTED.has(key)).map(([key, value]) => [key, typeof value === "boolean" ? false : Array.isArray(value) ? [] : ""]))
      : {};
    setSelected(template);
    setForm(template);
    setNotice("NOVO REGISTO. PREENCHA OS CAMPOS OBRIGATÓRIOS.");
  };

  const remove = async () => {
    if (!canEdit || !selected?.id) return;
    if (!window.confirm("Eliminar este registo? Esta acção é permanente.")) return;
    try {
      await adminQuery("/rest/v1/" + table + "?id=eq." + encodeURIComponent(String(selected.id)), {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      });
      setSelected(null);
      setNotice("REGISTO ELIMINADO");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível eliminar.");
    }
  };

  useEffect(() => {
    if (!hasChanges || !canEdit) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [hasChanges, canEdit]);

  const previewTitle = textOf(form, ["hero_title", "title", "name", "label", "key"]);
  const previewSubtitle = textOf(form, ["hero_subtitle", "subtitle", "description", "meta_description"]);
  const date = textOf(form, ["drop_at", "release_at", "launch_at", "starts_at", "date"]);

  return <div>
    <header className="border-b border-white/10 pb-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-[10px] tracking-[0.28em] text-[#d71920]">{cfg.eyebrow}</p>
          <h1 className="mt-2 font-gothic text-6xl leading-none md:text-8xl">{cfg.title}</h1>
          <p className="mt-3 max-w-3xl font-mono text-xs leading-6 text-white/45">{cfg.description}</p>
        </div>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 border border-white/10 px-3 py-2 font-mono text-[9px] text-white/50 hover:border-white/30 hover:text-white"><RefreshCw size={13} className={busy ? "animate-spin" : ""} /> ACTUALIZAR</button>
      </div>
    </header>

    {notice && <div className="mt-5 border border-white/10 bg-[#0d0d0d] px-4 py-3 font-mono text-[10px] tracking-[0.12em] text-[#d71920]">{notice}</div>}

    <div className="mt-6 flex flex-wrap gap-2">
      {cfg.tables.map((name) => <button key={name} type="button" onClick={() => setTable(name)} className={"border px-3 py-2 font-mono text-[9px] tracking-[0.14em] " + (table === name ? "border-[#d71920] bg-[#d71920]/10 text-white" : "border-white/10 text-white/35 hover:text-white")}>{name.toUpperCase()}</button>)}
      {canEdit && <button type="button" onClick={create} className="inline-flex items-center gap-2 border border-white/10 px-3 py-2 font-mono text-[9px] tracking-[0.14em] text-white/45 hover:border-[#d71920] hover:text-white"><Plus size={13} /> NOVO</button>}
    </div>

    <div className="mt-6 grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
      <section className="border border-white/10 bg-[#0d0d0d]">
        <div className="border-b border-white/10 p-4"><p className="font-mono text-[9px] tracking-[0.18em] text-white/30">{rows.length} REGISTOS</p></div>
        <div className="divide-y divide-white/10">
          {rows.map((row) => <button key={String(row.id)} type="button" onClick={() => setSelected(row)} className={"w-full border-l-2 p-4 text-left " + (String(selected?.id) === String(row.id) ? "border-[#d71920] bg-[#d71920]/5" : "border-transparent hover:bg-white/[0.02]")}>
            <p className="font-gothic text-2xl">{titleOf(row)}</p>
            <p className="mt-1 font-mono text-[9px] text-white/30">{String(row.status ?? row.type ?? row.key ?? row.id ?? "")}</p>
          </button>)}
          {!rows.length && <div className="p-8 font-mono text-xs text-white/35">SEM REGISTOS.</div>}
        </div>
      </section>

      <section className="border border-white/10 bg-[#0d0d0d]">
        <div className="flex flex-col gap-3 border-b border-white/10 p-5 md:flex-row md:items-end md:justify-between">
          <div><p className="font-mono text-[9px] tracking-[0.22em] text-[#d71920]">{table.toUpperCase()}</p><h2 className="mt-1 font-gothic text-4xl">{titleOf(form)}</h2></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!selected} onClick={() => setPreview((value) => !value)} className="inline-flex items-center gap-2 border border-white/10 px-3 py-2 font-mono text-[9px] text-white/50 disabled:opacity-30"><Eye size={13} /> {preview ? "EDITOR" : "PRÉ-VISUALIZAR"}</button>
            {canEdit && selected?.id && (
              <>
                {typeof form.status === "string" && <button type="button" onClick={() => void save("draft")} className="border border-white/10 px-3 py-2 font-mono text-[9px] text-white/50">GUARDAR RASCUNHO</button>}
                {typeof form.status === "string" && <button type="button" onClick={() => void save("published")} className="border border-[#d71920] bg-[#d71920] px-3 py-2 font-mono text-[9px] text-white">PUBLICAR</button>}
                <button type="button" onClick={() => void remove()} className="border border-white/10 px-3 py-2 font-mono text-[9px] text-white/35 hover:border-[#d71920] hover:text-[#d71920]"><Trash2 size={13} /></button>
              </>
            )}
          </div>
        </div>

        {preview ? <div className="grid gap-6 p-6">
          <div className="border border-white/10 bg-[#090909] p-6">
            <p className="font-mono text-[9px] tracking-[0.22em] text-[#d71920]">PREVIEW LOCAL</p>
            <h3 className="mt-2 font-gothic text-5xl leading-none">{previewTitle || "SEM TÍTULO"}</h3>
            {previewSubtitle && <p className="mt-4 max-w-2xl text-sm leading-7 text-white/60">{previewSubtitle}</p>}
            {date && <p className="mt-6 font-mono text-[10px] text-white/35">DATA: {date}</p>}
          </div>
          <div className="border border-white/10 p-4 font-mono text-[9px] leading-6 text-white/40">O preview não escreve na produção. Volte ao editor para guardar ou publicar.</div>
        </div> : selected ? <div className="grid gap-5 p-5">
          {fields.map((field) => {
            const value = form[field];
            const protectedField = PROTECTED.has(field) || field === "user_id";
            if (field === "status") return <label key={field} className="grid gap-2 font-mono text-[9px] tracking-[0.16em] text-white/35">{label(field)}<select value={String(value ?? "")} disabled={!canEdit || protectedField} onChange={(event) => setField(field, event.target.value)} className="min-h-11 border border-white/10 bg-[#090909] px-3 text-sm text-white outline-none focus:border-[#d71920]"><option value="">SEM ESTADO</option>{["draft","ready","published","active","inactive","scheduled","live","ended","archived"].map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}</select></label>;
            if (typeof value === "boolean") return <label key={field} className="flex items-center gap-3 border border-white/10 p-4 font-mono text-[10px] text-white/55"><input type="checkbox" checked={value} disabled={!canEdit || protectedField} onChange={(event) => setField(field, event.target.checked)} /> {label(field)}</label>;
            if (typeof value === "number") return <label key={field} className="grid gap-2 font-mono text-[9px] tracking-[0.16em] text-white/35">{label(field)}<input type="number" value={String(value)} disabled={!canEdit || protectedField} onChange={(event) => setField(field, Number(event.target.value))} className="min-h-11 border border-white/10 bg-[#090909] px-3 text-sm text-white outline-none focus:border-[#d71920]" /></label>;
            return <label key={field} className="grid gap-2 font-mono text-[9px] tracking-[0.16em] text-white/35">{label(field)}{isLong(field, value) ? <textarea value={value == null ? "" : String(value)} disabled={!canEdit || protectedField} onChange={(event) => setField(field, event.target.value)} rows={6} className="resize-y border border-white/10 bg-[#090909] px-3 py-3 text-sm leading-6 text-white outline-none focus:border-[#d71920]" /> : <input value={value == null ? "" : String(value)} disabled={!canEdit || protectedField} onChange={(event) => setField(field, event.target.value)} className="min-h-11 border border-white/10 bg-[#090909] px-3 text-sm text-white outline-none focus:border-[#d71920]" />}</label>;
          })}
          {canEdit && <div className="flex items-center justify-between border-t border-white/10 pt-4"><span className="font-mono text-[9px] text-white/30">{hasChanges ? "NÃO GUARDADO" : "SINCRONIZADO"}</span><button type="button" onClick={() => void save()} className="inline-flex items-center gap-2 border border-[#d71920] bg-[#d71920] px-4 py-3 font-mono text-[10px] tracking-[0.16em] text-white"><Save size={14} /> GUARDAR ALTERAÇÕES</button></div>}
        </div> : <div className="grid min-h-64 place-items-center font-mono text-xs text-white/25">SELECT REGISTO</div>}
      </section>
    </div>
  </div>;
}
