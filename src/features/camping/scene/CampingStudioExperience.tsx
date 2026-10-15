import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CampingAccessState } from "../interactions/access-machine";
import type { CampingRoomId } from "./CampingRoomWorld";
import { initialCampingAccessState } from "../interactions/access-machine";
import sindicatoSelo from "@/assets/brand/sindicato-selo.png.asset.json";
import { CampingStudioEngine } from "./CampingStudioEngine";
import type { CampingDebugApi, CampingDebugPoseId, CampingReferenceMatch } from "../v3/debug-api";
import { CampingObjectInterface } from "./CampingObjectInterface";
import "./camping-object-interface.css";
import "./camping-studio.css";

type HoverTarget = { id: string; label: string; action: string } | null;
type AssetState = "idle" | "loading" | "ready" | "error";

type Props = {
  day?: { current: number; total: number } | null;
  recordsOpen: boolean;
  onToggleRecords: () => void;
  onClosePanels: () => void;
  onLeave: () => void;
};

const phaseLabel: Record<CampingAccessState["phase"], string> = {
  LOCKED: "ACCESS LOCKED",
  CODE_ENTRY: "CODE ENTRY",
  ACCESS_GRANTED: "ACCESS GRANTED",
  DOOR_OPENING: "DOOR OPENING",
  ENTERING_STUDIO: "ENTERING STUDIO",
  EXPLORATION: "EXPLORATION",
  INTERACTION_FOCUS: "INTERACTION FOCUS",
  ERROR: "SIGNAL ERROR",
};

const guidedPoints = [
  { id: "studio", label: "ROOM 01 / ESTÚDIO" },
  { id: "production", label: "PRODUCTION DESK" },
  { id: "photography", label: "PHOTO SET" },
  { id: "clothing", label: "CLOTHING RACK" },
  { id: "artists", label: "MEMBER WALL" },
] as const;

const directions = [
  { key: "forward", label: "AVANÇAR", glyph: "↑" },
  { key: "left", label: "ESQUERDA", glyph: "←" },
  { key: "back", label: "RECUAR", glyph: "↓" },
  { key: "right", label: "DIREITA", glyph: "→" },
] as const;

const roomCopy: Record<CampingRoomId, { code: string; title: string; subtitle: string }> = {
  studio: { code: "ROOM 01", title: "XOYENS STUDIO", subtitle: "EXPLORATION ACTIVE" },
  archive: { code: "ROOM 02", title: "THE ARCHIVE", subtitle: "PUBLISHED RECORDS / 808" },
  listening: { code: "ROOM 03", title: "LISTENING ROOM", subtitle: "FREQUENCIA 808" },
  secret: { code: "UNLISTED", title: "SECRET ROOM", subtitle: "DISCOVERY IS NOT AUTHORIZATION" },
};

