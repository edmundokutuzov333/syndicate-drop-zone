import { FILTER_REGISTRY } from "@/lib/webgl/filter-registry";
import { type FilterDefinition, type FilterId, type MasterOverlayId } from "@/lib/camera/types";

type FilterRailProps = {
  selected: FilterId;
  onSelect: (filter: FilterId) => void;
  masterOverlays: Record<MasterOverlayId, boolean>;
  onToggleMasterOverlay: (id: MasterOverlayId) => void;
  locked?: boolean;
};

function FilterButton({
  filter,
  selected,
  onSelect,
  locked,
}: {
  filter: FilterDefinition;
  selected: FilterId;
  onSelect: (filter: FilterId) => void;
  locked: boolean;
}) {
  return (
    <button
      type="button"
      className={"camera-filter " + (selected === filter.id ? "is-active" : "")}
      onClick={() => onSelect(filter.id)}
      disabled={locked || !filter.enabled}
      aria-pressed={selected === filter.id}
      aria-label={filter.label + ". Filtro em tempo real"}
    >
      <span>{filter.index}</span>
      <strong>{filter.label}</strong>
    </button>
  );
}

export function FilterRail({
  selected,
  onSelect,
  masterOverlays,
  onToggleMasterOverlay,
  locked = false,
}: FilterRailProps) {
  const filters = FILTER_REGISTRY.listVisible();
  const originalFilters = filters.filter((filter) => Number(filter.index) <= 15);
  const signalFilters = filters.filter((filter) => Number(filter.index) >= 16);

  return (
    <section className="camera-filter-browser" aria-label="Biblioteca de filtros em tempo real">
      <div className="camera-filter-rail">
        <div className="camera-filter-family">
          <div className="camera-filter-family-head">
            <span>01-15</span>
            <strong>ORIGINALS</strong>
            <small>CORE LIBRARY</small>
          </div>
          <div className="camera-filter-family-list" role="group" aria-label="Filtros originais, 01 a 15">
            {originalFilters.map((filter) => (
              <FilterButton key={filter.id} filter={filter} selected={selected} onSelect={onSelect} locked={locked} />
            ))}
          </div>
        </div>

        <div className="camera-filter-family">
          <div className="camera-filter-family-head">
            <span>16-22</span>
            <strong>SIGNAL LAB</strong>
            <small>DEDICATED ENGINES</small>
          </div>
          <div className="camera-filter-family-list" role="group" aria-label="Novos motores de sinal, 16 a 22">
            {signalFilters.map((filter) => (
              <FilterButton key={filter.id} filter={filter} selected={selected} onSelect={onSelect} locked={locked} />
            ))}
          </div>
        </div>

        <div className="camera-filter-footer">
          <span className="camera-filter-count">{filters.length.toString().padStart(2, "0")} FILTERS // LIVE ENGINE</span>
          <div className="camera-master-fx" aria-label="Efeitos globais opcionais">
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
      </div>
    </section>
  );
}
