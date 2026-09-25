import { useEffect, useRef } from "react";
import type { ScanSection } from "@/algorithm/scanEstimate";
import { TURNTABLE_RADIUS_MM } from "@/sim/machine";
import { SCENE_THEME } from "@/theme";

type Props = {
  sectionX: ScanSection;
  sectionY: ScanSection;
  radiusMm: number;
  zMm: number;
  isDark: boolean;
};

function drawCut(
  ctx: CanvasRenderingContext2D,
  cssW: number,
  cssH: number,
  section: ScanSection,
  radiusMm: number,
  zMm: number,
  title: string,
  axis: string,
  theme: (typeof SCENE_THEME)["dark"]["polar"],
) {
  ctx.clearRect(0, 0, cssW, cssH);
  const padL = 28;
  const padR = 8;
  const padT = 18;
  const padB = 18;
  const plotW = cssW - padL - padR;
  const plotH = cssH - padT - padB;
  const maxR = Math.max(TURNTABLE_RADIUS_MM, radiusMm, 1);
  const z0 = section.z0;
  const z1 = section.z1;
  const zSpan = Math.max(z1 - z0, 1);

  const xOf = (r: number) => padL + ((r + maxR) / (2 * maxR)) * plotW;
  const yOf = (z: number) => padT + plotH - ((z - z0) / zSpan) * plotH;

  ctx.strokeStyle = theme.ring;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(xOf(0), padT);
  ctx.lineTo(xOf(0), padT + plotH);
  ctx.moveTo(padL, yOf(z0));
  ctx.lineTo(padL + plotW, yOf(z0));
  ctx.stroke();

  ctx.strokeStyle = theme.ringStrong;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(xOf(-TURNTABLE_RADIUS_MM), yOf(z0));
  ctx.lineTo(xOf(TURNTABLE_RADIUS_MM), yOf(z0));
  ctx.stroke();
  ctx.setLineDash([]);

  const n = section.occ.length;
  ctx.fillStyle = theme.fill;
  ctx.strokeStyle = theme.stroke;
  ctx.lineWidth = 1.4;
  let run = -1;
  for (let i = 0; i <= n; i += 1) {
    const on = i < n && section.occ[i];
    const same =
      on &&
      run >= 0 &&
      section.left[i] === section.left[run] &&
      section.right[i] === section.right[run];
    if (on && run < 0) run = i;
    if (run >= 0 && (!on || !same)) {
      const last = i - 1;
      const zLo = z0 + (run / n) * zSpan;
      const zHi = z0 + ((last + 1) / n) * zSpan;
      const x0 = xOf(section.left[run]);
      const x1 = xOf(section.right[run]);
      ctx.beginPath();
      ctx.rect(Math.min(x0, x1), yOf(zHi), Math.abs(x1 - x0), yOf(zLo) - yOf(zHi));
      ctx.fill();
      ctx.stroke();
      run = on ? i : -1;
    }
  }

  if (zMm >= z0 && zMm <= z1) {
    ctx.strokeStyle = theme.label;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(padL, yOf(zMm));
    ctx.lineTo(padL + plotW, yOf(zMm));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.fillStyle = theme.label;
  ctx.font = "10px ui-sans-serif, system-ui";
  ctx.fillText(title, 6, 12);
  ctx.fillText(axis, cssW - 22, 12);
  ctx.fillText(`${Math.round(zSpan)} mm`, 4, cssH - 4);
}

export function SectionCuts({ sectionX, sectionY, radiusMm, zMm, isDark }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const theme = SCENE_THEME[isDark ? "dark" : "light"].polar;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = 260;
    const cssH = 280;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawCut(ctx, cssW, cssH / 2, sectionX, radiusMm, zMm, "A–A  XZ", "X", theme);
    ctx.translate(0, cssH / 2);
    drawCut(ctx, cssW, cssH / 2, sectionY, radiusMm, zMm, "B–B  YZ", "Y", theme);
  }, [isDark, radiusMm, sectionX, sectionY, theme, zMm]);

  return <canvas ref={ref} style={{ width: 260, height: 280, display: "block" }} />;
}
