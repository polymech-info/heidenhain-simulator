export type ThemeId = "dark" | "light";

export type SceneTheme = {
  background: string;
  fog: string;
  ambient: number;
  keyLight: number;
  fillLight: number;
  gridCenter: string;
  gridCell: string;
  gizmo: {
    color: string;
    hoverColor: string;
    textColor: string;
    strokeColor: string;
  };
  machine: {
    base: string;
    turntable: string;
    ring: string;
    mastFoot: string;
    mast: string;
    mastCap: string;
    rail: string;
    control: string;
    floor: string;
    floorOpacity: number;
    sensor: string;
  };
  scan: {
    ray: number;
    hits: string;
    envelope: number;
  };
  polar: {
    ring: string;
    ringStrong: string;
    fill: string;
    stroke: string;
    label: string;
  };
};

export const SCENE_THEME: Record<ThemeId, SceneTheme> = {
  dark: {
    background: "#14181d",
    fog: "#14181d",
    ambient: 0.45,
    keyLight: 1.1,
    fillLight: 0.25,
    gridCenter: "#334155",
    gridCell: "#1e293b",
    gizmo: { color: "#334155", hoverColor: "#475569", textColor: "#f8fafc", strokeColor: "#0f172a" },
    machine: {
      base: "#1f2933",
      turntable: "#4b5563",
      ring: "#111827",
      mastFoot: "#111827",
      mast: "#2d3740",
      mastCap: "#0f1418",
      rail: "#9aa3ad",
      control: "#e8eaed",
      floor: "#3d4450",
      floorOpacity: 0.18,
      sensor: "#0b0d10",
    },
    scan: { ray: 0xef4444, hits: "#38bdf8", envelope: 0xfbbf24 },
    polar: {
      ring: "rgba(148,163,184,0.35)",
      ringStrong: "rgba(148,163,184,0.7)",
      fill: "rgba(251,191,36,0.18)",
      stroke: "#fbbf24",
      label: "#94a3b8",
    },
  },
  light: {
    background: "#d7dee6",
    fog: "#d7dee6",
    ambient: 0.72,
    keyLight: 1.25,
    fillLight: 0.4,
    gridCenter: "#94a3b8",
    gridCell: "#cbd5e1",
    gizmo: { color: "#e2e8f0", hoverColor: "#cbd5e1", textColor: "#0f172a", strokeColor: "#64748b" },
    machine: {
      base: "#5b6570",
      turntable: "#8b95a1",
      ring: "#3f4752",
      mastFoot: "#4b5563",
      mast: "#6b7580",
      mastCap: "#3f4752",
      rail: "#c5ccd4",
      control: "#f3f4f6",
      floor: "#9aa3ad",
      floorOpacity: 0.28,
      sensor: "#1f2933",
    },
    scan: { ray: 0xdc2626, hits: "#0369a1", envelope: 0xb45309 },
    polar: {
      ring: "rgba(71,85,105,0.28)",
      ringStrong: "rgba(51,65,85,0.7)",
      fill: "rgba(180,83,9,0.16)",
      stroke: "#b45309",
      label: "#475569",
    },
  },
};

export function applyTheme(theme: ThemeId) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.classList.toggle("light", theme === "light");
  try {
    localStorage.setItem("pm-3d-wrapper.theme", theme);
  } catch {
    // ignore
  }
}
