import type { Vec3 } from "@/machine/machine";
import type { Trace } from "@/machine/machine";
import { TOOLPATH_MODES, type ToolpathMode } from "@/scene/PathView";
import { MESH_PRESETS, type MeshPreset } from "@/scene/stockRemoval";

const MESH_LABEL: Record<MeshPreset, string> = {
  coarse: "Coarse",
  medium: "Medium",
  fine: "Fine",
};

type Props = {
  trace: Trace | null;
  fileName: string | null;
  block: number;
  pose: Vec3;
  pathMode: ToolpathMode;
  onPathMode: (mode: ToolpathMode) => void;
  showMaterial: boolean;
  onShowMaterial: (show: boolean) => void;
  mesh: MeshPreset;
  onMesh: (mesh: MeshPreset) => void;
  onSeek: (index: number) => void;
};

function fmtDia(n: number) {
  return n.toFixed(2).replace(/\.?0+$/, "");
}

function fmt(n: number) {
  return n.toFixed(3);
}

export function ProgramPanel({
  trace,
  fileName,
  block,
  pose,
  pathMode,
  onPathMode,
  showMaterial,
  onShowMaterial,
  mesh,
  onMesh,
  onSeek,
}: Props) {
  const snap = trace?.snapshots[block];
  const diameter = snap?.tool != null ? trace?.toolDiameter[snap.tool] : undefined;

  const pathOptions = (
    <section>
      <h2>Toolpath</h2>
      <div className="sim-opts" role="group" aria-label="Toolpath">
        {TOOLPATH_MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            className={pathMode === mode.id ? "is-active" : ""}
            aria-pressed={pathMode === mode.id}
            onClick={() => onPathMode(mode.id)}
          >
            {mode.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        className={`sim-material${showMaterial ? " is-active" : ""}`}
        aria-pressed={showMaterial}
        onClick={() => onShowMaterial(!showMaterial)}
      >
        Material
      </button>
      <div className="sim-opts" role="group" aria-label="Mesh density">
        {(Object.keys(MESH_PRESETS) as MeshPreset[]).map((preset) => (
          <button
            key={preset}
            type="button"
            className={mesh === preset ? "is-active" : ""}
            aria-pressed={mesh === preset}
            onClick={() => onMesh(preset)}
          >
            {MESH_LABEL[preset]}
          </button>
        ))}
      </div>
    </section>
  );

  if (!trace) {
    return (
      <aside className="sim-panel">
        {pathOptions}
        <p className="sim-note">Choose a sample on the left, or drop a .h program on the view.</p>
      </aside>
    );
  }

  const moves = Math.max(0, trace.points.length - 1);
  const stock = trace.stock;

  return (
    <aside className="sim-panel">
      <section>
        <h2>Program</h2>
        <p className="sim-mode">
          <strong>{trace.programName ?? fileName ?? "Program"}</strong>
          <span>
            {trace.unit ?? "unit unset"}
            {trace.unit === "INCH" ? " · shown in mm" : ""}
            {" · "}
            {trace.blocks.length} blocks · {moves} moves
          </span>
        </p>
        {fileName ? <p className="sim-note">{fileName}</p> : null}
      </section>

      <section>
        <h2>Tool</h2>
        <dl className="sim-stats">
          <div>
            <dt>X</dt>
            <dd>{fmt(pose.x)}</dd>
          </div>
          <div>
            <dt>Y</dt>
            <dd>{fmt(pose.y)}</dd>
          </div>
          <div>
            <dt>Z</dt>
            <dd>{fmt(pose.z)}</dd>
          </div>
          <div>
            <dt>Feed</dt>
            <dd>{snap?.feed == null ? "—" : snap.feed.toFixed(0)}</dd>
          </div>
          <div>
            <dt>D mm</dt>
            <dd>{diameter == null ? "—" : `Ø${fmtDia(diameter)}`}</dd>
          </div>
        </dl>
        <div className="sim-coils">
          <span className={snap?.tool != null ? "sim-lamp is-on" : "sim-lamp"}>
            <i />
            T{snap?.tool ?? "—"}
          </span>
          <span className={snap?.spindleOn ? "sim-lamp is-on" : "sim-lamp"}>
            <i />
            S{snap?.spindle ?? "—"}
          </span>
          <span className={snap?.coolant ? "sim-lamp is-on" : "sim-lamp"}>
            <i />
            M8
          </span>
        </div>
        {snap?.cycle ? <p className="sim-note">Active cycle {snap.cycle}</p> : null}
        {stock ? (
          <p className="sim-note">
            Stock {Math.abs(stock.max.x - stock.min.x).toFixed(1)} × {Math.abs(stock.max.y - stock.min.y).toFixed(1)} ×{" "}
            {Math.abs(stock.max.z - stock.min.z).toFixed(1)} mm
          </p>
        ) : (
          <p className="sim-note">No BLK FORM</p>
        )}
      </section>

      {pathOptions}

      {trace.gaps.length > 0 || trace.notes.length > 0 ? (
        <section>
          <h2>Not simulated</h2>
          {trace.gaps.length > 0 ? (
            <ul className="sim-gaps">
              {trace.gaps.map((gap) => (
                <li key={gap.head}>
                  <button type="button" onClick={() => onSeek(gap.first)}>
                    {gap.head}
                    <span>{gap.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {trace.notes.length > 0 ? (
            <ul className="sim-notes">
              {trace.notes.slice(0, 12).map((note, i) => (
                <li key={`${note.block}-${i}`}>
                  <button type="button" onClick={() => onSeek(note.block)}>
                    {note.text}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {trace.notes.length > 12 ? <p className="sim-note">{trace.notes.length - 12} more notes</p> : null}
        </section>
      ) : null}
    </aside>
  );
}
