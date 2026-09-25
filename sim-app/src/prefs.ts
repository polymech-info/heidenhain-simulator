import type { ToolpathMode } from "@/scene/PathView";
import type { MeshPreset } from "@/scene/stockRemoval";

const KEY = "pm-heidenhain.view";

export type ViewPrefs = {
  pathMode: ToolpathMode;
  showMaterial: boolean;
  mesh: MeshPreset;
};

const MODES = new Set<string>(["none", "dots", "trail", "visible", "feed", "cutting"]);
const MESHES = new Set<string>(["coarse", "medium", "fine"]);

export const DEFAULT_VIEW: ViewPrefs = {
  pathMode: "visible",
  showMaterial: true,
  mesh: "medium",
};

export function loadViewPrefs(): ViewPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_VIEW;
    const parsed = JSON.parse(raw) as Partial<ViewPrefs>;
    return {
      pathMode:
        typeof parsed.pathMode === "string" && MODES.has(parsed.pathMode) ? (parsed.pathMode as ToolpathMode) : DEFAULT_VIEW.pathMode,
      showMaterial: typeof parsed.showMaterial === "boolean" ? parsed.showMaterial : DEFAULT_VIEW.showMaterial,
      mesh: typeof parsed.mesh === "string" && MESHES.has(parsed.mesh) ? (parsed.mesh as MeshPreset) : DEFAULT_VIEW.mesh,
    };
  } catch {
    return DEFAULT_VIEW;
  }
}

export function saveViewPrefs(prefs: ViewPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}
