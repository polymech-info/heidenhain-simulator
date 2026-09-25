import { useState, type ReactNode } from "react";
import { LOAD_CATALOG } from "@/objects/registry";
import type { LoadTruth } from "@/objects/types";
import type { ScanUi } from "@/scene/ScanRuntime";
import { PolarPlot } from "@/ui/PolarPlot";
import { SectionCuts } from "@/ui/SectionCuts";
import { DT35 } from "@/sim/sensor";
import { SIM_SPEED_STEPS, TABLE_T_REV_S, WINDER_T_HEIGHT_S } from "@/sim/machine";
import {
  SCAN_ACT_AUTO,
  SCAN_ACT_BAND,
  SCAN_ACT_HOME,
  SCAN_ACT_SCAN,
  SCAN_ACT_STOP,
  SCAN_ACT_WRAP_DOWN,
  SCAN_ACT_WRAP_UP,
  SCAN_ACT_ZIGZAG,
  SCAN_CTRL_FILM_MM,
  SCAN_CTRL_LAYERS_MAX,
  SCAN_CTRL_LAYERS_MIN,
  SCAN_CTRL_START_WRAPS_MAX,
  SCAN_CTRL_START_WRAPS_MIN,
  SCAN_CTRL_T_REV_S,
} from "@/algorithm/scanControl";

type Props = {
  loadId: string;
  onLoadId: (id: string) => void;
  layers: number;
  onLayers: (v: number) => void;
  startWraps: number;
  onStartWraps: (v: number) => void;
  fullSim: boolean;
  onFullSim: (v: boolean) => void;
  onAct: (act: number) => void;
  noiseSigmaMm: number;
  onNoise: (v: number) => void;
  dropout: number;
  onDropout: (v: number) => void;
  ui: ScanUi;
  truth: LoadTruth;
  isDark: boolean;
  simSpeed: number;
  onSimSpeed: (v: number) => void;
};

function mm(n: number): string {
  return `${n.toFixed(0)} mm`;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="sim-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Lamp({ on, label }: { on: number; label: string }) {
  return (
    <span className={`sim-lamp${on ? " is-on" : ""}`}>
      <i />
      {label}
    </span>
  );
}

