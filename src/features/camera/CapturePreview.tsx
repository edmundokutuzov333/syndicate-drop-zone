type CapturePreviewProps = {
  result: {
    url: string;
    mimeType: string;
    mode: "photo" | "video";
    format: string;
    filename: string;
    width: number;
    height: number;
    durationMs?: number;
  } | null;
  onClose: () => void;
};

export function CapturePreview({ result, onClose }: CapturePreviewProps) {
  if (!result) return null;

  const isVideo = result.mode === "video" || result.mimeType.startsWith("video/");
  const duration =
    result.durationMs !== undefined
      ? `${(result.durationMs / 1000).toFixed(1)}S`
      : null;

  return (
    <div className="camera-preview" role="dialog" aria-modal="true" aria-label="Resultado da captura">
      <div className="camera-preview-head">
        <div>
          <span className="camera-preview-kicker">CAPTURE RESULT</span>
          <strong title={result.filename}>{result.filename}</strong>
        </div>
        <button
          type="button"
          className="camera-preview-close"
          onClick={onClose}
        >
          CLOSE
        </button>
      </div>

      <div className="camera-preview-stage">
        {isVideo ? (
          <video
            src={result.url}
            controls
            playsInline
            preload="metadata"
            aria-label="Pré-visualização do vídeo capturado"
          />
        ) : (
          <img
            src={result.url}
            alt="Pré-visualização da fotografia capturada"
          />
        )}
      </div>

      <div className="camera-preview-meta">
        <span>{result.format.toUpperCase()}</span>
        <span>{result.width}×{result.height}</span>
        <span>{result.mimeType}</span>
        {duration ? <span>{duration}</span> : null}
      </div>

      <div className="camera-preview-actions">
        <button
          type="button"
          className="camera-preview-dismiss"
          onClick={onClose}
        >
          NEW CAPTURE
        </button>
        <a
          className="camera-preview-download"
          href={result.url}
          download={result.filename}
        >
          DOWNLOAD
        </a>
      </div>

      <p className="camera-preview-note">
        LOCAL ONLY · THE ORIGINAL CAPTURE STAYS IN THIS BROWSER UNTIL CLOSED.
      </p>
    </div>
  );
}
