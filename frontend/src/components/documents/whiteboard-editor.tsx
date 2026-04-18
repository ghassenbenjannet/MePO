import { useEffect, useRef, useState } from "react";
import { Link2, Pencil, Plus, RotateCcw, Trash2, X, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "../../lib/utils";
import { TldrawWhiteboardEditor } from "./tldraw-whiteboard-editor";

// ─── Types ────────────────────────────────────────────────────────────────────

type StickyColor = "yellow" | "pink" | "blue" | "green" | "purple" | "orange";
type ConnectionType = "arrow" | "dashed" | "bidirectional" | "block";
type ResizeDir = "nw" | "ne" | "se" | "sw";

interface StickyNote {
  id: string; x: number; y: number; width: number; height: number; content: string; color: StickyColor;
}
interface Connection {
  id: string; from: string; to: string; type: ConnectionType;
}
interface WhiteboardData {
  notes: StickyNote[]; connections: Connection[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_W = 120;
const MIN_H = 90;
const ZOOM_MIN = 0.15;
const ZOOM_MAX = 4;
const GRID = 24;

const COLORS: StickyColor[] = ["yellow", "pink", "blue", "green", "purple", "orange"];

// Note visual palette
const PALETTE: Record<StickyColor, {
  tape: string;       // tape header background (CSS value)
  tapeText: string;   // tape text color
  bodyBg: string;     // body gradient CSS
  shadow: string;     // box-shadow color
  dotCls: string;     // Tailwind class for color dot
  textCls: string;    // Tailwind text color class
}> = {
  yellow: {
    tape: "linear-gradient(135deg, #f59e0b, #d97706)",
    tapeText: "rgba(255,255,255,.85)",
    bodyBg: "linear-gradient(160deg, #fffbeb 0%, #fef3c7 100%)",
    shadow: "rgba(245,158,11,.30)",
    dotCls: "bg-amber-400",
    textCls: "text-amber-950",
  },
  pink: {
    tape: "linear-gradient(135deg, #f43f5e, #e11d48)",
    tapeText: "rgba(255,255,255,.85)",
    bodyBg: "linear-gradient(160deg, #fff1f2 0%, #ffe4e6 100%)",
    shadow: "rgba(244,63,94,.28)",
    dotCls: "bg-rose-400",
    textCls: "text-rose-950",
  },
  blue: {
    tape: "linear-gradient(135deg, #3b82f6, #2563eb)",
    tapeText: "rgba(255,255,255,.85)",
    bodyBg: "linear-gradient(160deg, #eff6ff 0%, #dbeafe 100%)",
    shadow: "rgba(59,130,246,.28)",
    dotCls: "bg-blue-400",
    textCls: "text-blue-950",
  },
  green: {
    tape: "linear-gradient(135deg, #10b981, #059669)",
    tapeText: "rgba(255,255,255,.85)",
    bodyBg: "linear-gradient(160deg, #ecfdf5 0%, #d1fae5 100%)",
    shadow: "rgba(16,185,129,.28)",
    dotCls: "bg-emerald-400",
    textCls: "text-emerald-950",
  },
  purple: {
    tape: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
    tapeText: "rgba(255,255,255,.85)",
    bodyBg: "linear-gradient(160deg, #f5f3ff 0%, #ede9fe 100%)",
    shadow: "rgba(139,92,246,.28)",
    dotCls: "bg-violet-400",
    textCls: "text-violet-950",
  },
  orange: {
    tape: "linear-gradient(135deg, #f97316, #ea580c)",
    tapeText: "rgba(255,255,255,.85)",
    bodyBg: "linear-gradient(160deg, #fff7ed 0%, #ffedd5 100%)",
    shadow: "rgba(249,115,22,.28)",
    dotCls: "bg-orange-400",
    textCls: "text-orange-950",
  },
};

// Dark palette overrides for body
const PALETTE_DARK_BODY: Record<StickyColor, string> = {
  yellow: "linear-gradient(160deg,rgba(120,53,15,.55) 0%,rgba(92,40,10,.45) 100%)",
  pink:   "linear-gradient(160deg,rgba(136,19,55,.55) 0%,rgba(112,13,43,.45) 100%)",
  blue:   "linear-gradient(160deg,rgba(23,37,84,.55) 0%,rgba(17,27,68,.45) 100%)",
  green:  "linear-gradient(160deg,rgba(6,78,59,.55) 0%,rgba(4,60,44,.45) 100%)",
  purple: "linear-gradient(160deg,rgba(76,29,149,.55) 0%,rgba(60,22,120,.45) 100%)",
  orange: "linear-gradient(160deg,rgba(124,45,18,.55) 0%,rgba(100,35,12,.45) 100%)",
};

const DARK_TEXT: Record<StickyColor, string> = {
  yellow: "#fef3c7", pink: "#ffe4e6", blue: "#dbeafe",
  green: "#d1fae5", purple: "#ede9fe", orange: "#ffedd5",
};

// Connection info
interface ConnInfo { label: string; short: string; dash?: string; mEnd: string; mStart?: string; sw: number; }

const CONN_INFO: Record<ConnectionType, ConnInfo> = {
  arrow:         { label: "Flèche",         short: "→",  mEnd: "url(#wb-ae)",                           sw: 1.5 },
  dashed:        { label: "Dépendance",      short: "⇢",  mEnd: "url(#wb-ae)",  dash: "6 3",             sw: 1.5 },
  bidirectional: { label: "Bidirectionnel",  short: "↔",  mEnd: "url(#wb-ae)",  mStart:"url(#wb-as)",    sw: 1.5 },
  block:         { label: "Bloque",          short: "⊣",  mEnd: "url(#wb-be)",                           sw: 2   },
};

const CONN_TYPES = Object.keys(CONN_INFO) as ConnectionType[];

// Resize handles
const RESIZE: { dir: ResizeDir; pos: React.CSSProperties; cursor: string }[] = [
  { dir: "nw", pos: { top: -6,    left: -6   }, cursor: "nw-resize" },
  { dir: "ne", pos: { top: -6,    right: -6  }, cursor: "ne-resize" },
  { dir: "se", pos: { bottom: -6, right: -6  }, cursor: "se-resize" },
  { dir: "sw", pos: { bottom: -6, left: -6   }, cursor: "sw-resize" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 10); }

function parseData(raw: string): WhiteboardData {
  try {
    const p = JSON.parse(raw);
    if (p && Array.isArray(p.notes))
      return { notes: p.notes, connections: Array.isArray(p.connections) ? p.connections : [] };
  } catch { /* */ }
  return { notes: [], connections: [] };
}

function snapV(v: number, on: boolean) {
  return on ? Math.round(v / GRID) * GRID : v;
}

/** Edge exit point + tangent direction from rectangle towards target */
function edgeInfo(cx: number, cy: number, w: number, h: number, tx: number, ty: number) {
  const dx = tx - cx, dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy, dx: 1, dy: 0 };
  const hw = w / 2 + 3, hh = h / 2 + 3;   // tighter margin → arrows attach closer to border
  if (Math.abs(dy) * hw >= Math.abs(dx) * hh) {
    const s = dy > 0 ? 1 : -1;
    return { x: cx + dx * s * hh / dy, y: cy + s * hh, dx: 0, dy: s };
  }
  const s = dx > 0 ? 1 : -1;
  return { x: cx + s * hw, y: cy + dy * s * hw / dx, dx: s, dy: 0 };
}

/**
 * Organic bezier path — control-point offset scales gently with distance
 * (short: nearly straight · long: gentle curve, never dramatic)
 */
function bezierPath(
  x1: number, y1: number, dx1: number, dy1: number,
  x2: number, y2: number, dx2: number, dy2: number,
) {
  const dist = Math.hypot(x2 - x1, y2 - y1);
  // cap at 70px so even long-range connections stay fluid, not stiff
  const off = Math.max(16, Math.min(dist * 0.26, 70));
  return `M ${x1} ${y1} C ${x1 + dx1 * off} ${y1 + dy1 * off}, ${x2 + dx2 * off} ${y2 + dy2 * off}, ${x2} ${y2}`;
}

/** Exact midpoint of the cubic bezier (De Casteljau at t = 0.5) */
function bezierMid(
  x1: number, y1: number, dx1: number, dy1: number,
  x2: number, y2: number, dx2: number, dy2: number,
) {
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const off = Math.max(16, Math.min(dist * 0.26, 70));
  const cx1 = x1 + dx1 * off, cy1 = y1 + dy1 * off;
  const cx2 = x2 + dx2 * off, cy2 = y2 + dy2 * off;
  return {
    x: 0.125 * x1 + 0.375 * cx1 + 0.375 * cx2 + 0.125 * x2,
    y: 0.125 * y1 + 0.375 * cy1 + 0.375 * cy2 + 0.125 * y2,
  };
}

// ─── SVG Defs ─────────────────────────────────────────────────────────────────

function SvgDefs() {
  return (
    <defs>
      {/* Arrow end — refined, slightly open triangle */}
      <marker id="wb-ae" viewBox="0 0 14 14" refX="12" refY="7"
        markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M1 3 L12 7 L1 11" fill="none" stroke="context-stroke" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </marker>
      {/* Arrow start (bidirectional) */}
      <marker id="wb-as" viewBox="0 0 14 14" refX="2" refY="7"
        markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M13 3 L2 7 L13 11" fill="none" stroke="context-stroke" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </marker>
      {/* Block end — clean perpendicular bar */}
      <marker id="wb-be" viewBox="0 0 10 14" refX="9" refY="7"
        markerWidth="5" markerHeight="5" orient="auto">
        <line x1="9" y1="2" x2="9" y2="12" stroke="context-stroke" strokeWidth="2.5" strokeLinecap="round" />
      </marker>
      {/* Glow filter for selected connections */}
      <filter id="wb-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="2.5" result="blur" />
        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>
  );
}

// ─── WhiteboardEditor ─────────────────────────────────────────────────────────

interface WhiteboardEditorProps {
  content: string;
  onChange?: (json: string) => void;
  readOnly?: boolean;
  title?: string;
  onBack?: () => void;
  saveStatus?: "idle" | "pending" | "saved";
}

export function LegacyWhiteboardEditor({ content, onChange, readOnly = false }: WhiteboardEditorProps) {
  const [data, setData] = useState<WhiteboardData>(() => parseData(content));
  const [history, setHistory] = useState<WhiteboardData[]>([]);

  // Selection / editing
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [selectedConnId, setSelectedConnId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newColor, setNewColor] = useState<StickyColor>("yellow");

  // Viewport
  const [pan, setPan] = useState({ x: 60, y: 50 });
  const [zoom, setZoom] = useState(1);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState(false);

  // Connect mode
  const [connectMode, setConnectMode] = useState(false);
  const [connectType, setConnectType] = useState<ConnectionType>("arrow");
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [previewCursor, setPreviewCursor] = useState<{ x: number; y: number } | null>(null);

  // Options
  const [snapGrid, setSnapGrid] = useState(false);

  // Detect dark mode
  const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const dragRef = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null);
  const resizeRef = useRef<{ id: string; dir: ResizeDir; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number } | null>(null);

  // Latest state ref (avoids stale closures in event handlers)
  const S = useRef({ data, history, selectedNoteId, selectedConnId, snapGrid });
  useEffect(() => { S.current = { data, history, selectedNoteId, selectedConnId, snapGrid }; });

  // ── Persist ──────────────────────────────────────────────────────────────

  function commit(next: WhiteboardData) {
    setHistory((h) => [...h.slice(-30), S.current.data]);
    setData(next);
    onChange?.(JSON.stringify(next));
  }

  function undo() {
    const { history } = S.current;
    if (!history.length) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setData(prev);
    onChange?.(JSON.stringify(prev));
  }

  // ── Coordinate helpers ───────────────────────────────────────────────────

  function toCanvas(cx: number, cy: number) {
    const r = containerRef.current!.getBoundingClientRect();
    return { x: (cx - r.left - pan.x) / zoom, y: (cy - r.top - pan.y) / zoom };
  }

  // ── Note CRUD ────────────────────────────────────────────────────────────

  function addNote() {
    const r = containerRef.current!.getBoundingClientRect();
    const center = toCanvas(r.left + r.width / 2, r.top + r.height / 2);
    const note: StickyNote = {
      id: uid(),
      x: snapV(center.x - 90, snapGrid),
      y: snapV(center.y - 65, snapGrid),
      width: 180, height: 130,
      content: "", color: newColor,
    };
    commit({ ...S.current.data, notes: [...S.current.data.notes, note] });
    setSelectedNoteId(note.id);
    setEditingId(note.id);
  }

  function deleteNote(id: string) {
    commit({
      notes: S.current.data.notes.filter((n) => n.id !== id),
      connections: S.current.data.connections.filter((c) => c.from !== id && c.to !== id),
    });
    if (selectedNoteId === id) setSelectedNoteId(null);
    if (editingId === id) setEditingId(null);
    if (connectFrom === id) { setConnectFrom(null); setPreviewCursor(null); }
  }

  function updateContent(id: string, val: string) {
    setData((prev) => ({ ...prev, notes: prev.notes.map((n) => (n.id === id ? { ...n, content: val } : n)) }));
  }

  function flushContent() {
    setData((prev) => { onChange?.(JSON.stringify(prev)); return prev; });
  }

  function updateColor(id: string, color: StickyColor) {
    commit({ ...S.current.data, notes: S.current.data.notes.map((n) => (n.id === id ? { ...n, color } : n)) });
  }

  // ── Connections ──────────────────────────────────────────────────────────

  function handleNoteClick(e: React.MouseEvent, noteId: string) {
    if (!connectMode || readOnly) return;
    e.stopPropagation();
    if (!connectFrom) {
      setConnectFrom(noteId);
    } else if (connectFrom === noteId) {
      setConnectFrom(null); setPreviewCursor(null);
    } else {
      const dup = S.current.data.connections.some(
        (c) => (c.from === connectFrom && c.to === noteId) || (c.from === noteId && c.to === connectFrom),
      );
      if (!dup) {
        commit({
          ...S.current.data,
          connections: [...S.current.data.connections, { id: uid(), from: connectFrom, to: noteId, type: connectType }],
        });
      }
      setConnectFrom(null); setPreviewCursor(null);
    }
  }

  function deleteConn(id: string) {
    commit({ ...S.current.data, connections: S.current.data.connections.filter((c) => c.id !== id) });
    if (selectedConnId === id) setSelectedConnId(null);
  }

  // ── Keyboard ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.code === "Space" && target.tagName !== "TEXTAREA" && target.tagName !== "INPUT") {
        e.preventDefault(); setSpaceHeld(true);
      }
      if ((e.key === "Delete" || e.key === "Backspace") && target.tagName !== "TEXTAREA" && target.tagName !== "INPUT") {
        if (S.current.selectedNoteId) deleteNote(S.current.selectedNoteId);
        else if (S.current.selectedConnId) deleteConn(S.current.selectedConnId);
      }
      if (e.key === "Escape") {
        setEditingId(null); setConnectMode(false); setConnectFrom(null); setPreviewCursor(null);
        setSelectedNoteId(null); setSelectedConnId(null);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); undo(); }
    };
    const ku = (e: KeyboardEvent) => { if (e.code === "Space") setSpaceHeld(false); };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Wheel (zoom + pan) ───────────────────────────────────────────────────

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
        setZoom((z) => {
          const nz = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z * factor));
          const r = el.getBoundingClientRect();
          const cx = e.clientX - r.left, cy = e.clientY - r.top;
          setPan((p) => ({ x: cx - (cx - p.x) * (nz / z), y: cy - (cy - p.y) * (nz / z) }));
          return nz;
        });
      } else {
        setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
      }
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  // ── Global mouse move / up ────────────────────────────────────────────────

  useEffect(() => {
    const mm = (e: MouseEvent) => {
      if (panRef.current) {
        const dx = e.clientX - panRef.current.sx, dy = e.clientY - panRef.current.sy;
        setPan({ x: panRef.current.ox + dx, y: panRef.current.oy + dy });
        return;
      }
      if (dragRef.current) {
        const dx = (e.clientX - dragRef.current.sx) / zoom;
        const dy = (e.clientY - dragRef.current.sy) / zoom;
        const { id, ox, oy } = dragRef.current;
        setData((prev) => ({
          ...prev,
          notes: prev.notes.map((n) =>
            n.id === id ? { ...n, x: snapV(Math.max(0, ox + dx), S.current.snapGrid), y: snapV(Math.max(0, oy + dy), S.current.snapGrid) } : n,
          ),
        }));
        return;
      }
      if (resizeRef.current) {
        const dx = (e.clientX - resizeRef.current.sx) / zoom;
        const dy = (e.clientY - resizeRef.current.sy) / zoom;
        const { id, dir, ox, oy, ow, oh } = resizeRef.current;
        setData((prev) => ({
          ...prev,
          notes: prev.notes.map((n) => {
            if (n.id !== id) return n;
            let x = n.x, y = n.y, w = ow, h = oh;
            if (dir === "se" || dir === "ne") w = Math.max(MIN_W, ow + dx);
            if (dir === "sw" || dir === "nw") { w = Math.max(MIN_W, ow - dx); x = ox + ow - w; }
            if (dir === "se" || dir === "sw") h = Math.max(MIN_H, oh + dy);
            if (dir === "ne" || dir === "nw") { h = Math.max(MIN_H, oh - dy); y = oy + oh - h; }
            return { ...n, x, y, width: w, height: h };
          }),
        }));
      }
    };
    const mu = () => {
      if (panRef.current) { panRef.current = null; setPanning(false); return; }
      if (dragRef.current || resizeRef.current) {
        setData((prev) => { onChange?.(JSON.stringify(prev)); return prev; });
        dragRef.current = null; resizeRef.current = null;
      }
    };
    window.addEventListener("mousemove", mm);
    window.addEventListener("mouseup", mu);
    return () => { window.removeEventListener("mousemove", mm); window.removeEventListener("mouseup", mu); };
  }, [onChange, zoom]);

  // ── Viewport helpers ─────────────────────────────────────────────────────

  function zoomBy(f: number) { setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z * f))); }
  function resetView() { setZoom(1); setPan({ x: 60, y: 50 }); }
  function fitScreen() {
    const { notes } = S.current.data;
    if (!notes.length || !containerRef.current) { resetView(); return; }
    const el = containerRef.current;
    const mx = Math.min(...notes.map((n) => n.x));
    const my = Math.min(...notes.map((n) => n.y));
    const Mx = Math.max(...notes.map((n) => n.x + n.width));
    const My = Math.max(...notes.map((n) => n.y + n.height));
    const cw = el.clientWidth, ch = el.clientHeight;
    const nz = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.min(cw / (Mx - mx + 120), ch / (My - my + 120)) * 0.9));
    setZoom(nz);
    setPan({ x: (cw - (Mx - mx) * nz) / 2 - mx * nz, y: (ch - (My - my) * nz) / 2 - my * nz });
  }

  // ── Canvas pointer handlers ───────────────────────────────────────────────

  function onCanvasMD(e: React.MouseEvent) {
    if (e.button === 1 || (e.button === 0 && spaceHeld)) {
      e.preventDefault();
      panRef.current = { sx: e.clientX, sy: e.clientY, ox: pan.x, oy: pan.y };
      setPanning(true);
      return;
    }
    if (e.button === 0) {
      setSelectedNoteId(null); setSelectedConnId(null);
      if (connectMode && connectFrom) { setConnectFrom(null); setPreviewCursor(null); }
    }
  }

  function onCanvasMM(e: React.MouseEvent) {
    if (connectMode && connectFrom) {
      const pos = toCanvas(e.clientX, e.clientY);
      setPreviewCursor(pos);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const canvasCursor = panning ? "grabbing" : spaceHeld ? "grab" : connectMode ? "crosshair" : "default";

  // Grid background moves/scales with pan/zoom
  const gridBgStyle: React.CSSProperties = snapGrid
    ? {
        backgroundImage: "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
        backgroundSize: `${GRID * zoom}px ${GRID * zoom}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
      }
    : {
        backgroundImage: "radial-gradient(circle, var(--border) 1.5px, transparent 1.5px)",
        backgroundSize: `${GRID * zoom}px ${GRID * zoom}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
      };

  return (
    <div className="flex h-full flex-col" style={{ userSelect: "none" }}>

      {/* ── Toolbar ──────────────────────────────────────────────── */}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] bg-gradient-to-r from-white via-white to-slate-50/80 px-4 py-3">
          <div className="mr-2 rounded-2xl border border-[var(--border)] bg-white px-4 py-3 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-600">Canvas</p>
            <p className="mt-1 font-[var(--font-display)] text-sm font-bold tracking-tight text-[var(--text-strong)]">Atelier collaboratif</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Post-its, relations et cadrage visuel dans un meme espace.</p>
          </div>

          {/* Color dots */}
          <div className="flex items-center gap-1.5 rounded-2xl border border-[var(--border)] bg-white px-3 py-2 shadow-sm">
            {COLORS.map((c) => (
              <button
                key={c} type="button" title={c}
                onClick={() => setNewColor(c)}
                className={cn(
                  "h-5 w-5 rounded-full transition-all",
                  PALETTE[c].dotCls,
                  newColor === c
                    ? "scale-125 ring-2 ring-offset-1 ring-[var(--text-strong)]"
                    : "opacity-60 hover:opacity-100 hover:scale-110",
                )}
              />
            ))}
          </div>

          <button
            type="button" onClick={addNote}
            className="flex items-center gap-1.5 rounded-2xl border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--text-strong)] shadow-sm transition hover:border-brand-200 hover:text-brand-600"
          >
            <Plus className="h-3.5 w-3.5" />Post-it
          </button>

          <div className="h-5 w-px bg-[var(--border)]" />

          {/* Connect mode */}
          <button
            type="button"
            onClick={() => { setConnectMode((v) => !v); setConnectFrom(null); setPreviewCursor(null); }}
            className={cn(
              "flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-semibold shadow-sm transition",
              connectMode
                ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                : "border-[var(--border)] bg-white text-[var(--text-strong)] hover:border-brand-200 hover:text-brand-600",
            )}
          >
            <Link2 className="h-3.5 w-3.5" />
            {connectMode ? (connectFrom ? "→ 2e note…" : "→ 1re note…") : "Liaison"}
          </button>

          {connectMode && (
            <>
              <select
                value={connectType} onChange={(e) => setConnectType(e.target.value as ConnectionType)}
                className="rounded-2xl border border-[var(--border)] bg-white px-3 py-2 text-xs text-[var(--text-strong)] outline-none shadow-sm"
              >
                {CONN_TYPES.map((t) => (
                  <option key={t} value={t}>{CONN_INFO[t].short} {CONN_INFO[t].label}</option>
                ))}
              </select>
              <button
                type="button" title="Annuler"
                onClick={() => { setConnectMode(false); setConnectFrom(null); setPreviewCursor(null); }}
                className="flex h-9 w-9 items-center justify-center rounded-2xl border border-[var(--border)] bg-white shadow-sm transition hover:border-brand-200 hover:text-brand-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          )}

          {selectedConnId && (
            <>
              <div className="h-5 w-px bg-[var(--border)]" />
              <button
                type="button"
                onClick={() => deleteConn(selectedConnId)}
                className="flex items-center gap-1.5 rounded-2xl border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" />Supprimer liaison
              </button>
            </>
          )}

          {/* Right side controls */}
          <div className="ml-auto flex items-center gap-2 rounded-[28px] border border-[var(--border)] bg-white px-2 py-1.5 shadow-sm">
            <button
              type="button" onClick={() => setSnapGrid((v) => !v)}
              className={cn(
                "rounded-2xl border px-3 py-2 text-xs font-semibold transition",
                snapGrid
                  ? "border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--brand)]"
                  : "border-[var(--border)] bg-white text-[var(--text-muted)] hover:border-brand-200 hover:text-brand-600",
              )}
            >Grille</button>

            <button
              type="button" onClick={undo} disabled={!history.length} title="Annuler (Ctrl+Z)"
              className="flex h-9 w-9 items-center justify-center rounded-2xl border border-[var(--border)] bg-white transition hover:border-brand-200 hover:text-brand-600 disabled:opacity-30"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>

            <div className="h-5 w-px bg-[var(--border)]" />

            <button
              type="button" onClick={() => zoomBy(1 / 1.2)} title="Dézoomer"
              className="flex h-9 w-9 items-center justify-center rounded-2xl border border-[var(--border)] bg-white transition hover:border-brand-200 hover:text-brand-600"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <button
              type="button" onClick={resetView} title="Réinitialiser vue"
              className="min-w-[3.8rem] rounded-2xl border border-[var(--border)] bg-white px-2 py-2 text-center font-mono text-xs transition hover:border-brand-200 hover:text-brand-600"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button" onClick={() => zoomBy(1.2)} title="Zoomer"
              className="flex h-9 w-9 items-center justify-center rounded-2xl border border-[var(--border)] bg-white transition hover:border-brand-200 hover:text-brand-600"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              type="button" onClick={fitScreen}
              className="rounded-2xl border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold transition hover:border-brand-200 hover:text-brand-600"
            >Ajuster</button>
          </div>
        </div>
      )}

      {/* ── Canvas ──────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden bg-gradient-to-br from-slate-50 via-white to-brand-50/30"
        style={{ cursor: canvasCursor, ...gridBgStyle }}
        onMouseDown={onCanvasMD}
        onMouseMove={onCanvasMM}
      >
        {/* Transformed layer */}
        <div
          className="absolute origin-top-left"
          style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`, willChange: "transform" }}
        >

          {/* SVG connections */}
          <svg
            className="absolute"
            style={{ left: 0, top: 0, width: "10000px", height: "10000px", overflow: "visible", pointerEvents: "none" }}
          >
            <SvgDefs />

            {data.connections.map((conn) => {
              const fn = data.notes.find((n) => n.id === conn.from);
              const tn = data.notes.find((n) => n.id === conn.to);
              if (!fn || !tn) return null;
              const fcx = fn.x + fn.width / 2, fcy = fn.y + fn.height / 2;
              const tcx = tn.x + tn.width / 2, tcy = tn.y + tn.height / 2;
              const src = edgeInfo(fcx, fcy, fn.width, fn.height, tcx, tcy);
              const dst = edgeInfo(tcx, tcy, tn.width, tn.height, fcx, fcy);
              const d = bezierPath(src.x, src.y, src.dx, src.dy, dst.x, dst.y, dst.dx, dst.dy);
              const mid = bezierMid(src.x, src.y, src.dx, src.dy, dst.x, dst.y, dst.dx, dst.dy);
              const info = CONN_INFO[conn.type];
              const isSel = selectedConnId === conn.id;
              const stroke = isSel ? "#3b82f6" : isDark ? "#6b7280" : "#9ca3af";
              const labelColor = isSel ? "#3b82f6" : isDark ? "#9ca3af" : "#c4cdd6";

              return (
                <g key={conn.id} style={{ pointerEvents: "all" }}>
                  {/* Invisible wide hit area */}
                  <path d={d} fill="none" stroke="transparent" strokeWidth={20}
                    style={{ pointerEvents: "stroke", cursor: "pointer" }}
                    onClick={(e) => { e.stopPropagation(); setSelectedConnId(isSel ? null : conn.id); setSelectedNoteId(null); }}
                  />

                  {/* Selection glow (blurred duplicate behind) */}
                  {isSel && (
                    <path d={d} fill="none" stroke="#93c5fd" strokeWidth={4}
                      strokeLinecap="round" style={{ pointerEvents: "none", filter: "blur(3px)", opacity: 0.6 }}
                    />
                  )}

                  {/* Main path — rounded linecap for organic feel */}
                  <path
                    d={d} fill="none" stroke={stroke}
                    strokeWidth={isSel ? 2 : info.sw}
                    strokeDasharray={info.dash}
                    strokeLinecap="round"
                    markerEnd={info.mEnd} markerStart={info.mStart}
                    style={{ pointerEvents: "none" }}
                  />

                  {/* Subtle type label (no background box) — only for non-arrow types */}
                  {conn.type !== "arrow" && (
                    <text
                      x={mid.x} y={mid.y - 7}
                      textAnchor="middle"
                      fill={labelColor}
                      fontSize="9"
                      fontFamily="system-ui, sans-serif"
                      letterSpacing="0.03em"
                      style={{ pointerEvents: "none", userSelect: "none" }}
                    >
                      {info.label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Connection preview — gentle dashed line from source edge to cursor */}
            {connectMode && connectFrom && previewCursor && (() => {
              const fn = data.notes.find((n) => n.id === connectFrom);
              if (!fn) return null;
              const fcx = fn.x + fn.width / 2, fcy = fn.y + fn.height / 2;
              const src = edgeInfo(fcx, fcy, fn.width, fn.height, previewCursor.x, previewCursor.y);
              // Use a small bezier instead of straight line for a smoother preview
              const px = previewCursor.x, py = previewCursor.y;
              const dist = Math.hypot(px - src.x, py - src.y);
              const off = Math.max(16, Math.min(dist * 0.26, 70));
              const pd = `M ${src.x} ${src.y} C ${src.x + src.dx * off} ${src.y + src.dy * off}, ${px} ${py}, ${px} ${py}`;
              return (
                <path
                  d={pd} fill="none"
                  stroke="#60a5fa" strokeWidth={1.5} strokeOpacity={0.7}
                  strokeDasharray="5 4" strokeLinecap="round"
                  markerEnd="url(#wb-ae)"
                  style={{ pointerEvents: "none" }}
                />
              );
            })()}
          </svg>

          {/* Empty state */}
          {data.notes.length === 0 && !readOnly && (
            <div style={{ position: "absolute", left: "45vw", top: "35vh", transform: "translate(-50%,-50%)" }}>
              <div
                className="rounded-2xl border-2 border-dashed border-[var(--border)] px-12 py-10 text-center"
                style={{ background: isDark ? "rgba(30,41,59,.4)" : "rgba(255,255,255,.6)" }}
              >
                <p className="text-base font-semibold text-[var(--text-strong)]">Tableau blanc vide</p>
                <p className="mt-2 max-w-xs text-sm text-[var(--text-muted)]">
                  Cliquez sur <strong>+ Post-it</strong> pour ajouter une note.<br />
                  Pincez ou Ctrl+Scroll pour zoomer · Espace+Glisser pour déplacer.
                </p>
              </div>
            </div>
          )}

          {/* Notes */}
          {data.notes.map((note) => {
            const theme = PALETTE[note.color];
            const isSel = selectedNoteId === note.id;
            const isEdit = editingId === note.id;
            const isConnFrom = connectFrom === note.id;
            const bodyBg = isDark ? PALETTE_DARK_BODY[note.color] : theme.bodyBg;
            const textColor = isDark ? DARK_TEXT[note.color] : undefined;

            return (
              <div key={note.id}>

                {/* Floating toolbar (above selected note) */}
                {isSel && !isEdit && !connectMode && !readOnly && (
                  <div
                    className="absolute z-50 flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] px-2 py-1 shadow-2xl"
                    style={{
                      left: note.x + note.width / 2,
                      top: note.y - 50,
                      transform: "translateX(-50%)",
                      // keep toolbar at readable scale even when zoomed out
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {COLORS.map((c) => (
                      <button
                        key={c} type="button" title={c}
                        onClick={() => updateColor(note.id, c)}
                        className={cn(
                          "h-4 w-4 rounded-full transition-all hover:scale-110",
                          PALETTE[c].dotCls,
                          note.color === c ? "ring-2 ring-offset-1 ring-[var(--text-strong)] scale-110" : "opacity-70",
                        )}
                      />
                    ))}
                    <div className="mx-1 h-4 w-px bg-[var(--border)]" />
                    <button
                      type="button" title="Éditer" onClick={() => setEditingId(note.id)}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-muted)] transition hover:bg-[var(--bg-panel-2)] hover:text-[var(--text-strong)]"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      type="button" title="Supprimer" onClick={() => deleteNote(note.id)}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-red-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}

                {/* The sticky note */}
                <div
                  className="group absolute overflow-hidden rounded-2xl transition-[box-shadow]"
                  style={{
                    left: note.x, top: note.y,
                    width: note.width, height: note.height,
                    boxShadow: isSel
                      ? `0 0 0 2.5px #3b82f6, 0 12px 40px ${theme.shadow}, 0 4px 12px rgba(0,0,0,.14)`
                      : isConnFrom
                      ? `0 0 0 2.5px #f59e0b, 0 8px 24px ${theme.shadow}`
                      : `0 4px 16px ${theme.shadow}, 0 2px 6px rgba(0,0,0,.10)`,
                    zIndex: isSel ? 20 : 10,
                    cursor: connectMode ? "pointer" : isEdit ? "text" : "grab",
                  }}
                  onMouseDown={(e) => {
                    if (readOnly || spaceHeld || connectMode || isEdit) return;
                    e.stopPropagation(); e.preventDefault();
                    setSelectedNoteId(note.id);
                    dragRef.current = { id: note.id, sx: e.clientX, sy: e.clientY, ox: note.x, oy: note.y };
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!connectMode) { setSelectedNoteId(note.id); setSelectedConnId(null); }
                    handleNoteClick(e, note.id);
                  }}
                  onDoubleClick={() => {
                    if (!readOnly && !connectMode) { setEditingId(note.id); setSelectedNoteId(note.id); }
                  }}
                >
                  {/* Gradient tape header (no label — pure color band) */}
                  <div
                    className="h-6"
                    style={{ background: theme.tape }}
                  />

                  {/* Note body */}
                  <div
                    className="relative"
                    style={{
                      height: "calc(100% - 28px)",
                      background: bodyBg,
                      padding: "10px 12px 20px",
                    }}
                  >
                    {isEdit && !readOnly ? (
                      <textarea
                        autoFocus
                        value={note.content}
                        onChange={(e) => updateContent(note.id, e.target.value)}
                        onBlur={() => { setEditingId(null); flushContent(); }}
                        onMouseDown={(e) => e.stopPropagation()}
                        style={{ color: textColor }}
                        className={cn(
                          "h-full w-full resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:opacity-40",
                          theme.textCls,
                        )}
                        placeholder="Tapez votre idée…"
                      />
                    ) : (
                      <p
                        className={cn("whitespace-pre-wrap text-sm leading-relaxed", theme.textCls)}
                        style={{ color: textColor }}
                      >
                        {note.content || (
                          !readOnly && <span className="italic opacity-30 text-xs">Double-clic pour éditer…</span>
                        )}
                      </p>
                    )}

                    {/* Folded corner effect */}
                    <div
                      className="pointer-events-none absolute bottom-0 right-0 h-6 w-6"
                      style={{ background: "linear-gradient(225deg,rgba(0,0,0,.13) 50%,transparent 50%)" }}
                    />
                  </div>

                  {/* Resize handles (4 corners, shown when selected) */}
                  {isSel && !isEdit && !readOnly && !connectMode &&
                    RESIZE.map(({ dir, pos, cursor }) => (
                      <div
                        key={dir}
                        className="absolute z-30 h-3.5 w-3.5 rounded-full border-2 border-white bg-[var(--brand)] shadow-md"
                        style={{ ...pos, cursor }}
                        onMouseDown={(e) => {
                          if (readOnly) return;
                          e.preventDefault(); e.stopPropagation();
                          resizeRef.current = { id: note.id, dir, sx: e.clientX, sy: e.clientY, ox: note.x, oy: note.y, ow: note.width, oh: note.height };
                        }}
                      />
                    ))
                  }
                </div>
              </div>
            );
          })}
        </div>

        {/* Keyboard hints overlay */}
        <div className="pointer-events-none absolute bottom-3 right-4 flex items-center gap-3 rounded-lg bg-[var(--bg-panel)]/70 px-3 py-1.5 text-[10px] text-[var(--text-muted)] backdrop-blur-sm">
          <span>Ctrl+Scroll → Zoom</span>
          <span className="opacity-50">|</span>
          <span>Espace+Glisser → Déplacer</span>
          <span className="opacity-50">|</span>
          <span>Suppr → Effacer</span>
          <span className="opacity-50">|</span>
          <span>Ctrl+Z → Annuler</span>
        </div>
      </div>
    </div>
  );
}

export function WhiteboardEditor(props: WhiteboardEditorProps) {
  return <TldrawWhiteboardEditor {...props} />;
}
