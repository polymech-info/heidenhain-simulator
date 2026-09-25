export type ThemeId = "dark" | "light";

export type SceneTheme = {
  background: string;
  gridCenter: string;
  gridCell: string;
  stock: string;
  stockEdge: string;
  rapid: string;
  feed: string;
  cut: string;
  tool: string;
  gizmo: {
    color: string;
    hoverColor: string;
    textColor: string;
    strokeColor: string;
  };
};

export const SCENE_THEME: Record<ThemeId, SceneTheme> = {
  dark: {
    background: "#14181d",
    gridCenter: "#334155",
    gridCell: "#1e293b",
    stock: "#64748b",
    stockEdge: "#94a3b8",
    rapid: "#64748b",
    feed: "#38bdf8",
    cut: "#4ade80",
    tool: "#f97316",
    gizmo: { color: "#334155", hoverColor: "#475569", textColor: "#f8fafc", strokeColor: "#0f172a" },
  },
  light: {
    background: "#d7dee6",
    gridCenter: "#94a3b8",
    gridCell: "#cbd5e1",
    stock: "#94a3b8",
    stockEdge: "#475569",
    rapid: "#64748b",
    feed: "#0369a1",
    cut: "#15803d",
    tool: "#c2410c",
    gizmo: { color: "#e2e8f0", hoverColor: "#cbd5e1", textColor: "#0f172a", strokeColor: "#64748b" },
  },
};

const THEME_KEY = "pm-heidenhain.theme";

export function applyTheme(theme: ThemeId) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.classList.toggle("light", theme === "light");
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignore
  }
}

export { THEME_KEY };
