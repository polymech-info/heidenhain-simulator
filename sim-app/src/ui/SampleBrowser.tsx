import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from "react";
import { ArrowUp, FileCode, Folder, LayoutGrid, List } from "lucide-react";
import type { SampleNode, SampleTree } from "@/storage/tree";

const STORE_KEY = "pm-heidenhain.samples";

type BrowserView = "list" | "grid";

type Props = {
  tree: SampleTree;
  active: string | null;
  onOpen: (file: string) => void;
  rootName?: string;
};

function loadBrowser(tree: SampleTree): { dir: string; view: BrowserView } {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || "") as { dir?: unknown; view?: unknown };
    const dir = typeof parsed.dir === "string" && tree[parsed.dir] ? parsed.dir : "";
    const view: BrowserView = parsed.view === "grid" ? "grid" : "list";
    return { dir, view };
  } catch {
    return { dir: "", view: "list" };
  }
}

function parentDir(dir: string) {
  const cut = dir.lastIndexOf("/");
  return cut < 0 ? "" : dir.slice(0, cut);
}

export function SampleBrowser({ tree, active, onOpen, rootName = "Samples" }: Props) {
  const stored = useState(() => loadBrowser(tree))[0];
  const [dir, setDir] = useState(stored.dir);
  const [view, setView] = useState<BrowserView>(stored.view);
  const [focusIdx, setFocusIdx] = useState(0);
  const [query, setQuery] = useState("");
  const [returnTo, setReturnTo] = useState<{ dir: string; name: string } | null>(null);
  const rootRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const buffer = useRef("");
  const timer = useRef(0);

  const nodes = tree[dir] ?? [];
  const canGoUp = dir !== "";
  const itemCount = nodes.length + (canGoUp ? 1 : 0);

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ dir, view }));
    } catch {
      // ignore
    }
  }, [dir, view]);

  const revealed = useRef<string | null>(null);
  useEffect(() => {
    if (!active || revealed.current === active) return;
    revealed.current = active;
    const slash = active.lastIndexOf("/");
    const parent = slash < 0 ? "" : active.slice(0, slash);
    if (tree[parent]) setDir(parent);
  }, [active, tree]);

  const getNode = useCallback(
    (idx: number): SampleNode | null => {
      const offset = canGoUp ? 1 : 0;
      if (idx < offset) return null;
      return nodes[idx - offset] ?? null;
    },
    [canGoUp, nodes],
  );

  const prevDir = useRef<string | null>(null);
  useEffect(() => {
    if (prevDir.current === dir) return;
    prevDir.current = dir;
    buffer.current = "";
    setQuery("");
    const offset = canGoUp ? 1 : 0;
    if (returnTo && returnTo.dir === dir) {
      const idx = nodes.findIndex((node) => node.name === returnTo.name);
      setFocusIdx(idx >= 0 ? idx + offset : 0);
      return;
    }
    const openIdx = nodes.findIndex((node) => node.path === active);
    setFocusIdx(openIdx >= 0 ? openIdx + offset : 0);
  }, [dir, returnTo, active, canGoUp, nodes]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-fb-idx="${focusIdx}"]`)?.scrollIntoView({ block: "nearest" });
  }, [focusIdx, dir, view]);

  const goUp = useCallback(() => {
    if (!dir) return;
    const parent = parentDir(dir);
    setReturnTo({ dir: parent, name: dir.slice(dir.lastIndexOf("/") + 1) });
    setDir(parent);
  }, [dir]);

  const openIndex = useCallback(
    (idx: number) => {
      const node = getNode(idx);
      if (!node) {
        goUp();
        return;
      }
      if (node.kind === "dir") {
        setReturnTo(null);
        setDir(node.path);
      }
      else onOpen(node.path);
    },
    [getNode, goUp, onOpen],
  );

  const setBuffer = (value: string) => {
    buffer.current = value;
    setQuery(value);
    window.clearTimeout(timer.current);
    if (value) {
      timer.current = window.setTimeout(() => {
        buffer.current = "";
        setQuery("");
      }, 800);
    }
  };

  const moveFocus = (next: number) => {
    const clamped = Math.max(0, Math.min(itemCount - 1, next));
    setFocusIdx(clamped);
  };

  const findTyped = (search: string, start: number, step: 1 | -1) => {
    const needle = search.toLowerCase();
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < itemCount; i++) {
        const idx = (start + step * i + itemCount * 8) % itemCount;
        const node = getNode(idx);
        if (!node) continue;
        const name = node.name.toLowerCase();
        if (pass === 0 ? name.startsWith(needle) : name.includes(needle)) return idx;
      }
    }
    return -1;
  };

  const gridCols = () => {
    if (view === "list") return 1;
    const columns = listRef.current ? getComputedStyle(listRef.current).gridTemplateColumns : "";
    const count = columns.split(" ").filter(Boolean).length;
    return Math.max(1, count);
  };

  const onKeyDown = (event: ReactKeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest(".sim-browser-tools")) return;
    if (target?.matches("input, textarea")) return;
    if (itemCount === 0) return;

    const cols = gridCols();
    if (event.altKey && event.key === "2") {
      event.preventDefault();
      event.stopPropagation();
      setView("list");
      return;
    }
    if (event.altKey && event.key === "3") {
      event.preventDefault();
      event.stopPropagation();
      setView("grid");
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const stop = () => {
      event.preventDefault();
      event.stopPropagation();
    };

    switch (event.key) {
      case "ArrowRight":
        stop();
        moveFocus(focusIdx < itemCount - 1 ? focusIdx + 1 : 0);
        break;
      case "ArrowLeft":
        stop();
        moveFocus(focusIdx > 0 ? focusIdx - 1 : itemCount - 1);
        break;
      case "ArrowDown":
        stop();
        if (buffer.current) {
          const next = findTyped(buffer.current, (focusIdx + 1) % itemCount, 1);
          if (next >= 0) moveFocus(next);
        } else {
          moveFocus(focusIdx + cols);
        }
        break;
      case "ArrowUp":
        stop();
        if (buffer.current) {
          const prev = findTyped(buffer.current, (focusIdx - 1 + itemCount) % itemCount, -1);
          if (prev >= 0) moveFocus(prev);
        } else {
          moveFocus(focusIdx - cols);
        }
        break;
      case "Enter":
        stop();
        openIndex(focusIdx);
        break;
      case "Backspace":
        stop();
        if (buffer.current) setBuffer(buffer.current.slice(0, -1));
        else goUp();
        break;
      case "Home":
        stop();
        moveFocus(0);
        break;
      case "End":
        stop();
        moveFocus(itemCount - 1);
        break;
      case "Escape":
        if (!buffer.current) return;
        stop();
        setBuffer("");
        break;
      case " ":
        stop();
        break;
      default:
        if (event.key.length !== 1) return;
        stop();
        const nextQuery = buffer.current + event.key.toLowerCase();
        setBuffer(nextQuery);
        const found = findTyped(nextQuery, Math.max(0, focusIdx), 1);
        if (found >= 0) moveFocus(found);
        break;
    }
  };

  const onItemClick = (idx: number, event: ReactMouseEvent) => {
    if (event.detail > 1) openIndex(idx);
    else setFocusIdx(idx);
  };

  const crumbs = dir ? dir.split("/") : [];

  const renderName = (name: string, focused: boolean) => {
    if (!focused || !query) return name;
    const lower = name.toLowerCase();
    const needle = query.toLowerCase();
    const pos = lower.startsWith(needle) ? 0 : lower.indexOf(needle);
    if (pos < 0) return name;
    return (
      <>
        {name.slice(0, pos)}
        <mark>{name.slice(pos, pos + query.length)}</mark>
        {name.slice(pos + query.length)}
      </>
    );
  };

  const up = canGoUp ? (
    <div
      data-fb-idx={0}
      className={`sim-browser-item is-up${focusIdx === 0 ? " is-focus" : ""}`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={(event) => onItemClick(0, event)}
    >
      <ArrowUp size={view === "grid" ? 22 : 14} />
      <span>..</span>
    </div>
  ) : null;

  return (
    <aside className="sim-samples" ref={rootRef} tabIndex={0} onKeyDown={onKeyDown}>
      <div className="sim-browser-tools">
        <button type="button" title="Up (Backspace)" disabled={!canGoUp} onClick={goUp}>
          <ArrowUp size={14} />
        </button>
        <div className="sim-crumbs">
          <button type="button" onClick={() => { setReturnTo(null); setDir(""); }}>
            {rootName}
          </button>
          {crumbs.map((part, i) => {
            const path = crumbs.slice(0, i + 1).join("/");
            return (
              <button key={path} type="button" onClick={() => { setReturnTo(null); setDir(path); }} title={path}>
                {part}
              </button>
            );
          })}
        </div>
        <button type="button" title="List (Alt+2)" aria-pressed={view === "list"} className={view === "list" ? "is-on" : ""} onClick={() => setView("list")}>
          <List size={14} />
        </button>
        <button type="button" title="Grid (Alt+3)" aria-pressed={view === "grid"} className={view === "grid" ? "is-on" : ""} onClick={() => setView("grid")}>
          <LayoutGrid size={14} />
        </button>
      </div>
      {query ? <div className="sim-browser-query">{query}</div> : null}
      <div ref={listRef} className={view === "grid" ? "sim-browser-grid" : "sim-browser-list"} onMouseDown={() => rootRef.current?.focus()}>
        {up}
        {nodes.map((node, i) => {
          const idx = i + (canGoUp ? 1 : 0);
          const focused = focusIdx === idx;
          const open = node.path === active;
          return (
            <div
              key={node.path}
              data-fb-idx={idx}
              className={`sim-browser-item is-${node.kind}${focused ? " is-focus" : ""}${open ? " is-open" : ""}`}
              title={node.path}
              onMouseDown={(event) => event.preventDefault()}
              onClick={(event) => onItemClick(idx, event)}
            >
              {node.kind === "dir" ? <Folder size={view === "grid" ? 28 : 14} /> : <FileCode size={view === "grid" ? 28 : 14} />}
              <span>{renderName(node.name, focused)}</span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
