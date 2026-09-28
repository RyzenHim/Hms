import type { Stamp, StampPlacement } from "../../types/report";

interface ReusableStampProps {
  stamp: Stamp;
  image: string;
  placement: StampPlacement;
}

const filterStyle = (filter: StampPlacement["filter"]) => {
  if (filter === "grayscale") return "grayscale(100%)";
  if (filter === "sepia") return "sepia(100%)";
  if (filter === "brightness") return "brightness(1.2)";
  return "none";
};

export function ReusableStamp({
  stamp,
  image,
  placement,
}: ReusableStampProps) {
  return (
    <div
      className="absolute pointer-events-none z-20"
      style={{
        left: `${placement.x}%`,
        top: `${placement.y}%`,
        transform: `translate(-50%, -50%) rotate(${placement.rotation}deg)`,
        width: `${placement.size}%`,
        opacity: placement.opacity,
        filter: filterStyle(placement.filter),
      }}
    >
      <img
        src={image}
        alt={stamp.label}
        className="w-full h-full object-contain select-none"
      />
    </div>
  );
}

interface StampPlacementEditorProps {
  placement: StampPlacement;
  onChange: <K extends keyof StampPlacement>(
    key: K,
    value: StampPlacement[K],
  ) => void;
  onRemove: () => void;
}

export function StampPlacementEditor({
  placement,
  onChange,
  onRemove,
}: StampPlacementEditorProps) {
  return (
    <details
      open
      className="rounded-lg border border-sky-900/60 bg-sky-950/10 p-2.5"
    >
      <summary className="cursor-pointer text-[11px] font-bold text-sky-300">
        Page {placement.page} placement
      </summary>
      <div className="mt-3 space-y-3">
        <div>
          <label className="block text-[10px] font-semibold text-slate-500 mb-1">
            Size ({placement.size}% of page width)
          </label>
          <input
            type="range"
            min="5"
            max="30"
            step="1"
            value={placement.size}
            onChange={(event) =>
              onChange("size", Number.parseInt(event.target.value))
            }
            className="w-full accent-sky-500"
          />
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-slate-500 mb-1">
            Opacity ({Math.round(placement.opacity * 100)}%)
          </label>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            value={placement.opacity}
            onChange={(event) =>
              onChange("opacity", Number.parseFloat(event.target.value))
            }
            className="w-full accent-sky-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">
              X Position ({placement.x}%)
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={placement.x}
              onChange={(event) =>
                onChange("x", Number.parseInt(event.target.value))
              }
              className="w-full accent-sky-500"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">
              Y Position ({placement.y}%)
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={placement.y}
              onChange={(event) =>
                onChange("y", Number.parseInt(event.target.value))
              }
              className="w-full accent-sky-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-slate-500 mb-1">
            Rotation ({placement.rotation}°)
          </label>
          <input
            type="range"
            min="-180"
            max="180"
            step="5"
            value={placement.rotation}
            onChange={(event) =>
              onChange("rotation", Number.parseInt(event.target.value))
            }
            className="w-full accent-sky-500"
          />
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-slate-500 mb-1">
            Filter Effect
          </label>
          <select
            value={placement.filter}
            onChange={(event) =>
              onChange(
                "filter",
                event.target.value as StampPlacement["filter"],
              )
            }
            className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
          >
            <option value="none">None</option>
            <option value="grayscale">Grayscale</option>
            <option value="sepia">Sepia</option>
            <option value="brightness">Brightness</option>
          </select>
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="w-full rounded border border-red-500/50 bg-red-500/10 px-2 py-1 text-[10px] font-semibold text-red-300 hover:bg-red-500/20"
        >
          Remove from page {placement.page}
        </button>
      </div>
    </details>
  );
}