export function ControlPanel({
  loadId,
  onLoadId,
  layers,
  onLayers,
  startWraps,
  onStartWraps,
  onAct,
  noiseSigmaMm,
  onNoise,
  dropout,
  onDropout,
  ui,
  truth,
  isDark,
  simSpeed,
  onSimSpeed,
}: Props) {
  const e = ui.estimate;
  const c = ui.ctrl;
  const [estTab, setEstTab] = useState<"top" | "cuts">("top");
  const idle = c.stateName === "STOPPED" || c.stateName === "FINISHED" || c.stateName === "ERROR";
  return (
    <aside className="sim-panel">
      <section>
        <h2>UP_DOWN_SCAN_GO</h2>
        <p className="sim-note">
          Table {TABLE_T_REV_S} s/rev · winder {WINDER_T_HEIGHT_S} s full height · folie {SCAN_CTRL_FILM_MM} mm
        </p>
        <div className="sim-mode">
          <strong>{c.stateName}</strong>
          <span>
            {c.actName !== "NONE" ? `${c.actName} · ` : ""}
            {c.measuring
              ? `${c.modeName} · miss + 10%`
              : c.wrapping
                ? `${c.modeName} · band ${c.startWraps} · ${c.wraps} spiral · ${c.heightMm.toFixed(0)} mm`
                : c.stateName === "ERROR"
                  ? c.modeName
                  : "scan · auto · wrap · band · zigzag"}
          </span>
        </div>
        <div className="sim-coils">
          <Lamp on={c.kTable} label="K_TABLE" />
          <Lamp on={c.kUp} label="K_UP" />
          <Lamp on={c.kDown} label="K_DOWN" />
          <Lamp on={c.esBot} label="ES_BOT" />
          <Lamp on={c.esTop} label="ES_TOP" />
        </div>
        <div className="sim-acts">
          <button type="button" className="sim-go" onClick={() => onAct(SCAN_ACT_AUTO)} disabled={!idle}>
            AUTO
          </button>
          <button type="button" onClick={() => onAct(SCAN_ACT_HOME)} disabled={!idle}>
            HOME
          </button>
          <button type="button" onClick={() => onAct(SCAN_ACT_SCAN)} disabled={!idle}>
            SCAN
          </button>
          <button type="button" onClick={() => onAct(SCAN_ACT_WRAP_UP)} disabled={!idle}>
            WRAP UP
          </button>
          <button type="button" onClick={() => onAct(SCAN_ACT_WRAP_DOWN)} disabled={!idle}>
            WRAP DOWN
          </button>
          <button type="button" onClick={() => onAct(SCAN_ACT_ZIGZAG)} disabled={!idle}>
            ZIGZAG
          </button>
          <button type="button" onClick={() => onAct(SCAN_ACT_BAND)} disabled={!idle}>
            BAND
          </button>
          <button type="button" className="is-stop" onClick={() => onAct(SCAN_ACT_STOP)} disabled={idle && c.stateName === "STOPPED"}>
            STOP
          </button>
        </div>
        <Field label={`Band wraps ${startWraps} (${(startWraps * SCAN_CTRL_T_REV_S).toFixed(0)} s hoops at current Z)`}>
          <input
            type="range"
            min={SCAN_CTRL_START_WRAPS_MIN}
            max={SCAN_CTRL_START_WRAPS_MAX}
            step={1}
            value={startWraps}
            onChange={(ev) => onStartWraps(Number(ev.target.value))}
          />
        </Field>
        <Field label={layers <= 1 ? "Layers 1 (continuous)" : `Layers ${layers} (1 continuous … ${SCAN_CTRL_LAYERS_MAX})`}>
          <input
            type="range"
            min={SCAN_CTRL_LAYERS_MIN}
            max={SCAN_CTRL_LAYERS_MAX}
            step={1}
            value={layers}
            onChange={(ev) => onLayers(Number(ev.target.value))}
          />
        </Field>
      </section>

      <section>
        <h2>Load</h2>
        <div className="sim-palette">
          {LOAD_CATALOG.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === loadId ? "is-active" : ""}
              onClick={() => onLoadId(item.id)}
            >
              <strong>{item.name}</strong>
              <span>{item.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>DT35 noise</h2>
        <p className="sim-note">
          {DT35.part} · {DT35.minRangeMm}–{DT35.maxRangeMm90} mm · σ ≥ {DT35.repeatabilitySigmaMm} mm · typ ±
          {DT35.accuracyTypMm} mm
        </p>
        <Field label={`σ ${noiseSigmaMm.toFixed(1)} mm`}>
          <input type="range" min={0} max={8} step={0.1} value={noiseSigmaMm} onChange={(ev) => onNoise(Number(ev.target.value))} />
        </Field>
        <Field label={`Dropout ${(dropout * 100).toFixed(0)}%`}>
          <input type="range" min={0} max={0.15} step={0.005} value={dropout} onChange={(ev) => onDropout(Number(ev.target.value))} />
        </Field>
      </section>

      <section>
        <h2>Estimate</h2>
        <dl className="sim-stats">
          <div>
            <dt>Height</dt>
            <dd>
              {mm(e.heightMm)}
              <small>truth {mm(truth.heightMm)}</small>
            </dd>
          </div>
          <div>
            <dt>Radius</dt>
            <dd>
              {mm(e.radiusMm)}
              <small>truth {mm(truth.radiusMm)}</small>
            </dd>
          </div>
          <div>
            <dt>Hits</dt>
            <dd>
              {e.hitCount}
              <small>{e.sampleCount} samples</small>
            </dd>
          </div>
          <div>
            <dt>Beam</dt>
            <dd>
              {ui.lastValid ? mm(ui.lastDistanceMm) : "miss"}
              <small>Z {mm(ui.zMm)}</small>
            </dd>
          </div>
        </dl>
        <div className="sim-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={estTab === "top"} className={estTab === "top" ? "is-active" : ""} onClick={() => setEstTab("top")}>
            Top
          </button>
          <button type="button" role="tab" aria-selected={estTab === "cuts"} className={estTab === "cuts" ? "is-active" : ""} onClick={() => setEstTab("cuts")}>
            Section cuts
          </button>
        </div>
        {estTab === "top" ? (
          <>
            <Field label={`Sim speed ×${simSpeed}`}>
              <input
                type="range"
                min={0}
                max={SIM_SPEED_STEPS.length - 1}
                step={1}
                value={Math.max(0, SIM_SPEED_STEPS.findIndex((s) => s === simSpeed))}
                onChange={(ev) => onSimSpeed(SIM_SPEED_STEPS[Number(ev.target.value)] ?? 1)}
              />
              <span className="sim-speed-ticks">
                {SIM_SPEED_STEPS.map((s) => (
                  <em key={s} className={s === simSpeed ? "is-active" : ""}>
                    {s === 1 ? "1" : String(s)}
                  </em>
                ))}
              </span>
            </Field>
            <PolarPlot isDark={isDark} polar={ui.polar} radiusMm={Math.max(e.radiusMm, truth.radiusMm)} />
          </>
        ) : (
          <SectionCuts
            isDark={isDark}
            sectionX={ui.sectionX}
            sectionY={ui.sectionY}
            radiusMm={Math.max(e.radiusMm, truth.radiusMm)}
            zMm={ui.zMm}
          />
        )}
      </section>
    </aside>
  );
}
