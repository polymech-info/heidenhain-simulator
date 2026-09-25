import { useEffect, useMemo, useRef, useState } from "react";
import type { Trace } from "@/machine/machine";

type Props = {
  trace: Trace | null;
  block: number;
  onSeek: (index: number) => void;
};

const LINE = 16;
const CHARS = 28;

function blockExtent(lines: string[]) {
  let rows = 0;
  for (let i = 0; i < lines.length; i++) rows += Math.max(1, Math.ceil(lines[i].length / CHARS));
  return rows * LINE + 1;
}

function layoutBlocks(trace: Trace) {
  const offsets = new Float64Array(trace.blocks.length + 1);
  for (let i = 0; i < trace.blocks.length; i++) offsets[i + 1] = offsets[i] + blockExtent(trace.blocks[i].lines);
  return offsets;
}

function indexAt(offsets: Float64Array, y: number) {
  let lo = 0;
  let hi = offsets.length - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (offsets[mid] <= y) lo = mid;
    else hi = mid - 1;
  }
  return lo < 0 ? 0 : lo;
}

export function BlockPanel({ trace, block, onSeek }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewH, setViewH] = useState(320);
  const offsets = useMemo(() => (trace ? layoutBlocks(trace) : null), [trace]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => setViewH(list.clientHeight || 320);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [trace]);

  useEffect(() => {
    const list = listRef.current;
    if (!list || !offsets || block < 0 || block >= offsets.length - 1) return;
    const zone = list.clientHeight / 3;
    const rowTop = offsets[block];
    const rowH = offsets[block + 1] - rowTop;
    if (rowTop >= list.scrollTop && rowTop + rowH <= list.scrollTop + zone) return;
    const inset = Math.max(0, (zone - rowH) / 2);
    list.scrollTop = Math.max(0, rowTop - inset);
    setScrollTop(list.scrollTop);
  }, [block, offsets]);

  const onScroll = () => {
    const list = listRef.current;
    if (!list || frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      setScrollTop(listRef.current?.scrollTop ?? 0);
    });
  };

  let start = 0;
  let end = 0;
  if (trace && offsets) {
    const overscan = 240;
    start = indexAt(offsets, Math.max(0, scrollTop - overscan));
    end = Math.min(trace.blocks.length, indexAt(offsets, scrollTop + viewH + overscan) + 1);
  }

  return (
    <aside className="sim-blocks-panel">
      <h2>Blocks</h2>
      {trace && offsets ? (
        <div className="sim-listing">
          <div className="sim-blocks" ref={listRef} onScroll={onScroll}>
            <div style={{ position: "relative", height: offsets[offsets.length - 1] }}>
              {trace.blocks.slice(start, end).map((item) => (
                <button
                  key={item.index}
                  type="button"
                  data-block={item.index}
                  className={`sim-block is-${trace.status[item.index] ?? "dead"}${item.index === block ? " is-current" : ""}`}
                  style={{ position: "absolute", top: offsets[item.index], height: offsets[item.index + 1] - offsets[item.index] }}
                  onClick={() => onSeek(item.index)}
                >
                  <span className="n">{item.number ?? ""}</span>
                  <span className="src">{item.lines.join("\n")}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <p className="sim-note">No program loaded.</p>
      )}
    </aside>
  );
}
