import { useEffect, useRef } from "react";
import { TURNTABLE_RADIUS_MM } from "@/sim/machine";
import { SCENE_THEME } from "@/theme";

type Props = {
  polar: Float32Array;
  radiusMm: number;
  isDark: boolean;
};

export function PolarPlot({ polar, radiusMm, isDark }: Props) {
  const theme = SCENE_THEME[isDark ? "dark" : "light"].polar;
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const css = 220;
    canvas.width = css * dpr;
    canvas.height = css * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, css, css);

    const cx = css / 2;
    const cy = css / 2;
    const maxR = Math.max(TURNTABLE_RADIUS_MM, radiusMm, 1);
    const scale = (css / 2 - 14) / maxR;

    ctx.strokeStyle = theme.ring;
    ctx.lineWidth = 1;
    for (const ring of [0.33, 0.66, 1]) {
      ctx.beginPath();
      ctx.arc(cx, cy, TURNTABLE_RADIUS_MM * scale * ring, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, TURNTABLE_RADIUS_MM * scale, 0, Math.PI * 2);
    ctx.strokeStyle = theme.ringStrong;
    ctx.stroke();

    const n = polar.length;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i <= n; i += 1) {
      const r = polar[i % n];
      if (r <= 0) continue;
      const phi = ((i % n) / n) * Math.PI * 2;
      const x = cx + Math.cos(phi) * r * scale;
      const y = cy - Math.sin(phi) * r * scale;
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = theme.fill;
    ctx.strokeStyle = theme.stroke;
    ctx.lineWidth = 1.5;
    if (started) {
      ctx.fill();
      ctx.stroke();
    }

    ctx.fillStyle = theme.label;
    ctx.font = "10px ui-sans-serif, system-ui";
    ctx.fillText(`${Math.round(maxR)} mm`, 8, css - 8);
  }, [polar, radiusMm, theme]);

  return <canvas ref={ref} style={{ width: 220, height: 220, display: "block" }} />;
}