const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function CampingStudioExperience({
  day,
  recordsOpen,
  onToggleRecords,
  onClosePanels,
  onLeave,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CampingStudioEngine | null>(null);
  const pendingAccessKeysRef = useRef<string[]>([]);
  const cursorRef = useRef<HTMLDivElement>(null);
  const guidedRef = useRef(false);
  const recordsRef = useRef(recordsOpen);
  const [access, setAccess] = useState<CampingAccessState>({ ...initialCampingAccessState });
  const accessRef = useRef<CampingAccessState>({ ...initialCampingAccessState });
  const [hover, setHover] = useState<HoverTarget>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"neutral" | "danger" | "success">("neutral");
  const [assetState, setAssetState] = useState<AssetState>("idle");
  const [webglError, setWebglError] = useState<string | null>(null);
  const [rendererAttempt, setRendererAttempt] = useState(0);
  const [guidedOpen, setGuidedOpen] = useState(false);
  const [currentRoom, setCurrentRoom] = useState<CampingRoomId>("studio");
  const [debugMatch, setDebugMatch] = useState<CampingReferenceMatch | null>(null);
  const [debugReferenceUrl, setDebugReferenceUrl] = useState<string | null>(null);
  const [debugReferenceMessage, setDebugReferenceMessage] = useState<string>("A pontuação usa a referência privada de 72 sectores.");
  const [debugOverlayMode, setDebugOverlayMode] = useState<"side-by-side" | "blend" | "diff">("side-by-side");
  const [debugBlend, setDebugBlend] = useState(50);
  const debugReferenceInput = useRef<HTMLInputElement>(null);
  const debugQuery = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const debugEnabled = debugQuery?.get("debug3d") === "1";
  const debugOverlayEnabled = debugEnabled && debugQuery?.get("refmatch") === "1";

  useEffect(() => {
    guidedRef.current = guidedOpen;
  }, [guidedOpen]);
  useEffect(() => {
    recordsRef.current = recordsOpen;
  }, [recordsOpen]);
  useClientLayoutEffect(() => {
    const handleAccessKeys = (event: KeyboardEvent) => {
      const phase = accessRef.current.phase;
      if ((phase !== "LOCKED" && phase !== "CODE_ENTRY") || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)) return;
      // Keyboard access works from any non-editable interface element, not only the canvas.
      const command = /^\d$/.test(event.key) ? event.key : event.key === "Backspace" ? "BACK" : null;
      if (!command) return;

      // Capture digits before the canvas/window engine listeners so a key is processed once
      // even when focus is on an interface button instead of the canvas.
      event.preventDefault();
      event.stopImmediatePropagation();
      const engine = engineRef.current;
      if (!engine) {
        // React may paint the canvas before its effect mounts Three.js. Preserve early
        // keystrokes instead of swallowing the access code during that short window.
        pendingAccessKeysRef.current.push(command);
        return;
      }
      engine.pressAccessibleKey(command);
    };
    window.addEventListener("keydown", handleAccessKeys, true);
    return () => window.removeEventListener("keydown", handleAccessKeys, true);
  }, []);

  const closePanels = useCallback(() => {
    setGuidedOpen(false);
    onClosePanels();
  }, [onClosePanels]);

  useClientLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setWebglError(null);
    setAssetState("loading");
    const engine = new CampingStudioEngine({
      onAccessChange: (nextAccess) => {
        accessRef.current = nextAccess;
        setAccess(nextAccess);
      },
      onHoverChange: (target) => {
        setHover(target);
        if (cursorRef.current) cursorRef.current.dataset.interactive = target ? "true" : "false";
      },
      onMessage: (nextMessage, tone = "neutral") => {
        setMessage(nextMessage);
        setMessageTone(tone);
      },
      onAssetState: setAssetState,
      onWebGLFailure: (error) => setWebglError(error || null),
      onCursor: (x, y, visible) => {
        const cursor = cursorRef.current;
        if (!cursor) return;
        cursor.style.left = x + "px";
        cursor.style.top = y + "px";
        cursor.style.opacity = visible ? "1" : "0";
        cursor.dataset.interactive = hover ? "true" : "false";
      },
      onRoomChange: setCurrentRoom,
      onEscape: () => {
        if (guidedRef.current) {
          setGuidedOpen(false);
          return;
        }
        if (recordsRef.current) {
          onClosePanels();
          return;
        }
        closePanels();
      },
    });
    engineRef.current = engine;
    let debugApi: CampingDebugApi | null = null;
    try {
      engine.mount(canvas);
      if (new URLSearchParams(window.location.search).get("debug3d") === "1") {
        const query = new URLSearchParams(window.location.search);
        const requestedPose = query.get("pose");
        const allowedPoses = new Set<CampingDebugPoseId>(["entrada", "producao", "foto", "esquerda", "direita", "tecto", "chao"]);
        debugApi = {
          get ready() { return engine.debugIsReady(); },
          freeze: () => engine.debugFreeze(),
          metrics: () => engine.debugMetrics(),
          setPose: (id) => engine.debugSetPose(id),
          referenceMatch: () => engine.debugReferenceMatch(),
          setReferenceImage: (dataUrl) => engine.debugSetReferenceImage(dataUrl),
        };
        window.__SDT3D__ = debugApi;
        engine.debugRequestPose(requestedPose && allowedPoses.has(requestedPose as CampingDebugPoseId)
          ? requestedPose as CampingDebugPoseId
          : null);
        // Explicit debug query is a local QA tool. The normal /camping experience
        // keeps its visible 808 keypad and does not expose this API by default.
        if (canvas.dataset.campingWebglStatus === "ready") {
          engine.pressAccessibleKey("8");
          engine.pressAccessibleKey("0");
          engine.pressAccessibleKey("8");
        }
      }
      const queuedKeys = pendingAccessKeysRef.current.splice(0);
      for (const key of queuedKeys) engine.pressAccessibleKey(key);
    } catch (error) {
      // A synchronous WebGL/Canvas/driver failure must not bubble into the root
      // TanStack boundary and turn the entire /camping route into HTTP/UI 500.
      // Keep the route mounted and expose its accessible fallback instead.
      const reason = error instanceof Error
        ? error.message
        : "Não foi possível iniciar o motor 3D neste dispositivo.";
      canvas.dataset.campingWebglStatus = "startup-error";
      canvas.dataset.campingWebglError = reason.slice(0, 400);
      try {
        engine.dispose();
      } catch {
        // Partial renderer initialisation can leave resources unavailable to dispose.
      }
      engineRef.current = null;
      pendingAccessKeysRef.current = [];
      setAssetState("error");
      setWebglError(reason);
    }
    return () => {
      pendingAccessKeysRef.current = [];
      if (debugApi && window.__SDT3D__ === debugApi) delete window.__SDT3D__;
      try {
        engine.dispose();
      } finally {
        if (engineRef.current === engine) engineRef.current = null;
      }
    };
  }, [closePanels, onClosePanels, rendererAttempt]);

  const retry3D = useCallback(() => {
    pendingAccessKeysRef.current = [];
    accessRef.current = { ...initialCampingAccessState };
    setAccess({ ...initialCampingAccessState });
    setWebglError(null);
    setMessage(null);
    setAssetState("idle");
    setRendererAttempt((attempt) => attempt + 1);
  }, []);

  const enterGuided = () => {
    setGuidedOpen((current) => !current);
  };

  const showAccessFallback = Boolean(webglError) && (access.phase === "LOCKED" || access.phase === "CODE_ENTRY");
  const statusMessage = message || (assetState === "loading" ? "A CARREGAR O ESTÚDIO…" : null);
  const isExploring = access.phase === "EXPLORATION" || access.phase === "INTERACTION_FOCUS";
  const hasAccess = access.phase !== "LOCKED" && access.phase !== "CODE_ENTRY" && access.phase !== "ERROR";

  const pressMove = (direction: (typeof directions)[number]["key"], active: boolean) => {
    engineRef.current?.setVirtualMovement(direction, active);
  };

  const refreshReferenceMatch = () => {
    const api = window.__SDT3D__;
    if (!api?.ready) {
      setDebugReferenceMessage("A aguardar a câmara, o modelo e a pose determinística.");
      return;
    }
    const result = api.referenceMatch();
    setDebugMatch(result);
    setDebugReferenceMessage(result.error ?? (
      result.score === null
        ? "A captura de referência não devolveu pontuação."
        : "Comparação concluída usando " + (result.referenceDataUrl ? "a imagem carregada" : "a referência privada por sectores") + "."
    ));
  };

  const loadReferenceImage = async (file: File | undefined) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      setDebugReferenceMessage("Formato não suportado. Escolha PNG, JPEG ou WebP.");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Falha ao ler imagem."));
      reader.onerror = () => reject(new Error("Falha ao ler imagem."));
      reader.readAsDataURL(file);
    }).catch((error: unknown) => {
      setDebugReferenceMessage(error instanceof Error ? error.message : "Falha ao ler imagem.");
      return "";
    });
    if (!dataUrl) return;
    const api = window.__SDT3D__;
    if (!api || !(await api.setReferenceImage(dataUrl))) {
      setDebugReferenceMessage("A imagem deve ter exactamente 1774×887 px para corresponder à referência original.");
      return;
    }
    setDebugReferenceUrl(dataUrl);
    setDebugReferenceMessage("Referência original carregada apenas nesta sessão de QA.");
    const result = api.referenceMatch();
    setDebugMatch(result);
  };

  return (
    <section
      className="camping-studio"
      aria-label="Experiência tridimensional do estúdio Xoyens"
    >
      <canvas
        key={rendererAttempt}
        ref={canvasRef}
        className="camping-studio__canvas"
        aria-label="Estúdio 3D. Arraste para olhar à volta e clique nos objectos identificados."
        tabIndex={0}
      />

      {debugOverlayEnabled && (
        <aside className="camping-refmatch" aria-label="Comparação da referência CAMPING">
          <header className="camping-refmatch__header">
            <div>
              <p className="camping-studio__micro-label">QA / REFERENCE MATCH</p>
              <h2>Fidelidade à referência</h2>
            </div>
            <button type="button" onClick={() => setDebugMatch(null)} aria-label="Fechar resultado da comparação">×</button>
          </header>
          <div className="camping-refmatch__actions">
            <button type="button" onClick={() => debugReferenceInput.current?.click()}>CARREGAR PANORÂMICA</button>
            <button type="button" onClick={refreshReferenceMatch}>CAPTURAR 3D / COMPARAR</button>
            <input
              ref={debugReferenceInput}
              className="camping-refmatch__file"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              aria-label="Carregar panorâmica de referência"
              onChange={(event) => void loadReferenceImage(event.currentTarget.files?.[0])}
            />
          </div>
          <p className="camping-refmatch__note">{debugReferenceMessage}</p>
          {debugMatch && (
            <>
              <div className="camping-refmatch__score">
                <span>referenceMatchScore</span>
                <strong>{debugMatch.score === null ? "N/D" : debugMatch.score.toFixed(1) + "/100"}</strong>
              </div>
              <div className="camping-refmatch__modes" role="group" aria-label="Modo de comparação">
                <button type="button" aria-pressed={debugOverlayMode === "side-by-side"} onClick={() => setDebugOverlayMode("side-by-side")}>A/B</button>
                <button type="button" aria-pressed={debugOverlayMode === "blend"} onClick={() => setDebugOverlayMode("blend")}>MISTURA</button>
                <button type="button" aria-pressed={debugOverlayMode === "diff"} onClick={() => setDebugOverlayMode("diff")}>DIFERENÇA ×4</button>
              </div>
              {debugOverlayMode === "blend" && debugReferenceUrl && (
                <label className="camping-refmatch__blend">
                  <span>Mistura A/B: {debugBlend}%</span>
                  <input type="range" min="0" max="100" value={debugBlend} onChange={(event) => setDebugBlend(Number(event.currentTarget.value))} />
                </label>
              )}
              {debugOverlayMode === "side-by-side" ? (
                <div className="camping-refmatch__images">
                  <figure>
                    {debugReferenceUrl ? <img src={debugReferenceUrl} alt="Panorâmica original" /> : <div className="camping-refmatch__missing">Carregue a imagem original para ver o lado A.</div>}
                    <figcaption>REFERÊNCIA</figcaption>
                  </figure>
                  <figure>
                    {debugMatch.renderedDataUrl && <img src={debugMatch.renderedDataUrl} alt="Panorâmica 3D capturada" />}
                    <figcaption>RENDER 3D</figcaption>
                  </figure>
                </div>
              ) : debugOverlayMode === "blend" ? (
                <div className="camping-refmatch__blend-view">
                  {debugReferenceUrl && <img src={debugReferenceUrl} alt="Referência para mistura" />}
                  {debugReferenceUrl && debugMatch.renderedDataUrl && (
                    <img className="camping-refmatch__blend-top" style={{ opacity: debugBlend / 100 }} src={debugMatch.renderedDataUrl} alt="Render 3D sobre a referência" />
                  )}
                  {!debugReferenceUrl && <p>Carregue a panorâmica original para activar a mistura.</p>}
                </div>
              ) : (
                <div className="camping-refmatch__diff-view">
                  {debugMatch.diffDataUrl
                    ? <img src={debugMatch.diffDataUrl} alt="Diferença absoluta ×4 entre referência e render 3D" />
                    : <p>Carregue a panorâmica original para calcular a diferença absoluta ×4.</p>}
                </div>
              )}
              <div className="camping-refmatch__worst">
                <strong>5 sectores com maior diferença</strong>
                {debugMatch.worst.length ? debugMatch.worst.map((row) => (
                  <span key={row.az + ":" + row.el}>{row.az.toFixed(0)}° / {row.el.toFixed(0)}° · ΔE {row.dE.toFixed(2)}</span>
                )) : <span>Sem dados de comparação.</span>}
              </div>
            </>
          )}
          <p className="camping-refmatch__source">Fonte privada de calibração: {debugMatch?.referenceSourceSha256 ?? "hash integrado no manifesto"}</p>
        </aside>
      )}

      <div className="camping-studio__vignette" aria-hidden="true" />
      <div className="camping-studio__grain" aria-hidden="true" />

      {isExploring && (
        <header className="camping-studio__header">
          <div className="camping-studio__identity">
            <img className="camping-studio__seal-image" src={sindicatoSelo.url} alt="Selo oficial do Sindicato" />
            <div>
              <p className="camping-studio__eyebrow">O SINDICATO DO TRAP</p>
              <p className="camping-studio__room">STUDIO XOYENS</p>
            </div>
          </div>
          <div className="camping-studio__header-right">
            <span className={"camping-studio__status camping-studio__status--" + (hasAccess ? "open" : "locked")}>
              <span className="camping-studio__status-dot" />
              {phaseLabel[access.phase]}
            </span>
            {day && (
              <span className="camping-studio__day">
                CAMP {String(day.current).padStart(2, "0")}/{String(day.total).padStart(2, "0")}
              </span>
            )}
          </div>
        </header>
      )}

      {isExploring && (
        <div className="camping-studio__side-label" aria-hidden="true">
          <span>808</span>
          <span>STUDIO XOYENS</span>
        </div>
      )}

      {(access.phase === "LOCKED" || access.phase === "CODE_ENTRY") && !showAccessFallback && (
        <div className="camping-studio__access-panel" aria-live="polite">
          <p className="camping-studio__micro-label">STUDIO XOYENS</p>
          <h1>808</h1>
          <p className="camping-studio__access-instruction">Código de acesso</p>
          <div className="camping-studio__code-slots" aria-label={"Código introduzido: " + (access.code || "vazio")}>
            {[0, 1, 2].map((slot) => (
              <span key={slot} className={slot < access.code.length ? "is-filled" : ""}>
                {access.code[slot] || "·"}
              </span>
            ))}
          </div>
        </div>
      )}

      {showAccessFallback && (
        <div className="camping-studio__fallback" role="region" aria-label="Acesso alternativo">
          <p className="camping-studio__micro-label">
            {webglError?.toLowerCase().includes("webgl") || webglError?.toLowerCase().includes("context")
              ? "WEBGL / RECUPERAÇÃO"
              : "STUDIO / RECUPERAÇÃO"}
          </p>
          <h2>ACESSO ALTERNATIVO</h2>
          <p>A inicialização automática falhou. Pode tentar arrancar novamente com uma configuração gráfica mais compatível ou abrir os registos públicos.</p>
          <button type="button" className="camping-studio__button" onClick={retry3D}>TENTAR INICIAR 3D</button>
          <button type="button" className="camping-studio__button camping-studio__button--quiet" onClick={onToggleRecords}>ABRIR REGISTOS PÚBLICOS</button>
          <button type="button" className="camping-studio__button camping-studio__button--quiet" onClick={onLeave}>SAIR DA EXPERIÊNCIA</button>
        </div>
      )}

      {["ACCESS_GRANTED", "DOOR_OPENING", "ENTERING_STUDIO"].includes(access.phase) && (
        <div className="camping-studio__transition" role="status" aria-live="assertive">
          <h2>{phaseLabel[access.phase]}</h2>
          <span className="camping-studio__transition-line"><span /></span>
          <p>{assetState === "loading" ? "A preparar o estúdio." : "Pode entrar."}</p>
        </div>
      )}

      {isExploring && (
        <div className="camping-studio__explore-state">
          <span className="camping-studio__micro-label">{roomCopy[currentRoom].code}</span>
          <strong>{access.phase === "INTERACTION_FOCUS" ? "OBJECT SELECTED" : roomCopy[currentRoom].title}</strong>
          <span className="camping-studio__explore-divider" />
          <span>{access.phase === "INTERACTION_FOCUS" ? access.focusedId?.toUpperCase().replace(/\./g, " / ") : roomCopy[currentRoom].subtitle}</span>
        </div>
      )}

      {hover && isExploring && (
        <div className="camping-studio__target-hint" role="status">
          <span className="camping-studio__target-cross">+</span>
          <div>
            <strong>{hover.label}</strong>
            <span>{hover.action}</span>
          </div>
        </div>
      )}

      <div className="camping-studio__custom-cursor" ref={cursorRef} aria-hidden="true">
        <span>+</span>
      </div>

      <footer className="camping-studio__controls">
        {isExploring && (
          <div className="camping-studio__control-copy">
            <span className="camping-studio__micro-label">MOVIMENTO</span>
            <p>WASD · rato · clique · ESC</p>
          </div>
        )}
        <div className="camping-studio__toolbar">
          <button type="button" onClick={enterGuided} aria-expanded={guidedOpen}>
            {guidedOpen ? "FECHAR GUIA" : "NAVEGAÇÃO GUIADA"}
          </button>
          <button type="button" onClick={onToggleRecords} aria-expanded={recordsOpen}>
            {recordsOpen ? "FECHAR REGISTOS" : "REGISTOS"}
          </button>
          {access.phase === "INTERACTION_FOCUS" && (
            <button type="button" onClick={() => engineRef.current?.returnFromFocus()}>VOLTAR</button>
          )}
          {isExploring && (
            <button type="button" onClick={() => engineRef.current?.returnToEntry()}>
              {currentRoom === "studio" ? "ENTRADA 808" : currentRoom === "archive" ? "ROOM 01 / ESTÚDIO" : "VOLTAR AO ARQUIVO"}
            </button>
          )}
          <button type="button" onClick={onLeave}>SAIR</button>
        </div>
      </footer>

      {isExploring && (
        <div className="camping-studio__touch-controls" aria-label="Controlos de movimento táctil">
          {directions.map((direction) => (
            <button
              key={direction.key}
              type="button"
              aria-label={direction.label}
              onPointerDown={(event) => {
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                pressMove(direction.key, true);
              }}
              onPointerUp={() => pressMove(direction.key, false)}
              onPointerCancel={() => pressMove(direction.key, false)}
              onLostPointerCapture={() => pressMove(direction.key, false)}
            >
              {direction.glyph}
            </button>
          ))}
        </div>
      )}

      {guidedOpen && (
        <aside className="camping-studio__guided" aria-label="Navegação guiada">
          <div className="camping-studio__panel-head">
            <div>
              <p className="camping-studio__micro-label">ACCESSIBILITY MODE / 808</p>
              <h2>NAVEGAÇÃO GUIADA</h2>
            </div>
            <button type="button" aria-label="Fechar navegação guiada" onClick={() => setGuidedOpen(false)}>×</button>
          </div>
          <p>Escolha um ponto. A câmara desloca-se suavemente sem exigir movimento livre.</p>
          <div className="camping-studio__guided-list">
            <button type="button" onClick={() => engineRef.current?.guideTo("entrance")}>ENTRADA / 808</button>
            {guidedPoints.map((point) => (
              <button type="button" key={point.id} onClick={() => engineRef.current?.guideTo(point.id)}>
                {point.label}
              </button>
            ))}
          </div>
          <button type="button" className="camping-studio__guided-records" onClick={onToggleRecords}>SESSÕES / LIVE / PRESENÇA</button>
        </aside>
      )}

      {access.phase === "ERROR" && (
        <div className="camping-studio__fallback" role="alert">
          <p className="camping-studio__micro-label">SIGNAL ERROR / ROOM 01</p>
          <h2>O ESTÚDIO NÃO CARREGOU</h2>
          <p>{webglError || "O modelo 3D não respondeu."}</p>
          <button type="button" className="camping-studio__button" onClick={() => engineRef.current?.retryStudioLoad()}>TENTAR NOVAMENTE</button>
          <button type="button" className="camping-studio__button camping-studio__button--quiet" onClick={onToggleRecords}>ABRIR REGISTOS PÚBLICOS</button>
        </div>
      )}

      {statusMessage && (
        <div className={"camping-studio__toast camping-studio__toast--" + messageTone} role="status" aria-live="polite">
          <span>{statusMessage}</span>
        </div>
      )}

      {access.phase === "INTERACTION_FOCUS" && access.focusedId && (
        <CampingObjectInterface
          focusedId={access.focusedId}
          onClose={() => engineRef.current?.returnFromFocus()}
          onEnterRoom={(roomId) => engineRef.current?.enterRoom(roomId)}
        />
      )}

      <span
        className="camping-studio__asset-state"
        aria-live="polite"
        data-camping-asset-state={assetState}
        data-camping-access-phase={access.phase}
      >
        MODEL / READY
      </span>
    </section>
  );
}
