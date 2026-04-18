import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Eraser,
  MousePointer2,
  PenLine,
  Plus,
  Share2,
  StickyNote,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  DefaultColorStyle,
  DefaultSizeStyle,
  Tldraw,
  createShapeId,
  getSnapshot,
  toRichText,
  type Editor,
  type TLStoreSnapshot,
} from "tldraw";
import "tldraw/tldraw.css";
import { cn } from "../../lib/utils";

interface TldrawWhiteboardEditorProps {
  content: string;
  onChange?: (json: string) => void;
  readOnly?: boolean;
  title?: string;
  onBack?: () => void;
  saveStatus?: "idle" | "pending" | "saved";
}

interface LegacyNote {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  color: "yellow" | "pink" | "blue" | "green" | "purple" | "orange";
}

interface LegacyBoard {
  notes: LegacyNote[];
}

type MepoTool = "select" | "draw" | "note" | "text" | "arrow" | "eraser";
type MepoColor = "violet" | "blue" | "green" | "yellow";
type MepoSize = "m" | "l" | "xl";
const TOOL_LABELS: Record<MepoTool, string> = {
  select: "Selection",
  draw: "Tracer",
  note: "Note",
  text: "Texte",
  arrow: "Lien",
  eraser: "Effacer",
};

const TOOL_ITEMS: { id: MepoTool; label: string; icon: typeof MousePointer2 }[] = [
  { id: "select", label: "Sélection", icon: MousePointer2 },
  { id: "draw", label: "Tracer", icon: PenLine },
  { id: "note", label: "Note", icon: StickyNote },
  { id: "text", label: "Texte", icon: Type },
  { id: "arrow", label: "Lien", icon: Plus },
  { id: "eraser", label: "Effacer", icon: Eraser },
];

const COLOR_ITEMS: { id: MepoColor; label: string; swatch: string }[] = [
  { id: "violet", label: "Violet", swatch: "#8B5CF6" },
  { id: "blue", label: "Bleu", swatch: "#3B82F6" },
  { id: "green", label: "Vert", swatch: "#10B981" },
  { id: "yellow", label: "Jaune", swatch: "#FACC15" },
];

const SIZE_ITEMS: { id: MepoSize; label: string }[] = [
  { id: "m", label: "M" },
  { id: "l", label: "L" },
  { id: "xl", label: "XL" },
];

const COLLABORATORS = [
  { id: "maryam", label: "MG", classes: "from-[#FF5A1F] to-[#E04510]" },
  { id: "po", label: "PO", classes: "from-[#3B82F6] to-[#10B981]" },
  { id: "ux", label: "UX", classes: "from-[#FACC15] to-[#F59E0B]" },
];

function parseSnapshot(content: string): TLStoreSnapshot | null {
  if (!content.trim()) return null;

  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (parsed && typeof parsed === "object" && "store" in parsed && "schema" in parsed) {
      return parsed as unknown as TLStoreSnapshot;
    }
  } catch {
    return null;
  }

  return null;
}

function parseLegacyBoard(content: string): LegacyBoard | null {
  if (!content.trim()) return null;

  try {
    const parsed = JSON.parse(content) as { notes?: unknown };
    if (Array.isArray(parsed.notes)) {
      return {
        notes: parsed.notes as LegacyNote[],
      };
    }
  } catch {
    return null;
  }

  return null;
}

function legacyColorToTldraw(color: LegacyNote["color"]) {
  const map: Record<LegacyNote["color"], "yellow" | "red" | "blue" | "green" | "violet" | "orange"> = {
    yellow: "yellow",
    pink: "red",
    blue: "blue",
    green: "green",
    purple: "violet",
    orange: "orange",
  };

  return map[color] ?? "yellow";
}

function toolToTldraw(tool: MepoTool): string {
  const map: Record<MepoTool, string> = {
    select: "select",
    draw: "draw",
    note: "note",
    text: "text",
    arrow: "arrow",
    eraser: "eraser",
  };

  return map[tool];
}

