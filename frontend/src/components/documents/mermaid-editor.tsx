import { useEffect, useId, useRef, useState } from "react";
import {
  Check, Copy, Download, Minus, Plus, RotateCcw, ZoomIn, ZoomOut,
} from "lucide-react";
import { cn } from "../../lib/utils";

// ─── Templates ────────────────────────────────────────────────────────────────

interface Template { label: string; icon: string; code: string }

const TEMPLATES: Template[] = [
  {
    label: "Flux",
    icon: "⟶",
    code: `flowchart TD
    A([Début]) --> B{Condition ?}
    B -->|Oui| C[Action A]
    B -->|Non| D[Action B]
    C --> E([Fin])
    D --> E`,
  },
  {
    label: "Séquence",
    icon: "↕",
    code: `sequenceDiagram
    autonumber
    participant U as Utilisateur
    participant A as API
    participant DB as Base de données

    U->>A: POST /api/data
    A->>DB: INSERT INTO ...
    DB-->>A: OK
    A-->>U: 201 Created`,
  },
  {
    label: "Gantt",
    icon: "▬",
    code: `gantt
    title Planning Sprint
    dateFormat  YYYY-MM-DD
    section Backend
    API auth       :done,    a1, 2024-01-01, 3d
    API data       :active,  a2, 2024-01-04, 4d
    Tests          :         a3, after a2, 2d
    section Frontend
    Maquettes      :done,    f1, 2024-01-01, 2d
    Composants     :active,  f2, 2024-01-03, 5d
    Intégration    :         f3, after f2, 3d`,
  },
  {
    label: "Entités",
    icon: "⬜",
    code: `erDiagram
    USER {
        uuid id PK
        string email
        string full_name
        timestamp created_at
    }
    PROJECT {
        uuid id PK
        string name
        uuid owner_id FK
    }
    SPACE {
        uuid id PK
        string name
        uuid project_id FK
    }
    USER ||--o{ PROJECT : "owns"
    PROJECT ||--o{ SPACE : "contains"`,
  },
  {
    label: "Classes",
    icon: "◧",
    code: `classDiagram
    class Animal {
        +String name
        +int age
        +makeSound() void
    }
    class Dog {
        +String breed
        +fetch() void
    }
    class Cat {
        +indoor bool
        +purr() void
    }
    Animal <|-- Dog
    Animal <|-- Cat`,
  },
  {
    label: "États",
    icon: "◉",
    code: `stateDiagram-v2
    [*] --> Brouillon
    Brouillon --> EnRevue : soumettre
    EnRevue --> Approuvé : approuver
    EnRevue --> Brouillon : rejeter
    Approuvé --> Publié : publier
    Publié --> Archivé : archiver
    Archivé --> [*]`,
  },
  {
    label: "Mindmap",
    icon: "✦",
    code: `mindmap
  root((MePO))
    Suivi
      Topics
      Kanban
      Backlog
      Roadmap
    Documents
      Pages
      Whiteboard
      Mermaid
    Chat
      AI Assistant
      Historique`,
  },
];

// ─── MermaidEditor ────────────────────────────────────────────────────────────

interface MermaidEditorProps {
  code: string;
  onChange?: (code: string) => void;
  readOnly?: boolean;
}

