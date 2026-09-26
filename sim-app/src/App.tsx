import { useCallback, useEffect, useRef, useState, type CSSProperties, type DragEvent } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Moon, MousePointer2, Move, Pause, Play, RotateCcw, SkipBack, SkipForward, Sun, Upload, ZoomIn } from "lucide-react";
import { parseKlartext } from "@/lang/parse";
import type { Vec3 } from "@/machine/machine";
import type { Trace } from "@/machine/machine";
import { runProgram } from "@/machine/run";
import { loadViewPrefs, saveViewPrefs } from "@/prefs";
import { PathView, blockAt, type NavMode } from "@/scene/PathView";
import { openLibrary, type Library } from "@/storage/library";
import { hasFile } from "@/storage/tree";
import { applyTheme } from "@/theme";
import { BlockPanel } from "@/ui/BlockPanel";
import { ProgramPanel } from "@/ui/ProgramPanel";
import { SampleBrowser } from "@/ui/SampleBrowser";

const ORIGIN: Vec3 = { x: 0, y: 0, z: 0 };

function sampleFromPath(pathname: string): string | null {
  if (!pathname.startsWith("/file/")) return null;
  try {
    const file = decodeURIComponent(pathname.slice("/file/".length)).replace(/^\/+/, "");
    return file || null;
  } catch {
    return null;
  }
}