function colorToTldraw(color: MepoColor): "violet" | "blue" | "green" | "yellow" {
  return color;
}

function sizeToTldraw(size: MepoSize): "m" | "l" | "xl" {
  return size;
}

export function TldrawWhiteboardEditor({
  content,
  onChange,
  readOnly = false,
  title = "Whiteboard",
  onBack,
  saveStatus = "idle",
}: TldrawWhiteboardEditorProps) {
  const initialSnapshot = useMemo(() => parseSnapshot(content), [content]);
  const legacyBoard = useMemo(() => parseLegacyBoard(content), [content]);
  const editorRef = useRef<Editor | null>(null);
  const disposePersistRef = useRef<(() => void) | null>(null);
  const disposeUiRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSerializedRef = useRef(content.trim());
  const initializedLegacyRef = useRef(false);

  const [activeTool, setActiveTool] = useState<MepoTool>("select");
  const [selectionState, setSelectionState] = useState<{
    visible: boolean;
    x: number;
    y: number;
  }>({ visible: false, x: 0, y: 0 });

  useEffect(() => {
    return () => {
      disposePersistRef.current?.();
      disposeUiRef.current?.();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const syncUiState = useCallback((editor: Editor) => {
    const rawTool = editor.getCurrentToolId();
    const normalizedTool = (["select", "draw", "note", "text", "arrow", "eraser"].includes(rawTool)
      ? rawTool
      : "select") as MepoTool;
    setActiveTool(normalizedTool);

    const selectedIds = editor.getSelectedShapeIds();
    if (!selectedIds.length || readOnly) {
      setSelectionState((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      return;
    }

    const bounds = editor.getSelectionPageBounds();
    if (!bounds) {
      setSelectionState((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      return;
    }

    const viewportPoint = editor.pageToViewport({
      x: bounds.x + bounds.w / 2,
      y: bounds.y - 18,
    });

    setSelectionState({
      visible: true,
      x: viewportPoint.x,
      y: viewportPoint.y,
    });
  }, [readOnly]);

  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor;

    editor.updateInstanceState({
      isReadonly: readOnly,
    });

    if (!initialSnapshot && legacyBoard && !initializedLegacyRef.current) {
      initializedLegacyRef.current = true;

      editor.createShapes(
        legacyBoard.notes.map((note) => ({
          id: createShapeId(note.id),
          type: "note" as const,
          x: note.x,
          y: note.y,
          props: {
            color: legacyColorToTldraw(note.color),
            labelColor: "black" as const,
            size: "m" as const,
            font: "sans" as const,
            align: "middle" as const,
            verticalAlign: "middle" as const,
            richText: toRichText(note.content || ""),
            scale: 1,
            growY: Math.max(0, note.height - 164),
            url: "",
          },
        })),
      );
    }

    syncUiState(editor);

    disposeUiRef.current?.();
    disposeUiRef.current = editor.store.listen(
      () => {
        syncUiState(editor);
      },
      { scope: "all", source: "user" },
    );

    if (!onChange || readOnly) return;

    const persist = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const snapshot = getSnapshot(editor.store);
        const serialized = JSON.stringify(snapshot);
        if (serialized !== lastSerializedRef.current) {
          lastSerializedRef.current = serialized;
          onChange(serialized);
        }
      }, 300);
    };

    disposePersistRef.current?.();
    disposePersistRef.current = editor.store.listen(
      () => {
        persist();
      },
      { source: "user", scope: "all" },
    );
  }, [initialSnapshot, legacyBoard, onChange, readOnly, syncUiState]);

  const handleToolChange = useCallback((tool: MepoTool) => {
    const editor = editorRef.current;
    if (!editor || readOnly) return;
    editor.setCurrentTool(toolToTldraw(tool));
    setActiveTool(tool);
  }, [readOnly]);

  const handleColorChange = useCallback((color: MepoColor) => {
    const editor = editorRef.current;
    if (!editor || readOnly) return;
    editor.setStyleForSelectedShapes(DefaultColorStyle, colorToTldraw(color));
  }, [readOnly]);

  const handleSizeChange = useCallback((size: MepoSize) => {
    const editor = editorRef.current;
    if (!editor || readOnly) return;
    editor.setStyleForSelectedShapes(DefaultSizeStyle, sizeToTldraw(size));
  }, [readOnly]);

  const handleZoomIn = useCallback(() => {
    editorRef.current?.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    editorRef.current?.zoomOut();
  }, []);

  const handleZoomReset = useCallback(() => {
    editorRef.current?.resetZoom();
  }, []);

  const handleUndo = useCallback(() => {
    editorRef.current?.undo();
  }, []);

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[var(--paper-2)] [font-family:var(--font-body)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundColor: "var(--paper-2)",
          backgroundImage: "radial-gradient(circle, var(--rule) 1px, transparent 1.5px)",
          backgroundSize: "22px 22px",
        }}
      />

      <div className="hidden">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/78 text-slate-600 shadow-[0_10px_24px_rgba(15,23,42,0.08)] backdrop-blur-md transition duration-200 ease-in-out hover:bg-white hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#3B82F6]">Whiteboard</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-[#0F172A]">{title}</h2>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {saveStatus === "pending" && (
            <span className="rounded-full bg-white/78 px-3 py-1 text-[11px] font-medium text-slate-500 shadow-[0_10px_24px_rgba(15,23,42,0.06)] backdrop-blur-md">
              Enregistrement…
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="rounded-full bg-white/78 px-3 py-1 text-[11px] font-medium text-[#10B981] shadow-[0_10px_24px_rgba(15,23,42,0.06)] backdrop-blur-md">
              Enregistré
            </span>
          )}

        </div>
      </div>

      <div className="pointer-events-none absolute left-[18px] top-[18px] z-20 flex items-start gap-3">
        <button
          type="button"
          onClick={onBack}
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-[var(--rule)] bg-[var(--paper)] text-[var(--ink-3)] shadow-[0_12px_28px_rgba(28,24,20,0.08)] transition hover:bg-[var(--paper-2)] hover:text-[var(--ink)]"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="pointer-events-auto rounded-[18px] border border-[var(--rule)] bg-[var(--paper)] px-4 py-3 shadow-[0_16px_32px_rgba(28,24,20,0.08)]">
          <p className="eyebrow">Whiteboard</p>
          <h2 className="mt-1 font-[var(--font-display)] text-[28px] leading-[1.02] tracking-[-0.03em] text-[var(--ink)]">
            {title}
          </h2>
        </div>
      </div>

      <div className="pointer-events-none absolute right-[18px] top-[18px] z-20 flex items-center gap-2">
        {saveStatus === "pending" ? (
          <span className="pointer-events-auto mono rounded-full border border-[var(--rule)] bg-[var(--paper)] px-3 py-2 text-[11px] text-[var(--ink-4)]">
            Enregistrement...
          </span>
        ) : null}
        {saveStatus === "saved" ? (
          <span className="pointer-events-auto mono rounded-full border border-[var(--rule)] bg-[var(--paper)] px-3 py-2 text-[11px] text-[var(--success)]">
            Enregistre
          </span>
        ) : null}
        <button type="button" className="pointer-events-auto btn ghost">
          <Share2 className="h-4 w-4" />
          Partager
        </button>
        <button type="button" className="pointer-events-auto btn accent">+ Inviter</button>
        <div className="pointer-events-auto flex -space-x-2">
          {COLLABORATORS.slice(0, 1).map((person) => (
            <span
              key={person.id}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full border border-[var(--paper)] bg-gradient-to-br text-[11px] font-semibold text-white shadow-[0_8px_20px_rgba(28,24,20,0.12)]",
                person.classes,
              )}
              title={person.id}
            >
              {person.label}
            </span>
          ))}
        </div>
      </div>

      <div className="relative z-10 min-h-0 flex-1">
        {selectionState.visible && !readOnly && (
          <div
            className="pointer-events-auto absolute z-30 -translate-x-1/2 -translate-y-full rounded-full border border-[var(--rule)] bg-[var(--paper)] px-3 py-2 shadow-[0_18px_40px_rgba(28,24,20,0.14)]"
            style={{ left: selectionState.x, top: selectionState.y }}
          >
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-full bg-[var(--paper-2)] px-1.5 py-1">
                {COLOR_ITEMS.map((color) => (
                  <button
                    key={color.id}
                    type="button"
                    title={color.label}
                    onClick={() => handleColorChange(color.id)}
                    className="h-7 w-7 rounded-full ring-2 ring-[var(--paper)] transition duration-200 ease-in-out hover:scale-105"
                    style={{ backgroundColor: color.swatch }}
                  />
                ))}
              </div>
              <div className="h-6 w-px bg-[var(--rule)]" />
              <div className="flex items-center gap-1 rounded-full bg-[var(--paper-2)] p-1">
                {SIZE_ITEMS.map((size) => (
                  <button
                    key={size.id}
                    type="button"
                    onClick={() => handleSizeChange(size.id)}
                    className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-[var(--ink-3)] transition duration-200 ease-in-out hover:bg-[var(--paper)] hover:text-[var(--ink)]"
                  >
                    {size.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="absolute inset-0 z-10 [&_.tl-container]:bg-transparent [&_.tl-background]:bg-transparent [&_.tl-canvas]:bg-transparent [&_.tlui-style-panel]:hidden [&_.tlui-menu-zone]:hidden [&_.tlui-help-menu]:hidden [&_.tlui-navigation-panel]:hidden">
          <Tldraw
            {...({ hideUi: true, hideDefaultUi: true } as Record<string, unknown>)}
            snapshot={initialSnapshot ?? undefined}
            onMount={handleMount}
            autoFocus
          />
        </div>
      </div>

      {!readOnly && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 flex justify-center px-6">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-[var(--rule)] bg-[var(--paper)] px-3 py-3 shadow-[0_24px_60px_rgba(28,24,20,0.14)]">
            {TOOL_ITEMS.map((tool) => {
              const Icon = tool.icon;
              const isActive = activeTool === tool.id;
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => handleToolChange(tool.id)}
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-full text-[var(--ink-3)] transition duration-200 ease-in-out hover:bg-[var(--paper-2)] hover:text-[var(--ink)]",
                    isActive && "bg-[var(--ink)] text-[var(--paper)] shadow-[0_14px_32px_rgba(28,24,20,0.18)]",
                  )}
                  title={TOOL_LABELS[tool.id]}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}

            <div className="mx-1 h-8 w-px bg-[var(--rule)]" />

            <button
              type="button"
              onClick={handleUndo}
              className="flex h-12 w-12 items-center justify-center rounded-full text-[var(--ink-3)] transition duration-200 ease-in-out hover:bg-[var(--paper-2)] hover:text-[var(--ink)]"
              title="Annuler"
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              className="flex h-12 w-12 items-center justify-center rounded-full text-[var(--ink-3)] transition duration-200 ease-in-out hover:bg-[var(--paper-2)] hover:text-[var(--ink)]"
              title="Zoom arrière"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleZoomReset}
              className="rounded-full px-3 py-2 text-xs font-semibold text-[var(--ink-3)] transition duration-200 ease-in-out hover:bg-[var(--paper-2)] hover:text-[var(--ink)]"
              title="Réinitialiser le zoom"
            >
              100%
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              className="flex h-12 w-12 items-center justify-center rounded-full text-[var(--ink-3)] transition duration-200 ease-in-out hover:bg-[var(--paper-2)] hover:text-[var(--ink)]"
              title="Zoom avant"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <div className="mx-1 h-8 w-px bg-[var(--rule)]" />
            <button type="button" className="btn accent">MePO Ask</button>
          </div>
        </div>
      )}
    </div>
  );
}