export function MermaidEditor({ code, onChange, readOnly = false }: MermaidEditorProps) {
  const uid = useId().replace(/:/g, "");
  const [localCode, setLocalCode] = useState(code || TEMPLATES[0].code);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [showTemplates, setShowTemplates] = useState(!code?.trim());
  const renderRef = useRef<number>(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentCode = readOnly ? code : localCode;

  // ── Render ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!currentCode?.trim()) return;
    const tick = ++renderRef.current;

    const timeout = setTimeout(async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: document.documentElement.classList.contains("dark") ? "dark" : "default",
          securityLevel: "loose",
          fontFamily: "system-ui, -apple-system, sans-serif",
          fontSize: 13,
        });
        const id = `mmd-${uid}-${tick}`;
        const { svg: rendered } = await mermaid.render(id, currentCode);
        if (tick !== renderRef.current) return;
        setSvg(rendered);
        setError(null);
      } catch (err) {
        if (tick !== renderRef.current) return;
        setSvg(null);
        setError(err instanceof Error ? err.message.split("\n")[0] : "Erreur de syntaxe");
      }
    }, 280);

    return () => clearTimeout(timeout);
  }, [currentCode, uid]);

  // ── Helpers ──────────────────────────────────────────────────────────────

  function handleCodeChange(val: string) {
    setLocalCode(val);
    onChange?.(val);
    setShowTemplates(false);
  }

  function applyTemplate(tpl: Template) {
    handleCodeChange(tpl.code);
    setShowTemplates(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  function copyCode() {
    navigator.clipboard.writeText(currentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadSvg() {
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "diagram.svg"; a.click();
    URL.revokeObjectURL(url);
  }

  function zoomPreview(delta: number) {
    setPreviewZoom((z) => Math.min(4, Math.max(0.2, z + delta)));
  }

  // ── Tab key in textarea ───────────────────────────────────────────────────

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const next = localCode.substring(0, start) + "    " + localCode.substring(end);
      handleCodeChange(next);
      // Restore cursor position after React re-render
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 4;
      });
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      // Force re-render
      renderRef.current = 0;
      handleCodeChange(localCode + " ");
      setTimeout(() => handleCodeChange(localCode), 10);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col">

      {/* ── Toolbar ──────────────────────────────────────────────── */}
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-panel)] px-4 py-2">

        {/* Templates dropdown */}
        {!readOnly && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowTemplates((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition",
                showTemplates
                  ? "border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--brand)]"
                  : "border-[var(--border)] bg-[var(--bg-panel-2)] text-[var(--text-strong)] hover:bg-[var(--bg-panel-3)]",
              )}
            >
              ✦ Templates
            </button>
          </div>
        )}

        {!readOnly && <div className="h-5 w-px bg-[var(--border)]" />}

        {/* Copy code */}
        <button
          type="button" onClick={copyCode}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 py-1.5 text-xs font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-panel-3)]"
        >
          {copied ? <><Check className="h-3.5 w-3.5 text-emerald-500" />Copié</> : <><Copy className="h-3.5 w-3.5" />Copier</>}
        </button>

        {/* Download SVG */}
        {svg && (
          <button
            type="button" onClick={downloadSvg}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 py-1.5 text-xs font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-panel-3)]"
          >
            <Download className="h-3.5 w-3.5" />SVG
          </button>
        )}

        {/* Preview zoom */}
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button" onClick={() => zoomPreview(-0.15)} title="Réduire l'aperçu"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-panel-2)] transition hover:bg-[var(--bg-panel-3)]"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button
            type="button" onClick={() => setPreviewZoom(1)}
            className="min-w-[3rem] rounded-lg border border-[var(--border)] bg-[var(--bg-panel-2)] px-1.5 py-1 text-center font-mono text-xs transition hover:bg-[var(--bg-panel-3)]"
          >
            {Math.round(previewZoom * 100)}%
          </button>
          <button
            type="button" onClick={() => zoomPreview(0.15)} title="Agrandir l'aperçu"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-panel-2)] transition hover:bg-[var(--bg-panel-3)]"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            type="button" onClick={() => setPreviewZoom(1)} title="Réinitialiser zoom"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-panel-2)] transition hover:bg-[var(--bg-panel-3)]"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* ── Template gallery ─────────────────────────────────────── */}
      {showTemplates && !readOnly && (
        <div className="flex flex-shrink-0 flex-wrap gap-2 border-b border-[var(--border)] bg-[var(--bg-panel-2)]/60 px-4 py-3">
          <span className="w-full text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Choisir un modèle</span>
          {TEMPLATES.map((tpl) => (
            <button
              key={tpl.label}
              type="button"
              onClick={() => applyTemplate(tpl)}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] px-3 py-2 text-xs font-medium text-[var(--text-strong)] transition hover:border-[var(--brand)]/50 hover:bg-[var(--brand)]/5 hover:text-[var(--brand)]"
            >
              <span className="text-sm">{tpl.icon}</span>
              {tpl.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Split pane ───────────────────────────────────────────── */}
      <div className="grid min-h-0 flex-1 overflow-hidden md:grid-cols-2">

        {/* Code editor pane */}
        {!readOnly && (
          <div className="flex min-h-0 flex-col border-r border-[var(--border)]">
            <div className="flex flex-shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--bg-panel-3)]/50 px-3 py-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Code Mermaid</span>
              <span className="text-[9px] text-[var(--text-muted)]">Tab → indenter · Ctrl+Entrée → actualiser</span>
            </div>
            <div className="relative flex-1 overflow-hidden">
              {/* Line numbers */}
              <div
                className="pointer-events-none absolute left-0 top-0 h-full select-none overflow-hidden pt-4 text-right font-mono text-[11px] leading-6 text-[var(--text-muted)]/40"
                style={{ width: 36 }}
                aria-hidden
              >
                {localCode.split("\n").map((_, i) => (
                  <div key={i} className="pr-2">{i + 1}</div>
                ))}
              </div>
              <textarea
                ref={textareaRef}
                value={localCode}
                onChange={(e) => handleCodeChange(e.target.value)}
                onKeyDown={onKeyDown}
                spellCheck={false}
                className="h-full w-full resize-none bg-[var(--bg-panel-2)] py-4 pr-4 font-mono text-xs leading-6 text-[var(--text-strong)] outline-none"
                style={{ paddingLeft: 42 }}
                placeholder={TEMPLATES[0].code}
              />
            </div>
          </div>
        )}

        {/* Preview pane */}
        <div className={cn("flex min-h-0 flex-col overflow-hidden", readOnly ? "col-span-2" : "")}>
          <div className="flex flex-shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--bg-panel-3)]/50 px-3 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Aperçu</span>
            {error && (
              <span className="text-[9px] font-medium text-red-500">● Erreur de syntaxe</span>
            )}
            {svg && !error && (
              <span className="text-[9px] text-emerald-500">● OK</span>
            )}
          </div>

          <div className="relative flex-1 overflow-auto">
            {error ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
                <div className="w-full max-w-lg rounded-xl border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
                  <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-red-600 dark:text-red-400">
                    <span className="text-base">⚠</span> Erreur de syntaxe Mermaid
                  </p>
                  <pre className="whitespace-pre-wrap font-mono text-[10px] leading-5 text-red-500 dark:text-red-400">{error}</pre>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(error)}
                    className="mt-3 flex items-center gap-1 text-[10px] text-red-400 transition hover:text-red-600"
                  >
                    <Copy className="h-3 w-3" />Copier l'erreur
                  </button>
                </div>
              </div>
            ) : svg ? (
              <div
                className="flex min-h-full items-center justify-center p-8"
                style={{ minWidth: "100%" }}
              >
                <div
                  dangerouslySetInnerHTML={{ __html: svg }}
                  className="origin-center transition-transform duration-150 [&_svg]:h-auto [&_svg]:max-w-full"
                  style={{ transform: `scale(${previewZoom})`, transformOrigin: "center top" }}
                />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center gap-2 text-sm text-[var(--text-muted)]">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--brand)]" />
                Rendu en cours…
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Status bar ───────────────────────────────────────────── */}
      {!readOnly && (
        <div className="flex flex-shrink-0 items-center gap-4 border-t border-[var(--border)] bg-[var(--bg-panel-3)]/40 px-4 py-1">
          <span className="text-[9px] text-[var(--text-muted)]">
            {localCode.split("\n").length} lignes · {localCode.length} caractères
          </span>
          <span className="ml-auto text-[9px] text-[var(--text-muted)]">
            Mermaid 11 · rendu en 280 ms
          </span>
        </div>
      )}
    </div>
  );
}