export function App() {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));
  const [navMode, setNavMode] = useState<NavMode>("orbit");
  const [view, setView] = useState(loadViewPrefs);
  const { pathMode, showMaterial, mesh } = view;
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [trace, setTrace] = useState<Trace | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [sampleFile, setSampleFile] = useState<string | null>(null);
  const [block, setBlock] = useState(0);
  const [pose, setPose] = useState<Vec3>(ORIGIN);
  const [seek, setSeek] = useState<{ block: number; token: number; dist?: number } | null>(null);
  const [along, setAlong] = useState(0);
  const [hot, setHot] = useState(false);
  const [error, setError] = useState("");
  const seekToken = useRef(0);
  const scrubbing = useRef(false);
  const booted = useRef(false);
  const dropped = useRef(false);
  const [library, setLibrary] = useState<Library | null>(null);
  const libraryRef = useRef<Library | null>(null);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const urlFile = sampleFromPath(pathname);
  const blockRef = useRef(0);
  const traceRef = useRef<Trace | null>(null);
  blockRef.current = block;
  traceRef.current = trace;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const theme = params.get("theme");
    if (theme === "dark" || theme === "light") {
      applyTheme(theme);
      setIsDark(theme === "dark");
    }
  }, []);

  useEffect(() => {
    saveViewPrefs(view);
  }, [view]);

  const seekTo = useCallback((index: number) => {
    const current = traceRef.current;
    const count = current?.blocks.length ?? 0;
    const next = count === 0 ? 0 : Math.min(count - 1, Math.max(0, index));
    const end = current?.blockEnd[next] ?? 0;
    seekToken.current += 1;
    setBlock(next);
    setAlong(current?.clock[end] ?? 0);
    setSeek({ block: next, token: seekToken.current });
  }, []);

  const seekAlong = useCallback((value: number) => {
    const current = traceRef.current;
    if (!current) return;
    const total = current.clock[current.clock.length - 1] ?? 0;
    const dist = Math.min(total, Math.max(0, value));
    const index = blockAt(current, dist);
    seekToken.current += 1;
    setBlock(index);
    setAlong(dist);
    setSeek({ block: index, token: seekToken.current, dist });
  }, []);

  const loadText = useCallback(
    (name: string, text: string) => {
      if (text.includes("\0")) {
        setError("That file is not Klartext text.");
        return;
      }
      const program = parseKlartext(text);
      if (program.blocks.length === 0) {
        setError("No blocks in that file.");
        return;
      }
      const next = runProgram(program);
      setError("");
      setFileName(name);
      traceRef.current = next;
      setTrace(next);
      setPlaying(false);
      setPose(ORIGIN);
      seekTo(0);
    },
    [seekTo],
  );

  const loadFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      try {
        const text = await file.text();
        const current = libraryRef.current;
        if (current?.importFile) {
          const saved = await current.importFile(file.name, text);
          const tree = await current.reload();
          const next = { ...current, tree };
          libraryRef.current = next;
          setLibrary(next);
          setSampleFile(saved);
          loadText(saved, text);
          void navigate({ to: "/file/$", params: { _splat: saved } });
          return;
        }
        setSampleFile(null);
        dropped.current = true;
        loadText(file.name, text);
        void navigate({ to: "/" });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [loadText, navigate],
  );

  const loadSample = useCallback(
    async (file: string) => {
      const current = libraryRef.current;
      if (!current) return;
      try {
        setSampleFile(file);
        loadText(file, await current.read(file));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [loadText],
  );

  useEffect(() => {
    let live = true;
    void openLibrary()
      .then((next) => {
        if (!live) return;
        libraryRef.current = next;
        setLibrary(next);
        setReady(true);
      })
      .catch((err: unknown) => {
        if (live) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const current = libraryRef.current;
    if (!current) return;
    if (urlFile) {
      dropped.current = false;
      if (!hasFile(current.tree, urlFile)) {
        setError(`No program ${urlFile}`);
        return;
      }
      void loadSample(urlFile);
      return;
    }
    if (dropped.current) {
      dropped.current = false;
      booted.current = true;
      return;
    }
    if (booted.current) return;
    booted.current = true;
    if (current.home) void loadSample(current.home);
  }, [urlFile, ready, loadSample]);

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setHot(false);
    const file = event.dataTransfer.files[0];
    void loadFile(file);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".sim-samples")) return;
      if (target?.matches("input, select, textarea") || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.code === "Space") {
        event.preventDefault();
        setPlaying((value) => !value);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setPlaying(false);
        seekTo(blockRef.current + 1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        setPlaying(false);
        seekTo(blockRef.current - 1);
      } else if (event.key.toLowerCase() === "r") {
        setPlaying(false);
        seekTo(0);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [seekTo]);

  const toolBtn = (active: boolean): CSSProperties => ({
    padding: "4px 8px",
    borderRadius: 4,
    background: active ? "var(--muted)" : "transparent",
    border: "none",
  });

  const title = trace?.programName ?? fileName;
  const last = trace ? trace.blocks.length - 1 : 0;

  return (
    <div
      className={`flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden${hot ? " is-hot" : ""}`}
      onDragEnter={(event) => {
        event.preventDefault();
        setHot(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setHot(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setHot(false);
      }}
      onDrop={onDrop}
    >
      <header className="sim-topbar">
        <div className="sim-topbar-row">
        <div className="sim-brand">
          <strong>Heidenhain</strong>
          <span>{title ? `${title}${trace?.unit ? ` · ${trace.unit}` : ""}` : "Drop a .h program"}</span>
        </div>
        <div className="sim-tools" role="toolbar" aria-label="Simulation controls">
          <div className="sim-seg">
            <button type="button" style={toolBtn(navMode === "orbit")} title="Orbit" onClick={() => setNavMode("orbit")}>
              <MousePointer2 size={16} className={navMode === "orbit" ? "text-primary" : "text-muted-foreground"} />
            </button>
            <button type="button" style={toolBtn(navMode === "pan")} title="Pan" aria-pressed={navMode === "pan"} onClick={() => setNavMode("pan")}>
              <Move size={16} className={navMode === "pan" ? "text-primary" : "text-muted-foreground"} />
            </button>
            <button type="button" style={toolBtn(navMode === "zoom")} title="Zoom" aria-pressed={navMode === "zoom"} onClick={() => setNavMode("zoom")}>
              <ZoomIn size={16} className={navMode === "zoom" ? "text-primary" : "text-muted-foreground"} />
            </button>
          </div>
          <div className="sim-seg">
            <button type="button" title="Previous block" aria-label="Previous block" disabled={!trace} onClick={() => { setPlaying(false); seekTo(block - 1); }}>
              <SkipBack size={16} />
            </button>
            <button type="button" title={playing ? "Pause" : "Play"} disabled={!trace} onClick={() => setPlaying((value) => !value)}>
              {playing ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <button type="button" title="Next block" aria-label="Next block" disabled={!trace} onClick={() => { setPlaying(false); seekTo(block + 1); }}>
              <SkipForward size={16} />
            </button>
            <button type="button" title="Rewind (R)" aria-label="Rewind" disabled={!trace} onClick={() => { setPlaying(false); seekTo(0); }}>
              <RotateCcw size={16} />
            </button>
          </div>
          <label className="sim-field sim-speed">
            <span>{speed.toFixed(2).replace(/\.00$/, "")}×</span>
            <input
              type="range"
              min={0.25}
              max={16}
              step={0.25}
              value={speed}
              onChange={(event) => setSpeed(Number(event.target.value))}
            />
          </label>
          <label className="sim-file">
            <Upload size={14} />
            Open
            <input
              type="file"
              accept=".h,.H,.i,.I,text/plain"
              hidden
              onChange={(event) => {
                void loadFile(event.target.files?.[0]);
                event.target.value = "";
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
        </div>
        <label className="sim-seek">
          <span>{trace ? block + 1 : 0}</span>
          <input
            type="range"
            min={0}
            max={trace ? trace.clock[trace.clock.length - 1] || 1 : 1}
            step="any"
            value={along}
            disabled={!trace || (trace.clock[trace.clock.length - 1] ?? 0) <= 0}
            aria-label="Seek"
            onPointerDown={() => {
              scrubbing.current = true;
              setPlaying(false);
            }}
            onPointerUp={() => {
              scrubbing.current = false;
            }}
            onPointerCancel={() => {
              scrubbing.current = false;
            }}
            onChange={(event) => seekAlong(Number(event.target.value))}
          />
          <span>{trace?.blocks.length ?? 0}</span>
        </label>
      </header>

      <div className="sim-body relative flex min-h-0 flex-1">
        {library ? (
          <SampleBrowser
            tree={library.tree}
            rootName={import.meta.env.PRESET === "web" ? "Files" : "Samples"}
            active={sampleFile}
            onOpen={(file) => {
              void navigate({ to: "/file/$", params: { _splat: file } });
            }}
          />
        ) : (
          <aside className="sim-samples" />
        )}
        <div className="relative min-h-0 min-w-0 flex-1">
          <PathView
            trace={trace}
            playing={playing}
            speed={speed}
            seek={seek}
            navMode={navMode}
            pathMode={pathMode}
            showMaterial={showMaterial}
            mesh={mesh}
            isDark={isDark}
            onBlock={(index) => setBlock(Math.min(last, Math.max(0, index)))}
            onPose={setPose}
            onProgress={(value) => {
              if (!scrubbing.current) setAlong(value);
            }}
            onDone={() => setPlaying(false)}
          />
          {!trace ? (
            <div className={`sim-drop${hot ? " is-hot" : ""}`}>
              <strong>Pick a sample or drop a program</strong>
              <span>.h Klartext</span>
            </div>
          ) : null}
          {error ? <div className="sim-toast is-error">{error}</div> : null}
        </div>
        <BlockPanel
          trace={trace}
          block={block}
          onSeek={(index) => {
            setPlaying(false);
            seekTo(index);
          }}
        />
        <ProgramPanel
          trace={trace}
          fileName={fileName}
          block={block}
          pose={pose}
          pathMode={pathMode}
          onPathMode={(pathMode) => setView((current) => ({ ...current, pathMode }))}
          showMaterial={showMaterial}
          onShowMaterial={(showMaterial) => setView((current) => ({ ...current, showMaterial }))}
          mesh={mesh}
          onMesh={(mesh) => setView((current) => ({ ...current, mesh }))}
          onSeek={(index) => {
            setPlaying(false);
            seekTo(index);
          }}
        />
      </div>
    </div>
  );
}
