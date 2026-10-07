import { FILTER_REGISTRY } from "@/lib/webgl/filter-registry";
import { type FilterId } from "@/lib/camera/types";

type FilterRailProps = {
  selected: FilterId;
  onSelect: (filter: FilterId) => void;
};

export function FilterRail({ selected, onSelect }: FilterRailProps) {
  return (
    <div className="camera-filter-rail" aria-label="Filtros">
      {FILTER_REGISTRY.listVisible().map((filter) => (
        <button
          key={filter.id}
          type="button"
          className={`camera-filter ${selected === filter.id ? "is-active" : ""}`}
          onClick={() => onSelect(filter.id)}
          disabled={!filter.enabled}
          aria-label={`${filter.label}. Disponível na Fase 2`}
        >
          <span>{filter.index}</span>
          <strong>{filter.label}</strong>
        </button>
      ))}
    </div>
  );
}
