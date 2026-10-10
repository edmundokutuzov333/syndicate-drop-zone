import { useEffect, useMemo, useState } from "react";
import { MediaManager } from "@/components/control-room/MediaManager";
import {
  Check,
  Copy,
  Eye,
  FileJson,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import {
  adminQuery,
  getControlRoomSession,
  isPublicPreviewSession,
  type ControlRoomRole,
} from "@/lib/control-room-auth";

type RowData = Record<string, unknown>;

type ModuleDefinition = {
  code: string;
  title: string;
  eyebrow: string;
  description: string;
  tables: string[];
  readOnly?: boolean;
  roles?: ControlRoomRole[];
  optionalTables?: string[];
};

export const MODULE_CONFIG: Record<string, ModuleDefinition> = {
  musica: {
    code: "03",
    title: "MÚSICA",
    eyebrow: "TAPES + RELEASES",
    description: "Conteúdo musical centralizado no banco. Edição, estado editorial, preview e publicação sem tocar no código.",
    tables: ["tapes", "releases", "artist_releases", "beats"],
    roles: ["OWNER", "ADMIN", "EDITOR"],
  },
  camping: {
    code: "04",
    title: "CAMPING",
    eyebrow: "EVENTOS + SESSÕES",
    description: "Operação editorial do camping, com timeline, sessões e estado de publicação.",
    tables: ["camping_events", "camping_sessions"],
    roles: ["OWNER", "ADMIN", "EDITOR"],
  },
  revelacao: {
    code: "05",
    title: "REVELAÇÃO",
    eyebrow: "SALA DE REVELAÇÃO",
    description: "Galeria publicada e slots legados da sala de revelação, ligados directamente ao banco.",
    tables: ["gallery_items", "revelation_media"],
    optionalTables: ["gallery_items"],
    roles: ["OWNER", "ADMIN", "EDITOR"],
  },
  media: {
    code: "06",
    title: "MEDIA",
    eyebrow: "MEDIA LIBRARY",
    description: "Biblioteca central de assets e metadados. A origem continua no backend real.",
    tables: ["media_assets"],
    roles: ["OWNER", "ADMIN", "EDITOR"],
  },
  merch: {
    code: "07",
    title: "MERCH",
    eyebrow: "PRODUTOS + STOCK",
    description: "Produtos, variantes, inventário e reservas para operação real do drop.",
    tables: ["merch_products", "merch_variants", "inventory_movements", "reservations"],
    roles: ["OWNER", "ADMIN", "MERCH"],
  },
  site: {
    code: "09",
    title: "SITE",
    eyebrow: "SITE SETTINGS",
    description: "Definições editoriais e secções estruturais. Sem page builder genérico.",
    tables: ["site_settings", "site_sections"],
    roles: ["OWNER", "ADMIN", "EDITOR"],
  },
  drop: {
    code: "10",
    title: "DROP",
    eyebrow: "DROP CAMPAIGN",
    description: "Campanhas de lançamento, countdown e estado operacional do drop.",
    tables: ["drop_campaigns"],
    roles: ["OWNER", "ADMIN", "EDITOR"],
  },
  seo: {
    code: "11",
    title: "SEO & SOCIAL",
    eyebrow: "METADATA",
    description: "Metadados públicos, previews sociais e referências de distribuição.",
    tables: ["site_settings"],
    roles: ["OWNER", "ADMIN", "EDITOR"],
  },
  utilizadores: {
    code: "12",
    title: "UTILIZADORES",
    eyebrow: "RBAC",
    description: "Perfis do Control Room. Alterações continuam sujeitas a Supabase Auth e RLS.",
    tables: ["admin_profiles"],
    roles: ["OWNER", "ADMIN"],
  },
  actividade: {
    code: "13",
    title: "ACTIVIDADE",
    eyebrow: "AUDIT LOG",
    description: "Histórico operacional. O log é alimentado pelo backend quando os triggers de auditoria estão activos.",
    tables: ["audit_logs"],
    readOnly: true,
  },
  sistema: {
    code: "14",
    title: "SISTEMA",
    eyebrow: "HEALTH",
    description: "Estado operacional do backend e dos conteúdos principais.",
    tables: ["admin_profiles", "artists", "partnership_requests"],
    readOnly: true,
  },
};

const STATUS_VALUES = [
  "draft",
  "ready",
  "published",
  "archived",
  "active",
  "inactive",
  "new",
  "analysis",
  "contacted",
  "negotiation",
  "accepted",
  "rejected",
  "closed",
  "scheduled",
  "live",
  "ended",
];

const PROTECTED_FIELDS = new Set(["id", "created_at", "updated_at"]);

function normaliseRecord(value: RowData): RowData {
  return Object.fromEntries(
    Object.entries(value).map(([key, field]) => {
      if (typeof field === "string") return [key, field];
      if (Array.isArray(field)) return [key, [...field]];
      if (field && typeof field === "object") return [key, JSON.parse(JSON.stringify(field))];
      return [key, field];
    }),
  );
}

function hasStatus(row: RowData | null) {
  return Boolean(row && typeof row.status === "string");
}

function prettyField(field: string) {
  return field
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isLongText(field: string, value: unknown) {
  if (Array.isArray(value) || (value && typeof value === "object")) return true;
  if (typeof value !== "string") return false;
  return value.length > 120 || /bio|description|message|notes|content|payload|body|text|lyrics/i.test(field);
}

function isLikelyUrl(value: unknown) {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

function canEditDefinition(definition: ModuleDefinition, role: ControlRoomRole | null) {
  if (!role || definition.readOnly) return false;
  return !definition.roles || definition.roles.includes(role);
}

export function ControlRoomModule({ module }: { module: keyof typeof MODULE_CONFIG }) {
  if (module === "media") return <MediaManager />;
  const config = MODULE_CONFIG[module];
  const [role, setRole] = useState<ControlRoomRole | null>(null);
  if (!config) return null;
  const [previewMode, setPreviewMode] = useState(false);
  const [activeTable, setActiveTable] = useState(config.tables[0] ?? "");
  const [rowsByTable, setRowsByTable] = useState<Record<string, RowData[]>>({});
  const [selected, setSelected] = useState<RowData | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState("");

  const editable = !previewMode && canEditDefinition(config, role);

  const load = async () => {
    setBusy(true);
    setNotice("");
    try {
      const session = await getControlRoomSession();
      setRole(session?.role ?? null);
      setPreviewMode(isPublicPreviewSession(session));

      const optionalWarnings: string[] = [];
      const entries = await Promise.all(
        config.tables.map(async (table) => {
          try {
            const rows = await adminQuery<RowData[]>(
              "/rest/v1/" + table + "?select=*&limit=1000",
            );
            return [table, rows.map(normaliseRecord)] as const;
          } catch (error) {
            if (!config.optionalTables?.includes(table)) throw error;
            optionalWarnings.push(table);
            return [table, [] as RowData[]] as const;
          }
        }),
      );

      const next = Object.fromEntries(entries);
      setRowsByTable(next);
      if (optionalWarnings.length) {
        setNotice(
          optionalWarnings.join(", ") +
            " indisponível(is); a sala mantém a fonte legada quando disponível.",
        );
      }
      const currentRows = next[activeTable] ?? [];
      setSelected((current) => {
        if (!current) return currentRows[0] ?? null;
        return currentRows.find((row) => String(row.id) === String(current.id)) ?? currentRows[0] ?? null;
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível carregar o módulo.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void load();
  }, [activeTable, config.tables.join("|")]);

  const activeRows = rowsByTable[activeTable] ?? [];

  const visibleRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return activeRows.filter((row) => {
      const matchesStatus =
        statusFilter === "all" ||
        String(row.status ?? "").toLowerCase() === statusFilter;
      const matchesSearch =
        !needle ||
        Object.entries(row).some(([key, value]) => {
          if (value === null || value === undefined) return false;
          return (key + " " + String(value)).toLowerCase().includes(needle);
        });
      return matchesStatus && matchesSearch;
    });
  }, [activeRows, query, statusFilter]);

  useEffect(() => {
    const selectedId = selected?.id;
    if (selectedId && !activeRows.some((row) => String(row.id) === String(selectedId))) {
      setSelected(activeRows[0] ?? null);
    }
  }, [activeTable, activeRows, selected?.id]);

  const statusOptions = Array.from(
    new Set([
      ...STATUS_VALUES,
      ...activeRows
        .map((row) => row.status)
        .filter((value): value is string => typeof value === "string"),
    ]),
  );

  const summary = config.tables.map((table) => ({
    table,
    count: rowsByTable[table]?.length ?? 0,
  }));

  const saveRecord = async (next: RowData, create = false) => {
    if (!editable) return;
    setNotice("A GUARDAR...");
    try {
      const clean = Object.fromEntries(
        Object.entries(next).filter(([key]) => !PROTECTED_FIELDS.has(key)),
      );
      if (create) {
        await adminQuery("/rest/v1/" + activeTable, {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify(clean),
        });
      } else if (selected?.id) {
        await adminQuery(
          "/rest/v1/" + activeTable + "?id=eq." + encodeURIComponent(String(selected.id)),
          {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify(clean),
          },
        );
      } else {
        throw new Error("Nenhum registo seleccionado.");
      }
      setNotice(create ? "REGISTO CRIADO" : "GUARDADO");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível guardar.");
      throw error;
    }
  };

  const duplicateRecord = async () => {
    if (!editable || !selected) return;
    await saveRecord(
      Object.fromEntries(
        Object.entries(selected).filter(([key]) => !PROTECTED_FIELDS.has(key)),
      ),
      true,
    );
  };

  const deleteRecord = async () => {
    if (!editable || !selected?.id) return;
    const confirmed = window.confirm("Eliminar este registo? Esta acção é permanente.");
    if (!confirmed) return;
    setNotice("A ELIMINAR...");
    try {
      await adminQuery(
        "/rest/v1/" + activeTable + "?id=eq." + encodeURIComponent(String(selected.id)),
        { method: "DELETE", headers: { Prefer: "return=minimal" } },
      );
      setSelected(null);
      setNotice("REGISTO ELIMINADO");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível eliminar.");
    }
  };

  const updateStatus = async (status: string) => {
    if (!editable || !selected || !hasStatus(selected)) return;
    await saveRecord({ ...selected, status });
  };

  return (
    <div>
      <header className="border-b border-white/10 pb-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="font-mono text-[10px] tracking-[0.28em] text-[#d71920]">
              {config.code} · {config.eyebrow}
            </p>
            <h1 className="mt-2 font-gothic text-6xl leading-none md:text-8xl">{config.title}</h1>
            <p className="mt-3 max-w-3xl font-mono text-xs leading-6 text-white/45">
              {config.description}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] text-white/30">{role ?? "AUTH"}</span>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-2 border border-white/10 px-3 py-2 font-mono text-[9px] tracking-[0.16em] text-white/55 hover:border-white/30 hover:text-white"
            >
              <RefreshCw size={13} className={busy ? "animate-spin" : ""} />
              ACTUALIZAR
            </button>
          </div>
        </div>
      </header>

      <section className="mt-6 grid gap-px border border-white/10 bg-white/10 sm:grid-cols-2 xl:grid-cols-4">
        {summary.map(({ table, count }) => (
          <button
            key={table}
            type="button"
            onClick={() => {
              setActiveTable(table);
              setQuery("");
              setStatusFilter("all");
              setSelected(null);
            }}
            className={`bg-[#0d0d0d] p-4 text-left transition hover:bg-[#111] ${activeTable === table ? "border-l-2 border-[#d71920]" : ""}`}
          >
            <p className="font-mono text-[9px] tracking-[0.18em] text-white/30">{table.toUpperCase()}</p>
            <p className="mt-2 font-mono text-3xl font-bold">{count}</p>
            <p className="mt-1 font-mono text-[9px] text-[#d71920]">REGISTOS</p>
          </button>
        ))}
      </section>

      {module === "actividade" && activeRows.length === 0 && (
        <div className="mt-6 border border-[#d71920]/40 bg-[#d71920]/5 p-4 font-mono text-[10px] leading-6 text-white/55">
          SEM REGISTOS DE AUDITORIA. A migração de triggers está preparada no repositório, mas a activação no Supabase depende da execução da migração.
        </div>
      )}

      {notice && (
        <div className="mt-4 border border-white/10 bg-[#0d0d0d] px-4 py-3 font-mono text-[10px] tracking-[0.12em] text-[#d71920]">
          {notice}
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="min-w-0 border border-white/10 bg-[#0d0d0d]">
          <div className="border-b border-white/10 p-4">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="PESQUISAR REGISTOS..."
                className="h-10 w-full border border-white/10 bg-[#090909] pl-9 pr-3 font-mono text-xs text-white outline-none focus:border-[#d71920]"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`border px-3 py-2 font-mono text-[9px] tracking-[0.14em] ${statusFilter === "all" ? "border-[#d71920] bg-[#d71920]/10 text-white" : "border-white/10 text-white/35 hover:text-white"}`}
              >
                TODOS
              </button>
              {statusOptions.filter((status) => activeRows.some((row) => String(row.status ?? "") === status)).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`border px-3 py-2 font-mono text-[9px] uppercase tracking-[0.14em] ${statusFilter === status ? "border-[#d71920] bg-[#d71920]/10 text-white" : "border-white/10 text-white/35 hover:text-white"}`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-white/10">
            {visibleRows.map((row, index) => {
              const title = String(row.name ?? row.title ?? row.label ?? row.key ?? row.code ?? ("REGISTO " + String(index + 1)));
              const subtitle = String(row.status ?? row.type ?? row.slug ?? row.id ?? "");
              return (
                <button
                  key={String(row.id ?? index)}
                  type="button"
                  onClick={() => setSelected(row)}
                  className={`w-full border-l-2 p-4 text-left transition ${String(selected?.id) === String(row.id) ? "border-[#d71920] bg-[#d71920]/5" : "border-transparent hover:bg-white/[0.02]"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-gothic text-2xl">{title}</p>
                      <p className="mt-1 truncate font-mono text-[9px] tracking-[0.12em] text-white/30">{subtitle}</p>
                    </div>
                    {typeof row.status === "string" && (
                      <span className="shrink-0 font-mono text-[9px] text-[#d71920]">{row.status.toUpperCase()}</span>
                    )}
                  </div>
                </button>
              );
            })}
            {!visibleRows.length && (
              <div className="p-8 font-mono text-xs text-white/35">SEM REGISTOS PARA ESTE FILTRO.</div>
            )}
          </div>

          {editable && (
            <div className="flex flex-wrap gap-2 border-t border-white/10 p-4">
              <button
                type="button"
                onClick={() => {
                  const template = activeRows[0]
                    ? Object.fromEntries(
                        Object.entries(activeRows[0])
                          .filter(([key]) => !PROTECTED_FIELDS.has(key))
                          .map(([key, value]) => [
                            key,
                            Array.isArray(value) ? [] : typeof value === "boolean" ? false : "",
                          ]),
                      )
                    : {};
                  setSelected(template);
                  setNotice("NOVO REGISTO. PREENCHA OS CAMPOS OBRIGATÓRIOS.");
                }}
                className="inline-flex items-center gap-2 border border-[#d71920] px-3 py-2 font-mono text-[9px] tracking-[0.14em] text-[#d71920] hover:bg-[#d71920]/10"
              >
                <Plus size={13} /> NOVO
              </button>
              {selected && Object.keys(selected).length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => void duplicateRecord()}
                    className="inline-flex items-center gap-2 border border-white/10 px-3 py-2 font-mono text-[9px] tracking-[0.14em] text-white/50 hover:text-white"
                  >
                    <Copy size={13} /> DUPLICAR
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteRecord()}
                    className="inline-flex items-center gap-2 border border-white/10 px-3 py-2 font-mono text-[9px] tracking-[0.14em] text-white/40 hover:border-[#d71920] hover:text-[#d71920]"
                  >
                    <Trash2 size={13} /> ELIMINAR
                  </button>
                </>
              )}
            </div>
          )}
        </section>

        <RecordEditor
          key={String(selected?.id ?? "new")}
          record={selected}
          table={activeTable}
          editable={editable}
          statusOptions={statusOptions}
          onSave={saveRecord}
          onPublish={updateStatus}
        />
      </div>
    </div>
  );
}

function RecordEditor({
  record,
  table,
  editable,
  statusOptions,
  onSave,
  onPublish,
}: {
  record: RowData | null;
  table: string;
  editable: boolean;
  statusOptions: string[];
  onSave: (record: RowData, create?: boolean) => Promise<void>;
  onPublish: (status: string) => Promise<void>;
}) {
  const [form, setForm] = useState<RowData>(() => (record ? normaliseRecord(record) : {}));
  const [savedForm, setSavedForm] = useState<RowData>(() => (record ? normaliseRecord(record) : {}));
  const [raw, setRaw] = useState(() => JSON.stringify(record ?? {}, null, 2));
  const [mode, setMode] = useState<"form" | "json">("form");
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    const next = record ? normaliseRecord(record) : {};
    setForm(next);
    setSavedForm(next);
    setRaw(JSON.stringify(next, null, 2));
    setMode("form");
    setPreview(false);
  }, [record?.id]);

  if (!record) {
    return (
      <div className="grid min-h-80 place-items-center border border-dashed border-white/10 bg-[#0d0d0d] font-mono text-xs text-white/25">
        SELECT REGISTO
      </div>
    );
  }

  const isNew = !record.id;
  const fields = Object.keys(form);
  const dirty = JSON.stringify(form) !== JSON.stringify(savedForm);

  useEffect(() => {
    if (!dirty || !editable) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty, editable]);

  const patchField = (key: string, value: unknown) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      setRaw(JSON.stringify(next, null, 2));
      return next;
    });
  };

  const saveForm = async () => {
    await onSave(form, isNew);
    setSavedForm(normaliseRecord(form));
    setRaw(JSON.stringify(form, null, 2));
  };

  const saveJson = async () => {
    try {
      const parsed = JSON.parse(raw) as RowData;
      setForm(normaliseRecord(parsed));
      await onSave(parsed, isNew);
      setSavedForm(normaliseRecord(parsed));
      setRaw(JSON.stringify(parsed, null, 2));
    } catch (error) {
      window.alert(error instanceof SyntaxError ? "JSON inválido." : "Não foi possível guardar.");
    }
  };

  const saveWorkflowStatus = async (status: string) => {
    const next = { ...form, status };
    setForm(next);
    setRaw(JSON.stringify(next, null, 2));
    await onSave(next, isNew);
    setSavedForm(normaliseRecord(next));
  };

  const previewTitle = String(
    form.name ?? form.title ?? form.label ?? form.key ?? form.code ?? table.toUpperCase(),
  );

  return (
    <section className="border border-white/10 bg-[#0d0d0d]">
      <div className="flex flex-col gap-3 border-b border-white/10 p-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-[9px] tracking-[0.22em] text-[#d71920]">{table.toUpperCase()}</p>
          <h2 className="mt-1 font-gothic text-4xl">{previewTitle}</h2>
          {form.id != null && form.id !== "" && <p className="mt-1 font-mono text-[9px] text-white/25">{String(form.id)}</p>}
        </div>

      {dirty && editable && (
        <div className="border-b border-[#d71920]/30 bg-[#d71920]/5 px-4 py-3 font-mono text-[9px] tracking-[0.12em] text-white/60">
          ALTERAÇÕES NÃO GUARDADAS. GUARDAR ANTES DE SAIR.
          <button type="button" onClick={() => { setForm(normaliseRecord(savedForm)); setRaw(JSON.stringify(savedForm, null, 2)); }} className="ml-3 text-[#d71920] hover:text-white">DESCARTAR</button>
        </div>
      )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPreview((current) => !current)}
            className="inline-flex items-center gap-2 border border-white/10 px-3 py-2 font-mono text-[9px] text-white/55 hover:text-white"
          >
            <Eye size={13} /> {preview ? "FECHAR PREVIEW" : "PRÉ-VISUALIZAR"}
          </button>
          {hasStatus(form) && editable && (
            <>
              <button
                type="button"
                onClick={() => void saveWorkflowStatus("draft")}
                className="border border-white/10 px-3 py-2 font-mono text-[9px] text-white/45 hover:text-white"
              >
                GUARDAR RASCUNHO
              </button>
              <button
                type="button"
                onClick={() => void saveWorkflowStatus("published")}
                className="border border-[#d71920] bg-[#d71920] px-3 py-2 font-mono text-[9px] text-white hover:opacity-90"
              >
                PUBLICAR
              </button>
            </>
          )}
        </div>
      </div>

      <div className="border-b border-white/10 p-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("form")}
            className={`border px-3 py-2 font-mono text-[9px] tracking-[0.14em] ${mode === "form" ? "border-[#d71920] text-white" : "border-white/10 text-white/35"}`}
          >
            FORMULÁRIO
          </button>
          <button
            type="button"
            onClick={() => setMode("json")}
            className={`inline-flex items-center gap-2 border px-3 py-2 font-mono text-[9px] tracking-[0.14em] ${mode === "json" ? "border-[#d71920] text-white" : "border-white/10 text-white/35"}`}
          >
            <FileJson size={13} /> JSON
          </button>
        </div>
      </div>

      {preview ? (
        <PreviewPanel record={form} />
      ) : mode === "json" ? (
        <div className="p-5">
          <textarea
            value={raw}
            disabled={!editable}
            onChange={(event) => setRaw(event.target.value)}
            spellCheck={false}
            rows={28}
            className="w-full resize-y border border-white/10 bg-[#090909] p-4 font-mono text-xs leading-6 text-white outline-none focus:border-[#d71920] disabled:opacity-60"
          />
          {editable && (
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => void saveJson()}
                className="inline-flex items-center gap-2 border border-[#d71920] bg-[#d71920] px-4 py-3 font-mono text-[10px] tracking-[0.16em] text-white"
              >
                <Save size={14} /> GUARDAR JSON
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-5 p-5">
          {!fields.length && (
            <div className="border border-dashed border-white/10 p-5 font-mono text-[10px] leading-6 text-white/35">
              Registo vazio. Use o modo JSON para construir o payload exacto desta tabela.
            </div>
          )}

          {fields.map((field) => {
            const value = form[field];
            const protectedField = PROTECTED_FIELDS.has(field) || field === "user_id";

            if (field === "status") {
              const current = String(value ?? "");
              return (
                <label key={field} className="grid gap-2 font-mono text-[9px] tracking-[0.18em] text-white/35">
                  {prettyField(field).toUpperCase()}
                  <select
                    value={current}
                    disabled={!editable || protectedField}
                    onChange={(event) => patchField(field, event.target.value)}
                    className="min-h-11 border border-white/10 bg-[#090909] px-3 text-sm tracking-normal text-white outline-none focus:border-[#d71920] disabled:opacity-50"
                  >
                    {current && !statusOptions.includes(current) && <option value={current}>{current}</option>}
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </label>
              );
            }

            if (typeof value === "boolean") {
              return (
                <label key={field} className="flex items-center gap-3 border border-white/10 p-4 font-mono text-[10px] tracking-[0.12em] text-white/55">
                  <input
                    type="checkbox"
                    checked={value}
                    disabled={!editable || protectedField}
                    onChange={(event) => patchField(field, event.target.checked)}
                  />
                  {prettyField(field).toUpperCase()}
                </label>
              );
            }

            if (Array.isArray(value) || (value && typeof value === "object")) {
              return (
                <label key={field} className="grid gap-2 font-mono text-[9px] tracking-[0.18em] text-white/35">
                  {prettyField(field).toUpperCase()} · JSON
                  <textarea
                    value={JSON.stringify(value, null, 2)}
                    disabled={!editable || protectedField}
                    onChange={(event) => {
                      try {
                        patchField(field, JSON.parse(event.target.value));
                      } catch {
                        // Keep the UI stable while JSON is being typed; raw mode handles strict editing.
                      }
                    }}
                    rows={6}
                    className="resize-y border border-white/10 bg-[#090909] px-3 py-3 font-mono text-xs leading-6 text-white outline-none focus:border-[#d71920] disabled:opacity-50"
                  />
                </label>
              );
            }

            const stringValue = value === null || value === undefined ? "" : String(value);
            const long = isLongText(field, value);

            return (
              <label key={field} className="grid gap-2 font-mono text-[9px] tracking-[0.18em] text-white/35">
                {prettyField(field).toUpperCase()}
                {long ? (
                  <textarea
                    value={stringValue}
                    disabled={!editable || protectedField}
                    onChange={(event) => patchField(field, event.target.value)}
                    rows={6}
                    className="resize-y border border-white/10 bg-[#090909] px-3 py-3 text-sm leading-6 text-white outline-none focus:border-[#d71920] disabled:opacity-50"
                  />
                ) : (
                  <input
                    value={stringValue}
                    disabled={!editable || protectedField}
                    onChange={(event) => patchField(field, event.target.value)}
                    className="min-h-11 border border-white/10 bg-[#090909] px-3 text-sm text-white outline-none focus:border-[#d71920] disabled:opacity-50"
                  />
                )}
              </label>
            );
          })}

          {editable && (
            <div className="flex justify-end border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={() => void saveForm()}
                className="inline-flex items-center gap-2 border border-[#d71920] bg-[#d71920] px-4 py-3 font-mono text-[10px] tracking-[0.16em] text-white"
              >
                <Check size={14} /> {isNew ? "CRIAR REGISTO" : "GUARDAR ALTERAÇÕES"}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function PreviewPanel({ record }: { record: RowData }) {
  const media = Object.entries(record).find(([key, value]) => /image|photo|thumbnail|cover|poster|url/i.test(key) && isLikelyUrl(value));
  const video = Object.entries(record).find(([key, value]) => /video/i.test(key) && isLikelyUrl(value));
  const title = String(record.name ?? record.title ?? record.label ?? record.key ?? "PREVIEW");

  return (
    <div className="grid gap-6 p-5">
      <div className="border border-white/10 bg-[#090909] p-6">
        <p className="font-mono text-[9px] tracking-[0.22em] text-[#d71920]">PRÉ-VISUALIZAÇÃO EDITORIAL</p>
        <h3 className="mt-2 font-gothic text-5xl leading-none">{title}</h3>
        {typeof record.status === "string" && (
          <p className="mt-2 font-mono text-[9px] text-white/30">{record.status.toUpperCase()}</p>
        )}
      </div>

      {media && (
        <img src={String(media[1])} alt="" className="max-h-[28rem] w-full object-cover grayscale" />
      )}

      {video && (
        <div className="aspect-video border border-white/10 bg-black">
          <iframe
            title="Preview"
            src={String(video[1])}
            className="h-full w-full"
            allow="autoplay; encrypted-media; picture-in-picture"
          />
        </div>
      )}

      <div className="grid gap-px border border-white/10 bg-white/10 sm:grid-cols-2">
        {Object.entries(record)
          .filter(([key, value]) => !["id", "created_at", "updated_at"].includes(key) && !/image|photo|thumbnail|cover|poster|video/i.test(key) && value !== null && value !== "")
          .slice(0, 24)
          .map(([key, value]) => (
            <div key={key} className="bg-[#0d0d0d] p-4">
              <p className="font-mono text-[9px] tracking-[0.16em] text-white/25">{prettyField(key).toUpperCase()}</p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-white/70">
                {typeof value === "string" ? value : JSON.stringify(value)}
              </p>
            </div>
          ))}
      </div>
    </div>
  );
}
