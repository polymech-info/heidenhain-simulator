import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { LoaderCircle, Moon, Pause, Play, RotateCcw, Sun, MousePointer2, Move, Upload, ZoomIn } from "lucide-react";
import { DEFAULT_LOAD_ID } from "@/objects/registry";
import { createLoadFromFile } from "@/objects/fromMesh";
import type { LoadDefinition, LoadTruth } from "@/objects/types";
import { SimulatorCanvas, type NavMode } from "@/scene/SimulatorCanvas";
import { emptyScanUi, type ScanUi } from "@/scene/ScanRuntime";
import { ControlPanel } from "@/ui/ControlPanel";
import { DEFAULT_SIM_SPEED } from "@/sim/machine";
import {
  SCAN_ACT_AUTO,
  SCAN_CTRL_LAYERS_MAX,
  SCAN_CTRL_LAYERS_MIN,
  SCAN_CTRL_START_WRAPS_DEFAULT,
} from "@/algorithm/scanControl";
import { DT35 } from "@/sim/sensor";
import { applyTheme } from "@/theme";

export function App() {
  const [isDark, setIsDark] = useState(() =>
    typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : true,
  );
  const [navMode, setNavMode] = useState<NavMode>("orbit");
  const [playing, setPlaying] = useState(true);
  const [layers, setLayers] = useState(SCAN_CTRL_LAYERS_MIN);
  const [startWraps, setStartWraps] = useState(SCAN_CTRL_START_WRAPS_DEFAULT);
  const [fullSim, setFullSim] = useState(true);
  const [act, setAct] = useState(SCAN_ACT_AUTO);
  const [actToken, setActToken] = useState(0);
  const [noise, setNoise] = useState<number>(DT35.repeatabilitySigmaMm);
  const [dropout, setDropout] = useState(0.01);
  const [simSpeed, setSimSpeed] = useState<number>(DEFAULT_SIM_SPEED);
  const [loadId, setLoadId] = useState(DEFAULT_LOAD_ID);
  const [customLoad, setCustomLoad] = useState<LoadDefinition | null>(null);
  const [resetToken, setResetToken] = useState(0);
  const [ui, setUi] = useState<ScanUi>(() => emptyScanUi());
  const [truth, setTruth] = useState<LoadTruth>({ heightMm: 0, radiusMm: 0 });
  const [meshState, setMeshState] = useState<"idle" | "loading" | "error">("idle");
  const [meshMessage, setMeshMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const theme = params.get("theme");
    if (theme === "dark" || theme === "light") {
      applyTheme(theme);
      setIsDark(theme === "dark");
    } else if (!document.documentElement.classList.contains("dark")) {
      applyTheme("dark");
      setIsDark(true);
    }
  }, []);

  const onUi = useCallback((next: ScanUi) => setUi(next), []);
  const onTruth = useCallback((next: LoadTruth) => setTruth(next), []);

  const selectLoad = (id: string) => {
    setCustomLoad(null);
    setLoadId(id);
    setResetToken((n) => n + 1);
  };

  const reset = useCallback(() => setResetToken((n) => n + 1), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, select, textarea, button") || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.code === "Space") {
        event.preventDefault();
        setPlaying((value) => !value);
      } else if (event.key.toLowerCase() === "r") {
        reset();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [reset]);

  const onPickMesh = async (file: File | undefined) => {
    if (!file) return;
    try {
      const def = await createLoadFromFile(file);
      setCustomLoad(def);
      setLoadId(def.id);
      setResetToken((n) => n + 1);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err));
    }
  };

  const toolBtn = (active: boolean): CSSProperties => ({
    padding: "4px 8px",
    borderRadius: 4,
    background: active ? "var(--muted)" : "transparent",
    border: "none",
  });

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
      <header className="sim-topbar">
        <div className="sim-brand">
          <strong>WS212 wrapper</strong>
          <span>UP_DOWN_SCAN_GO Â· DT35-B15551</span>
        </div>
        <div className="sim-tools" role="toolbar" aria-label="Simulation controls">
          <div className="sim-seg">
            <button type="button" style={toolBtn(navMode === "orbit")} title="Orbit" onClick={() => setNavMode("orbit")}>
              <MousePointer2 size={16} className={navMode === "orbit" ? "text-primary" : "text-muted-foreground"} />
            </button>
            <button type="button" style={toolBtn(navMode === "pan")} title="Pan camera" aria-label="Pan camera" aria-pressed={navMode === "pan"} onClick={() => setNavMode("pan")}>
              <Move size={16} className={navMode === "pan" ? "text-primary" : "text-muted-foreground"} />
            </button>
            <button type="button" style={toolBtn(navMode === "zoom")} title="Zoom camera" aria-label="Zoom camera" aria-pressed={navMode === "zoom"} onClick={() => setNavMode("zoom")}>
              <ZoomIn size={16} className={navMode === "zoom" ? "text-primary" : "text-muted-foreground"} />
            </button>
          </div>
          <div className="sim-seg">
            <button type="button" onClick={() => setPlaying((v) => !v)} title={playing ? "Pause" : "Play"}>
              {playing ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <button type="button" onClick={reset} title="Reset scan (R)" aria-label="Reset scan">
              <RotateCcw size={16} />
            </button>
          </div>
          <label className="sim-file">
            Meshâ€¦
            <input
              type="file"
              accept=".stl,.obj,.gltf,.glb,.ply"
              hidden
              onChange={(e) => {
                onPickMesh(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <button
            type="button"
            className="sim-icon"
            onClick={() => {
              const next = isDark ? "light" : "dark";
              applyTheme(next);
              setIsDark(!isDark);
            }}
            title={isDark ? "Use light theme" : "Use dark theme"}
            aria-label={isDark ? "Use light theme" : "Use dark theme"}
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <div className="relative min-h-0 min-w-0 flex-1">
          <SimulatorCanvas
            loadId={customLoad ? customLoad.id : loadId}
            customLoad={customLoad}
            playing={playing}
            pot01={(layers - SCAN_CTRL_LAYERS_MIN) / (SCAN_CTRL_LAYERS_MAX - SCAN_CTRL_LAYERS_MIN)}
            startWraps={startWraps}
            fullSim={fullSim}
            act={act}
            actToken={actToken}
            noiseSigmaMm={noise}
            dropout={dropout}
            ui={ui}
            navMode={navMode}
            resetToken={resetToken}
            isDark={isDark}
            simSpeed={simSpeed}
            onUi={onUi}
            onTruth={onTruth}
          />
        </div>
        <ControlPanel
          isDark={isDark}
          simSpeed={simSpeed}
          onSimSpeed={setSimSpeed}
          loadId={customLoad ? customLoad.id : loadId}
          onLoadId={selectLoad}
          layers={layers}
          onLayers={setLayers}
          startWraps={startWraps}
          onStartWraps={setStartWraps}
          fullSim={fullSim}
          onFullSim={setFullSim}
          onAct={(next) => {
            setPlaying(true);
            setAct(next);
            setActToken((n) => n + 1);
          }}
          noiseSigmaMm={noise}
          onNoise={setNoise}
          dropout={dropout}
          onDropout={setDropout}
          ui={ui}
          truth={truth}
        />
      </div>
    </div>
  );
}

