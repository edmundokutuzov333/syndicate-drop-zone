import { useEffect, useState } from "react";

type CapturePreviewProps = {
  result: { url: string; mimeType: string } | null;
  onClose: () => void;
};

export function CapturePreview({ result, onClose }: CapturePreviewProps) {
  const [objectUrl] = useState(result?.url ?? "");
  useEffect(() => () => {
    if (objectUrl.startsWith("blob:")) URL.revokeObjectURL(objectUrl);
  }, [objectUrl]);
  if (!result) return null;
  return (
    <div className="camera-preview">
      <div className="camera-preview-head">
        <span>CAPTURE RESULT</span>
        <button type="button" onClick={onClose}>CLOSE</button>
      </div>
      <a href={objectUrl} download={`sindicato-camera.${result.mimeType.includes("mp4") ? "mp4" : "webm"}`}>SAVE LOCAL</a>
    </div>
  );
}
