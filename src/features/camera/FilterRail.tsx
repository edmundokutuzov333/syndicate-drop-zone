import { FILTER_REGISTRY } from "@/lib/webgl/filter-registry";
import { type FilterId, type MasterOverlayId } from "@/lib/camera/types";

type FilterRailProps = {
  selected: FilterId;
  onSelect: (filter: FilterId) => void;
  masterOverlays: Record<MasterOverlayId, boolean>;
  onToggleMasterOverlay: (id: MasterOverlayId) => void;
  locked?: boolean;
};

export function FilterRail({
  selected,
  onSelect,
  masterOverlays,
  onToggleMasterOverlay,
  locked = false,
}: FilterRailProps) {
  return (
    <div
      className="camera-filter-rail"
      aria-label="Filtros em tempo real"
    >
      {FILTER_REGISTRY.listVisible().map((filter) => (
        <button
          key={filter.id}
          type="button"
          className={
            "camera-filter " +
            (selected === filter.id ? "is-active" : "")
          }
          onClick={() => onSelect(filter.id)}
          disabled={locked || !filter.enabled}
          aria-pressed={selected === filter.id}
          aria-label={filter.label + ". Filtro em tempo real"}
        >
          <span>{filter.index}</span>
          <strong>{filter.label}</strong>
        </button>
      ))}

      <div className="camera-master-fx" aria-label="Master FX">
        <span className="camera-master-fx-label">MASTER FX</span>
        <button
          type="button"
          className={masterOverlays["cathode-crt"] ? "is-active" : ""}
          onClick={() => onToggleMasterOverlay("cathode-crt")}
          disabled={locked}
          aria-pressed={masterOverlays["cathode-crt"]}
        >
          CRT
        </button>
        <button
          type="button"
          className={masterOverlays["paper-film"] ? "is-active" : ""}
          onClick={() => onToggleMasterOverlay("paper-film")}
          disabled={locked}
          aria-pressed={masterOverlays["paper-film"]}
        >
          PAPER
        </button>
      </div>
    </div>
  );
}