import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Clipboard, FileVideo, Image as ImageIcon, RefreshCw, Trash2, Upload } from "lucide-react";
import {
  adminQuery,
  checkStorageBucket,
  getControlRoomSession,
  getMediaBucket,
  getTableProperties,
  storageDelete,
  storageUpload,
  type ControlRoomRole,
} from "@/lib/control-room-auth";

type MediaRow = Record<string, unknown>;

const value = (row: MediaRow, keys: string[]) => {
  for (const key of keys) if (row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key];
  return undefined;
};
const text = (row: MediaRow, keys: string[], fallback = "") => {
  const raw = value(row, keys);
  return raw === undefined ? fallback : String(raw);
};
const size = (row: MediaRow) => {
  const parsed = Number(value(row, ["size_bytes", "file_size", "size"]));
  return Number.isFinite(parsed) ? parsed : 0;
};
const urlOf = (row: MediaRow) => text(row, ["public_url", "url", "file_url", "asset_url", "media_url", "src"]);
const pathOf = (row: MediaRow) => text(row, ["storage_path", "path", "object_path", "file_path"]);
const kindOf = (row: MediaRow) => {
  const type = text(row, ["mime_type", "media_type", "type", "kind"]).toLowerCase();
  return type.includes("video") ? "video" : "image";
};
const canEdit = (role: ControlRoomRole | null) => role === "OWNER" || role === "ADMIN" || role === "EDITOR";

