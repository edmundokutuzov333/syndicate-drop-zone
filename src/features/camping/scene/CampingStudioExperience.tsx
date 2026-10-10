import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CampingAccessState } from "../interactions/access-machine";
import type { CampingRoomId } from "./CampingRoomWorld";
import { initialCampingAccessState } from "../interactions/access-machine";
import sindicatoSelo from "@/assets/brand/sindicato-selo.png.asset.json";
import { CampingStudioEngine } from "./CampingStudioEngine";
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
  const [guidedOpen, setGuidedOpen] = useState(false);
  const [currentRoom, setCurrentRoom] = useState<CampingRoomId>("studio");

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
    engine.mount(canvas);
    const queuedKeys = pendingAccessKeysRef.current.splice(0);
    for (const key of queuedKeys) engine.pressAccessibleKey(key);
    return () => {
      pendingAccessKeysRef.current = [];
      engine.dispose();
      engineRef.current = null;
    };
  }, [closePanels, onClosePanels]);

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

  return (
    <section
      className="camping-studio"
      aria-label="Experiência tridimensional do estúdio Xoyens"
    >
      <canvas
        ref={canvasRef}
        className="camping-studio__canvas"
        aria-label="Estúdio 3D. Arraste para olhar à volta e clique nos objectos identificados."
        tabIndex={0}
      />

      <div className="camping-studio__vignette" aria-hidden="true" />
      <div className="camping-studio__grain" aria-hidden="true" />

      <header className="camping-studio__header">
        <div className="camping-studio__identity">
          <img className="camping-studio__seal-image" src={sindicatoSelo.url} alt="Selo oficial do Sindicato" />
          <div>
            <p className="camping-studio__eyebrow">O SINDICATO DO TRAP</p>
            <p className="camping-studio__room">STUDIO XOYENS</p>
          </div>
        </div>
        {isExploring && (
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
        )}
      </header>

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
          <p className="camping-studio__micro-label">WEBGL NOT AVAILABLE</p>
          <h2>ACESSO ALTERNATIVO</h2>
          <p>O browser não conseguiu iniciar a cena 3D. Pode introduzir o código por teclado ou usar os registos públicos sem perder o acesso ao resto do site.</p>
          <button type="button" className="camping-studio__button" onClick={onToggleRecords}>ABRIR REGISTOS PÚBLICOS</button>
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

      <span className="camping-studio__asset-state" aria-live="polite">
        {assetState === "loading" && hasAccess ? "LOADING / GLB" : assetState === "ready" && hasAccess ? "MODEL / READY" : ""}
      </span>
    </section>
  );
}