export function MediaManager() {
  const [rows, setRows] = useState<MediaRow[]>([]);
  const [selected, setSelected] = useState<MediaRow | null>(null);
  const [role, setRole] = useState<ControlRoomRole | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "image" | "video">("all");
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [alt, setAlt] = useState("");
  const [context, setContext] = useState("site");
  const [tags, setTags] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(true);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const bucket = getMediaBucket();

  const load = async () => {
    setBusy(true);
    try {
      const [session, data] = await Promise.all([
        getControlRoomSession(),
        adminQuery<MediaRow[]>("/rest/v1/media_assets?select=*&order=created_at.desc&limit=1000"),
      ]);
      setRole(session?.role ?? null);
      setRows(data);
      setSelected((current) => current ? data.find((item) => String(item.id) === String(current.id)) ?? null : data[0] ?? null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível carregar a biblioteca.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter !== "all" && kindOf(row) !== filter) return false;
      return !needle || Object.entries(row).some(([key, raw]) =>
        raw !== null && raw !== undefined && (key + " " + String(raw)).toLowerCase().includes(needle),
      );
    });
  }, [rows, query, filter]);

  const choose = (picked: File | null) => {
    setFile(picked);
    if (picked) {
      if (!name) setName(picked.name.replace(/\.[^/.]+$/, ""));
      if (!alt) setAlt(picked.name.replace(/\.[^/.]+$/, ""));
    }
  };

  const upload = async () => {
    if (!file || !canEdit(role)) return;
    setUploading(true);
    setNotice("A VERIFICAR STORAGE...");
    let uploadedPath = "";
    try {
      const storage = await checkStorageBucket(bucket);
      if (!storage.ok) throw new Error(storage.error || "Bucket de media indisponível.");
      if (!storage.public) throw new Error("O bucket de media precisa de ser público para o Content API servir os ficheiros directamente.");

      const safeName = (file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "asset").toLowerCase();
      const date = new Date();
      const folder = date.getUTCFullYear() + "/" + String(date.getUTCMonth() + 1).padStart(2, "0");
      const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());
      uploadedPath = "media/" + folder + "/" + id + "-" + safeName;

      setNotice("A ENVIAR...");
      const stored = await storageUpload(bucket, uploadedPath, file, file.type || "application/octet-stream");
      const properties = await getTableProperties("media_assets");
      const tagList = tags.split(",").map((item) => item.trim()).filter(Boolean);
      const candidates: Record<string, unknown> = {
        name: name || file.name, title: name || file.name, filename: file.name, file_name: file.name,
        original_name: file.name, mime_type: file.type || null, media_type: file.type || null,
        type: file.type || (file.type.startsWith("video/") ? "video" : "image"),
        size_bytes: file.size, file_size: file.size, size: file.size,
        storage_path: uploadedPath, path: uploadedPath, object_path: uploadedPath, file_path: uploadedPath,
        bucket, bucket_id: bucket, public_url: stored.publicUrl, url: stored.publicUrl,
        file_url: stored.publicUrl, asset_url: stored.publicUrl, media_url: stored.publicUrl,
        alt, alt_text: alt, caption: alt, context, collection: context, tags: tagList,
        status: "published", metadata: { context, tags: tagList, original_name: file.name, mime_type: file.type || null },
      };
      const payload: Record<string, unknown> = {};
      for (const [key, candidate] of Object.entries(candidates)) if (properties[key] && candidate !== undefined) payload[key] = candidate;
      if (!Object.keys(payload).length) throw new Error("A tabela media_assets não expõe campos compatíveis.");

      setNotice("A REGISTAR ASSET...");
      await adminQuery("/rest/v1/media_assets", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(payload),
      });

      setFile(null); setName(""); setAlt(""); setTags("");
      setNotice("MEDIA PUBLICADA");
      await load();
    } catch (error) {
      if (uploadedPath) {
        try { await storageDelete(bucket, uploadedPath); } catch { /* manter erro principal */ }
      }
      setNotice(error instanceof Error ? error.message : "Upload falhou.");
    } finally {
      setUploading(false);
    }
  };

  const remove = async () => {
    if (!selected?.id || !canEdit(role)) return;
    const label = text(selected, ["name", "title", "filename", "file_name"], "este asset");
    if (!window.confirm("Eliminar " + label + "? Esta acção remove o registo e tenta remover o ficheiro do storage.")) return;
    setNotice("A ELIMINAR...");
    try {
      await adminQuery("/rest/v1/media_assets?id=eq." + encodeURIComponent(String(selected.id)), {
        method: "DELETE", headers: { Prefer: "return=minimal" },
      });
      const path = pathOf(selected);
      if (path) {
        try { await storageDelete(bucket, path); }
        catch { setNotice("REGISTO ELIMINADO. O ficheiro ficou no storage e requer limpeza manual."); await load(); return; }
      }
      setSelected(null);
      setNotice("MEDIA ELIMINADA");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível eliminar.");
    }
  };

  const saveMeta = async () => {
    if (!selected?.id || !canEdit(role)) return;
    try {
      const properties = await getTableProperties("media_assets");
      const updates: Record<string, unknown> = {};
      const set = (key: string, data: unknown) => { if (properties[key]) updates[key] = data; };
      const tagList = tags.split(",").map((item) => item.trim()).filter(Boolean);
      set("name", name); set("title", name); set("alt", alt); set("alt_text", alt); set("caption", alt);
      set("context", context); set("collection", context); set("tags", tagList);
      if (properties.metadata) updates.metadata = { ...(typeof selected.metadata === "object" && selected.metadata ? selected.metadata : {}), context, tags: tagList };
      if (!Object.keys(updates).length) throw new Error("A tabela media_assets não tem campos editáveis compatíveis.");
      await adminQuery("/rest/v1/media_assets?id=eq." + encodeURIComponent(String(selected.id)), {
        method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(updates),
      });
      setNotice("METADADOS GUARDADOS");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível guardar.");
    }
  };

  useEffect(() => {
    if (!selected) { setName(""); setAlt(""); setContext("site"); setTags(""); return; }
    setName(text(selected, ["name", "title", "filename", "file_name"]));
    setAlt(text(selected, ["alt", "alt_text", "caption", "name", "title"]));
    setContext(text(selected, ["context", "collection"], "site"));
    const raw = value(selected, ["tags"]);
    setTags(Array.isArray(raw) ? raw.map(String).join(", ") : "");
  }, [selected?.id]);

  return <div>
    <header className="border-b border-white/10 pb-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-[10px] tracking-[0.28em] text-[#d71920]">06 · MEDIA LIBRARY</p>
          <h1 className="mt-2 font-gothic text-6xl leading-none md:text-8xl">ASSETS</h1>
          <p className="mt-3 max-w-3xl font-mono text-xs leading-6 text-white/45">Upload único. Reutilização no site. Storage real + media_assets.</p>
        </div>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 border border-white/10 px-3 py-2 font-mono text-[9px] tracking-[0.16em] text-white/55 hover:border-white/30 hover:text-white"><RefreshCw size={13} className={busy ? "animate-spin" : ""} /> ACTUALIZAR</button>
      </div>
    </header>

    {notice && <div className="mt-5 border border-white/10 bg-[#0d0d0d] px-4 py-3 font-mono text-[10px] tracking-[0.1em] text-[#d71920]">{notice}</div>}

    <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="min-w-0 border border-white/10 bg-[#0d0d0d]">
        <div className="grid gap-3 border-b border-white/10 p-4 md:grid-cols-[1fr_auto]">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="PESQUISAR MEDIA..." className="h-10 border border-white/10 bg-[#090909] px-3 font-mono text-xs text-white outline-none focus:border-[#d71920]" />
          <div className="flex flex-wrap gap-2">
            {(["all", "image", "video"] as const).map((item) => (
              <button key={item} type="button" onClick={() => setFilter(item)} className={"border px-3 py-2 font-mono text-[9px] uppercase tracking-[0.14em] " + (filter === item ? "border-[#d71920] bg-[#d71920]/10 text-white" : "border-white/10 text-white/35 hover:text-white")}>
                {item === "all" ? "TODOS" : item}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px bg-white/10 md:grid-cols-3">
          {filtered.map((row) => {
            const currentKind = kindOf(row);
            const url = urlOf(row);
            const active = String(selected?.id) === String(row.id);
            return <button type="button" key={String(row.id)} onClick={() => setSelected(row)} className={"group relative aspect-square overflow-hidden border bg-[#090909] text-left " + (active ? "border-[#d71920]" : "border-transparent")}>
              {url && currentKind === "image" ? <img src={url} alt="" className="h-full w-full object-cover grayscale transition duration-300 group-hover:grayscale-0" /> :
                currentKind === "video" && url ? <div className="grid h-full w-full place-items-center bg-[#111]"><FileVideo size={30} className="text-white/25" /></div> :
                <div className="grid h-full w-full place-items-center bg-[#111]"><ImageIcon size={30} className="text-white/15" /></div>}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/60 to-transparent p-3">
                <p className="truncate font-mono text-[9px] text-white/70">{text(row, ["name", "title", "filename", "file_name"], "ASSET")}</p>
                <p className="mt-1 font-mono text-[8px] text-white/35">{currentKind.toUpperCase()} · {Math.round(size(row) / 1024)} KB</p>
              </div>
            </button>;
          })}
          {!filtered.length && <div className="col-span-full p-10 font-mono text-xs text-white/35">SEM MEDIA PARA ESTE FILTRO.</div>}
        </div>
      </section>

      <section className="border border-white/10 bg-[#0d0d0d]">
        <div className="border-b border-white/10 p-5"><p className="font-mono text-[9px] tracking-[0.22em] text-[#d71920]">UPLOAD CENTRAL</p><h2 className="mt-1 font-gothic text-4xl">NOVO ASSET</h2></div>
        <div className="grid gap-4 p-5">
          <button type="button" disabled={!canEdit(role) || uploading} onClick={() => inputRef.current?.click()} className="grid min-h-40 place-items-center border border-dashed border-white/15 bg-[#090909] p-6 text-center transition hover:border-[#d71920] disabled:cursor-not-allowed disabled:opacity-50">
            <div><Upload size={22} className="mx-auto text-[#d71920]" /><p className="mt-3 font-mono text-[10px] tracking-[0.16em] text-white/60">{file ? file.name : "SELECCIONAR IMAGEM OU VÍDEO"}</p><p className="mt-2 font-mono text-[9px] text-white/25">UPLOAD DIRECTO PARA SUPABASE STORAGE</p></div>
          </button>
          <input ref={inputRef} type="file" accept="image/*,video/*" className="hidden" onChange={(event) => choose(event.target.files?.[0] ?? null)} />
          {file && <div className="border border-white/10 bg-[#090909] p-3 font-mono text-[9px] text-white/45">{file.type || "ficheiro"} · {Math.round(file.size / 1024)} KB</div>}
          <Field label="NOME" value={name} onChange={setName} disabled={!canEdit(role)} />
          <Field label="ALT / TÍTULO" value={alt} onChange={setAlt} disabled={!canEdit(role)} />
          <Field label="CONTEXTO" value={context} onChange={setContext} disabled={!canEdit(role)} />
          <Field label="TAGS" value={tags} onChange={setTags} disabled={!canEdit(role)} />
          <button type="button" disabled={!canEdit(role) || !file || uploading} onClick={() => void upload()} className="inline-flex min-h-11 items-center justify-center gap-2 border border-[#d71920] bg-[#d71920] px-4 font-mono text-[10px] tracking-[0.16em] text-white disabled:cursor-not-allowed disabled:opacity-50"><Upload size={14} /> {uploading ? "A ENVIAR..." : "FAZER UPLOAD"}</button>
          <p className="font-mono text-[8px] leading-5 text-white/25">BUCKET: {bucket}</p>
        </div>
      </section>
    </div>

    {selected && <section className="mt-6 grid gap-6 border border-white/10 bg-[#0d0d0d] p-5 xl:grid-cols-[1fr_0.8fr]">
      <div>
        <p className="font-mono text-[9px] tracking-[0.22em] text-[#d71920]">INSPECTOR</p>
        <h2 className="mt-1 font-gothic text-4xl">{text(selected, ["name", "title", "filename", "file_name"], "ASSET")}</h2>
        <div className="mt-5 overflow-hidden border border-white/10 bg-black">
          {urlOf(selected) && kindOf(selected) === "image" ? <img src={urlOf(selected)} alt="" className="max-h-[32rem] w-full object-contain" /> :
            urlOf(selected) && kindOf(selected) === "video" ? <video src={urlOf(selected)} controls className="max-h-[32rem] w-full bg-black" /> :
            <div className="grid min-h-48 place-items-center font-mono text-xs text-white/20">SEM PREVIEW</div>}
        </div>
      </div>
      <div className="grid content-start gap-4">
        <div className="border border-white/10 bg-[#090909] p-4 font-mono text-[9px] leading-6 text-white/45"><p>URL</p><p className="mt-1 break-all text-white/70">{urlOf(selected) || "SEM URL"}</p>{pathOf(selected) && <p className="mt-2 break-all text-white/30">PATH {pathOf(selected)}</p>}</div>
        <Field label="NOME" value={name} onChange={setName} disabled={!canEdit(role)} />
        <Field label="ALT / TÍTULO" value={alt} onChange={setAlt} disabled={!canEdit(role)} />
        <Field label="CONTEXTO" value={context} onChange={setContext} disabled={!canEdit(role)} />
        <Field label="TAGS" value={tags} onChange={setTags} disabled={!canEdit(role)} />
        {canEdit(role) && <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void saveMeta()} className="inline-flex items-center gap-2 border border-[#d71920] bg-[#d71920] px-4 py-3 font-mono text-[10px] tracking-[0.16em] text-white"><Check size={14} /> GUARDAR METADADOS</button>
          {urlOf(selected) && <button type="button" onClick={() => void navigator.clipboard.writeText(urlOf(selected)).then(() => setNotice("URL COPIADA"))} className="inline-flex items-center gap-2 border border-white/10 px-4 py-3 font-mono text-[10px] tracking-[0.16em] text-white/50 hover:text-white"><Clipboard size={14} /> COPIAR URL</button>}
          <button type="button" onClick={() => void remove()} className="inline-flex items-center gap-2 border border-white/10 px-4 py-3 font-mono text-[10px] tracking-[0.16em] text-white/40 hover:border-[#d71920] hover:text-[#d71920]"><Trash2 size={14} /> ELIMINAR ASSET</button>
        </div>}
      </div>
    </section>}
  </div>;
}

function Field({ label, value, onChange, disabled }: { label: string; value: string; onChange: (value: string) => void; disabled: boolean }) {
  return <label className="grid gap-2 font-mono text-[9px] tracking-[0.18em] text-white/35">{label}<input value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="min-h-11 border border-white/10 bg-[#090909] px-3 text-sm text-white outline-none focus:border-[#d71920] disabled:opacity-50" /></label>;
}
