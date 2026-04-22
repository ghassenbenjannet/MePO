import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle, AlertTriangle, ArrowLeft, CheckCircle, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight,
  Clock, FileText, Folder, FolderOpen, Grid2x2, Layers, List,
  Loader2, MoreHorizontal, Pencil, Plus, Search, Trash2, XCircle,
  GitBranch, Share2,
} from "lucide-react";
import {
  useCreateDocument,
  useDeleteDocument,
  useDocuments,
  useProjectDocumentsSyncStatus,
  useSyncDocument,
  useSyncProjectDocuments,
  useUpdateDocument,
} from "../../hooks/use-documents";
import { cn } from "../../lib/utils";
import type { Document, DocType, Topic } from "../../types/domain";
import { DocumentCard } from "./document-card";
import { PageEditor } from "./page-editor";
import { MermaidEditor } from "./mermaid-editor";
import { WhiteboardEditor } from "./whiteboard-editor";

// ─── Constants ───────────────────────────────────────────────────────────────

const DOC_TYPES: { value: DocType; label: string; icon: React.ElementType; description: string }[] = [
  { value: "page", label: "Page", icon: FileText, description: "Page Tiptap en mode Notion-like : texte riche, callouts, tableaux, code et slash commands" },
  { value: "folder", label: "Dossier", icon: Folder, description: "Organiser les pages et documents" },
  { value: "whiteboard", label: "Whiteboard", icon: Grid2x2, description: "Tableau blanc libre pour brainstorm, post-its et cartographie" },
  { value: "mermaid", label: "Mermaid", icon: GitBranch, description: "Diagramme technique ou métier en syntaxe Mermaid" },
];

const DOC_TEMPLATES = [
  {
    id: "analysis",
    label: "Analyse PO",
    description: "Cadrer un sujet, ses impacts et ses zones floues.",
    title: "Analyse PO",
    content: `# Analyse PO\n\n## Contexte\n\n- Sujet\n- Objectif\n- Parties prenantes\n\n## Impacts\n\n- Métier\n- Technique\n- UX\n- Données\n\n## Questions ouvertes\n\n- À confirmer\n- À valider`,
  },
  {
    id: "cadre",
    label: "Cadrage",
    description: "Poser le périmètre, les règles et les exclusions.",
    title: "Cadrage",
    content: `# Cadrage\n\n## Périmètre\n\n## Hors périmètre\n\n## Hypothèses\n\n## Risques\n\n## Décisions`,
  },
  {
    id: "cr",
    label: "Compte-rendu",
    description: "Tracer les échanges, décisions et actions.",
    title: "Compte-rendu",
    content: `# Compte-rendu\n\n## Participants\n\n## Points abordés\n\n## Décisions\n\n## Actions`,
  },
  {
    id: "recette",
    label: "Plan de recette",
    description: "Définir les scénarios de validation.",
    title: "Plan de recette",
    content: `# Plan de recette\n\n## Pré-requis\n\n## Scénarios\n\n## Résultats attendus\n\n## Données de test`,
  },
  {
    id: "spec",
    label: "Spécification",
    description: "Documenter une évolution ou un besoin.",
    title: "Spécification",
    content: `# Spécification\n\n## Besoin\n\n## Règles métier\n\n## Parcours\n\n## Critères d'acceptation`,
  },
  {
    id: "decision",
    label: "Note de décision",
    description: "Conserver une décision clé et son contexte.",
    title: "Note de décision",
    content: `# Note de décision\n\n## Décision\n\n## Contexte\n\n## Alternatives\n\n## Conséquences`,
  },
];

function templateById(templateId: string) {
  return DOC_TEMPLATES.find((template) => template.id === templateId) ?? null;
}

const CALLOUT_STYLES: Record<string, { cls: string; icon: React.ElementType }> = {
  note: { cls: "border-brand-500/40 bg-brand-500/5", icon: AlertCircle },
  warning: { cls: "border-warn-500/40 bg-warn-500/5", icon: AlertTriangle },
  success: { cls: "border-brand-500/40 bg-brand-500/5", icon: CheckCircle },
  error: { cls: "border-danger-500/40 bg-danger-500/5", icon: XCircle },
};

function readDocMetaString(metadata: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function splitDocumentTitle(title: string) {
  const match = title.match(/^(.*?)(?:\s+[—-]\s+)(.+)$/);
  if (!match) return { lead: title, tail: null as string | null };
  return { lead: match[1], tail: match[2] };
}

function documentEditorName(doc: Document) {
  return readDocMetaString(doc.doc_metadata, ["updated_by", "updatedBy", "author", "authorName", "editor"]) ?? "MePO";
}

function documentEditorInitials(doc: Document) {
  const name = documentEditorName(doc);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return initials || "MP";
}

function documentVersion(doc: Document) {
  return readDocMetaString(doc.doc_metadata, ["version", "docVersion"]) ?? "V1";
}

function documentStatus(doc: Document) {
  if (doc.is_archived) return "Archive";
  return readDocMetaString(doc.doc_metadata, ["status", "docStatus"]) ?? "En revue";
}

type DocumentComment = {
  author: string;
  text: string;
  time: string | null;
  tone: "cool" | "warm";
};

function documentComments(doc: Document): DocumentComment[] {
  const raw = doc.doc_metadata.comments ?? doc.doc_metadata.recent_comments ?? null;
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item, index) => {
      if (typeof item === "string") {
        return {
          author: index % 2 === 0 ? "MePO" : "Equipe",
          text: item,
          time: null,
          tone: index % 2 === 0 ? "cool" : "warm",
        } satisfies DocumentComment;
      }

      if (item && typeof item === "object") {
        const author = typeof (item as { author?: unknown }).author === "string"
          ? (item as { author: string }).author
          : index % 2 === 0 ? "MePO" : "Equipe";
        const text = typeof (item as { text?: unknown }).text === "string"
          ? (item as { text: string }).text
          : typeof (item as { body?: unknown }).body === "string"
            ? (item as { body: string }).body
            : null;
        const time = typeof (item as { time?: unknown }).time === "string"
          ? (item as { time: string }).time
          : typeof (item as { ts?: unknown }).ts === "string"
            ? (item as { ts: string }).ts
            : null;

        if (!text) return null;

        return {
          author,
          text,
          time,
          tone: index % 2 === 0 ? "cool" : "warm",
        } satisfies DocumentComment;
      }

      return null;
    })
    .filter((item): item is DocumentComment => item !== null)
    .slice(0, 2);
}

function docTypeIcon(type: DocType): React.ElementType {
  const found = DOC_TYPES.find((d) => d.value === type);
  return found?.icon ?? FileText;
}

function docTypeLabel(type: DocType) {
  return DOC_TYPES.find((d) => d.value === type)?.label ?? "Document";
}

function htmlToPlainText(content: string) {
  return content
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function extractOutline(content: string) {
  const headings = Array.from(content.matchAll(/<(h[1-4])[^>]*>(.*?)<\/\1>/gi))
    .map((match) => ({
      level: Number(match[1].replace("h", "")),
      title: htmlToPlainText(match[2]),
    }))
    .filter((item) => item.title);

  if (headings.length > 0) {
    return headings.slice(0, 8);
  }

  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("#"))
    .slice(0, 8)
    .map((line) => ({
      level: Math.min(4, line.match(/^#+/)?.[0].length ?? 1),
      title: line.replace(/^#+\s*/, ""),
    }));
}

function formatDocDate(value: string | null) {
  if (!value) return "Non date";
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatShortDocDate(value: string | null) {
  if (!value) return "Aucune date";
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function documentEyeLabel(type: DocType) {
  if (type === "whiteboard") return "WHITEBOARD";
  if (type === "mermaid") return "MERMAID";
  if (type === "folder") return "DOSSIER";
  return "PAGE";
}

function documentListLabel(type: DocType) {
  if (type === "whiteboard") return "BOARD";
  if (type === "mermaid") return "DIAGRAM";
  if (type === "folder") return "DOSSIER";
  return "PAGE";
}

function documentGlyph(type: DocType) {
  if (type === "whiteboard") return "◨";
  if (type === "mermaid") return "◪";
  return "◫";
}

// ─── Build tree from flat list ────────────────────────────────────────────────

interface TreeNode extends Document {
  children: TreeNode[];
}

function buildTree(docs: Document[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  for (const d of docs) map.set(d.id, { ...d, children: [] });
  const roots: TreeNode[] = [];
  for (const d of docs) {
    const node = map.get(d.id)!;
    if (d.parent_id && map.has(d.parent_id)) {
      map.get(d.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  // Sort: folders first, then by title
  function sort(nodes: TreeNode[]) {
    nodes.sort((a, b) => {
      if (a.type === "folder" && b.type !== "folder") return -1;
      if (a.type !== "folder" && b.type === "folder") return 1;
      return a.title.localeCompare(b.title);
    });
    nodes.forEach((n) => sort(n.children));
  }
  sort(roots);
  return roots;
}

// ─── Create Document Modal ────────────────────────────────────────────────────

function CreateDocModal({
  spaceId, parentId, topics, onClose, onCreated,
}: {
  spaceId: string; parentId: string | null; topics: Topic[]; onClose: () => void; onCreated?: (doc: Document) => void;
}) {
  const { mutateAsync: create, isPending } = useCreateDocument();
  const [type, setType] = useState<DocType>("page");
  const [templateId, setTemplateId] = useState("analysis");
  const [title, setTitle] = useState("");
  const [topicId, setTopicId] = useState<string>("");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Le titre est requis."); return; }
    const template = type === "page" ? templateById(templateId) : null;
    const content = type === "whiteboard"
      ? ""
      : type === "mermaid"
        ? "graph TD\n  A[Start] --> B[End]"
        : template?.content ?? "";
    try {
      const createdDoc = await create({
        space_id: spaceId,
        parent_id: parentId,
        type,
        title: title.trim(),
        topic_id: topicId || null,
        content,
      });
      onCreated?.(createdDoc);
      onClose();
    } catch {
      setError("Impossible de créer le document.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[var(--overlay)] p-4 backdrop-blur-sm">
      <div className="flex min-h-full items-start justify-center py-4">
        <div className="dialog-panel flex w-full max-w-lg max-h-[calc(100vh-2rem)] flex-col overflow-hidden bg-[var(--bg-panel)]">
        {/* Header — always visible */}
        <div className="dialog-header flex-shrink-0">
          <div>
            <p className="eyebrow">Documents</p>
            <h2 className="dialog-title mt-2">
            {type === "page" ? "Créer une page" : "Créer un document"}
            </h2>
          </div>
        </div>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto space-y-4 p-6">
            {/* Type selector */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Type</label>
              <div className="grid grid-cols-2 gap-2">
                {DOC_TYPES.map((dt) => {
                  const Icon = dt.icon;
                  return (
                    <button
                      key={dt.value}
                      type="button"
                      onClick={() => setType(dt.value)}
                      className={cn(
                        "flex items-start gap-2.5 rounded-xl border p-3 text-left transition",
                        type === dt.value
                          ? "border-brand-500 bg-brand-500/8 text-[var(--text-strong)]"
                          : "border-[var(--border)] bg-[var(--bg-panel-2)] text-[var(--text-muted)] hover:border-[var(--border)] hover:text-[var(--text-strong)]",
                      )}
                    >
                      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-semibold">{dt.label}</p>
                        <p className="mt-0.5 text-[10px] opacity-70">{dt.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {type === "page" && (
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Template de page</label>
                <div className="space-y-2">
                  {DOC_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => { setTemplateId(template.id); setTitle((current) => current || template.title); }}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition",
                        templateId === template.id
                          ? "border-brand-500 bg-brand-500/5 text-[var(--text-strong)]"
                          : "border-[var(--border)] bg-[var(--bg-panel-2)] text-[var(--text-muted)] hover:border-brand-200 hover:text-[var(--text-strong)]",
                      )}
                    >
                      <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-white text-brand-500 shadow-sm">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{template.label}</p>
                        <p className="mt-0.5 text-[11px] leading-relaxed opacity-80">{template.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Titre *</label>
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 py-2.5 text-sm text-[var(--text-strong)] outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                placeholder={type === "page" ? "Titre de la page…" : "Titre du document…"}
              />
            </div>

            {topics.length > 0 && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Lier à un Topic (optionnel)</label>
                <select
                  value={topicId}
                  onChange={(e) => setTopicId(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 py-2.5 text-sm text-[var(--text-strong)] outline-none transition focus:border-brand-500"
                >
                  <option value="">— Aucun topic —</option>
                  {topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Footer — always visible */}
          <div className="flex-shrink-0 border-t border-[var(--border)] px-6 py-4">
            {error && <p className="mb-3 rounded-xl border border-danger-500/30 bg-danger-500/8 px-3 py-2 text-sm text-danger-500">{error}</p>}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={onClose} className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] px-4 py-2 text-sm font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-panel)]">
                Annuler
              </button>
              <button type="submit" disabled={isPending || !title.trim()} className="btn-primary disabled:opacity-60">
                {isPending ? "Création…" : type === "page" ? "Créer la page" : "Créer"}
              </button>
            </div>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}

// ─── Tree Node (recursive) ────────────────────────────────────────────────────

function TreeItem({
  node, selectedId, expandedIds, onSelect, onToggle, depth,
}: {
  node: TreeNode; selectedId: string | null; expandedIds: Set<string>;
  onSelect: (id: string) => void; onToggle: (id: string) => void; depth: number;
}) {
  const isFolder = node.type === "folder";
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;
  const Icon = docTypeIcon(node.type);

  return (
    <div>
      <button
        type="button"
        onClick={() => { onSelect(node.id); if (isFolder) onToggle(node.id); }}
        className={cn(
          "group flex w-full items-center gap-2 rounded-full px-3 py-2 text-sm transition duration-200 ease-in-out",
          isSelected
            ? "bg-gradient-to-r from-[#8B5CF6] to-[#3B82F6] font-medium text-white shadow-[0_14px_32px_rgba(79,70,229,0.22)] ring-1 ring-white/50 backdrop-blur"
            : "text-slate-500 hover:bg-slate-100/80 hover:text-slate-900",
        )}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        {isFolder ? (
          <span className="flex h-4 w-4 items-center justify-center">
            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </span>
        ) : <span className="w-4" />}
        {isFolder ? (
          isExpanded ? <FolderOpen className="h-3.5 w-3.5 flex-shrink-0" /> : <Folder className="h-3.5 w-3.5 flex-shrink-0" />
        ) : (
          <Icon className="h-3.5 w-3.5 flex-shrink-0" />
        )}
        <span className="truncate text-xs font-medium">{node.icon ? `${node.icon} ` : ""}{node.title}</span>
        {isFolder && node.children.length > 0 && (
          <span className={cn(
            "ml-auto rounded-full px-2 py-0.5 text-[10px]",
            isSelected ? "bg-white/18 text-white" : "bg-white/90 text-slate-500 shadow-sm",
          )}>{node.children.length}</span>
        )}
      </button>
      {isFolder && isExpanded && node.children.map((child) => (
        <TreeItem key={child.id} node={child} selectedId={selectedId} expandedIds={expandedIds} onSelect={onSelect} onToggle={onToggle} depth={depth + 1} />
      ))}
    </div>
  );
}

// ─── Document Header ──────────────────────────────────────────────────────────

function DocHeader({
  doc, topics, saveStatus, onRename, onDelete, onTopicChange, onBack,
}: {
  doc: Document; topics: Topic[];
  saveStatus: "idle" | "pending" | "saved";
  onRename: (title: string) => void;
  onDelete: () => void;
  onTopicChange: (topicId: string | null) => void;
  onBack?: () => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleVal, setTitleVal] = useState(doc.title);
  const [menuOpen, setMenuOpen] = useState(false);
  const topic = topics.find((t) => t.id === doc.topic_id);
  const Icon = docTypeIcon(doc.type);

  return (
    <div className="flex flex-shrink-0 flex-wrap items-start gap-4 border-b border-slate-200 bg-white px-5 py-5 lg:px-7">
      {/* Back button (focus mode) */}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          title="Retour à la liste"
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition duration-200 ease-in-out hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 md:hidden"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      )}
      {/* Icon */}
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#8B5CF6]/14 to-[#3B82F6]/14 text-[#4F46E5] ring-1 ring-slate-200/80">
        <Icon className="h-5 w-5" />
      </div>

      {/* Title + meta */}
      <div className="min-w-0 flex-1">
        {editingTitle ? (
          <input
            autoFocus
            value={titleVal}
            onChange={(e) => setTitleVal(e.target.value)}
            onBlur={() => { setEditingTitle(false); onRename(titleVal); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") { setEditingTitle(false); onRename(titleVal); }
              if (e.key === "Escape") setEditingTitle(false);
            }}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[clamp(1.8rem,2.5vw,2.8rem)] font-semibold leading-tight text-slate-900 outline-none ring-4 ring-[#8B5CF6]/10"
          />
        ) : (
          <h2
            className="cursor-text break-words text-[clamp(1.9rem,3vw,3.25rem)] font-bold leading-[1.02] tracking-tight text-[#0F172A] transition duration-200 ease-in-out hover:text-[#3B82F6]"
            title="Cliquer pour renommer"
            onClick={() => { setEditingTitle(true); setTitleVal(doc.title); }}
          >
            {doc.icon && <span className="mr-1">{doc.icon}</span>}{doc.title}
          </h2>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2.5">
          <span className="rounded-full border border-[#8B5CF6]/20 bg-[#8B5CF6]/8 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#4F46E5]">
            {docTypeLabel(doc.type)}
          </span>
          {topic && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-[#3B82F6]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#3B82F6]" />{topic.title}
            </span>
          )}
          {doc.updated_at && (
            <span className="flex items-center gap-1 text-[11px] text-slate-500">
              <Clock className="h-2.5 w-2.5" />
              {new Date(doc.updated_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          )}
          {doc.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
              #{tag}
            </span>
          ))}
        </div>
      </div>

      {/* Autosave indicator */}
      <div className="ml-auto flex flex-shrink-0 items-center gap-2">
        {saveStatus === "pending" && (
          <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] text-slate-500">
            <Loader2 className="h-2.5 w-2.5 animate-spin" />Enregistrement…
          </span>
        )}
        {saveStatus === "saved" && (
          <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] text-emerald-600">
            <CheckCircle2 className="h-2.5 w-2.5" />Enregistré
          </span>
        )}
      </div>

      {/* Menu */}
      <div className="relative flex-shrink-0">
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition duration-200 ease-in-out hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-9 z-30 min-w-[180px] rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] py-1 shadow-xl">
            <button
              onClick={() => { setEditingTitle(true); setTitleVal(doc.title); setMenuOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[var(--text-strong)] transition hover:bg-[var(--bg-panel-2)]"
            >
              <Pencil className="h-3.5 w-3.5" />Renommer
            </button>
            {topics.length > 0 && (
              <div className="px-3 py-2">
                <p className="mb-1 text-xs text-[var(--text-muted)]">Topic lié</p>
                <select
                  value={doc.topic_id ?? ""}
                  onChange={(e) => { onTopicChange(e.target.value || null); setMenuOpen(false); }}
                  className="w-full rounded border border-[var(--border)] bg-[var(--bg-panel-2)] px-2 py-1 text-xs text-[var(--text-strong)] outline-none"
                >
                  <option value="">— Aucun —</option>
                  {topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
              </div>
            )}
            <div className="mx-2 my-1 border-t border-[var(--border)]" />
            <button
              onClick={() => { onDelete(); setMenuOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-danger-500 transition hover:bg-danger-500/8"
            >
              <Trash2 className="h-3.5 w-3.5" />Supprimer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Folder View ──────────────────────────────────────────────────────────────

function FolderView({
  node,
  onSelect,
  spaceId,
  topics,
  onCreated,
}: {
  node: TreeNode;
  onSelect: (id: string) => void;
  spaceId: string;
  topics: Topic[];
  onCreated: (doc: Document) => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  return (
    <div className="p-6">
      {showCreate && (
        <CreateDocModal
          spaceId={spaceId}
          parentId={node.id}
          topics={topics}
          onClose={() => setShowCreate(false)}
          onCreated={onCreated}
        />
      )}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-[var(--text-muted)]">{node.children.length} élément{node.children.length !== 1 ? "s" : ""}</p>
        <button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="h-3.5 w-3.5" />Nouveau</button>
      </div>
      {node.children.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-[var(--border)] py-12 text-center">
          <Folder className="h-8 w-8 text-[var(--text-muted)]" />
          <p className="text-sm text-[var(--text-muted)]">Dossier vide</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary">Créer un document</button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {node.children.map((child) => {
            const Icon = docTypeIcon(child.type);
            return (
              <DocumentCard
                key={child.id}
                title={`${child.icon ? `${child.icon} ` : ""}${child.title}`}
                typeLabel={child.type}
                icon={Icon}
                updatedAt={child.updated_at ? new Date(child.updated_at).toLocaleDateString("fr-FR") : null}
                onClick={() => onSelect(child.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Recents / Home View ──────────────────────────────────────────────────────

function HomeView({ docs, onSelect, spaceId, topics, onCreateRoot }: { docs: Document[]; onSelect: (id: string) => void; spaceId: string; topics: Topic[]; onCreateRoot: () => void }) {
  const recent = useMemo(() => [...docs].filter((d) => d.type !== "folder").sort((a, b) => new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime()).slice(0, 12), [docs]);

  return (
    <div className="p-6">
      {docs.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-[var(--border)] py-20 text-center">
          <FileText className="h-10 w-10 text-[var(--text-muted)]" />
          <div>
            <p className="font-semibold text-[var(--text-strong)]">Aucun document</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Créez votre première page Tiptap en mode Notion-like, ou ajoutez un whiteboard / diagramme si besoin.</p>
          </div>
          <button onClick={onCreateRoot} className="btn-primary">Créer la première page</button>
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--text-strong)]">Récemment modifiés</h3>
          
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((doc) => {
              const Icon = docTypeIcon(doc.type);
              return (
                <DocumentCard
                  key={doc.id}
                  title={`${doc.icon ? `${doc.icon} ` : ""}${doc.title}`}
                  typeLabel={doc.type}
                  icon={Icon}
                  updatedAt={doc.updated_at ? new Date(doc.updated_at).toLocaleDateString("fr-FR") : null}
                  onClick={() => onSelect(doc.id)}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main DocumentsTab ────────────────────────────────────────────────────────

function DocumentContextPanel({ doc, topics }: { doc: Document; topics: Topic[] }) {
  const plainText = useMemo(() => htmlToPlainText(doc.content), [doc.content]);
  const outline = useMemo(() => extractOutline(doc.content), [doc.content]);
  const wordCount = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;
  const lineCount = doc.content.split("\n").filter(Boolean).length;
  const topic = topics.find((item) => item.id === doc.topic_id) ?? null;

  return (
    <aside className="hidden">
      <div className="sticky top-0 flex h-full flex-col gap-4 overflow-y-auto px-5 py-5">
        <div className="rounded-[28px] border border-[var(--border)] bg-white p-5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-600">Contexte</p>
          <h3 className="mt-3 font-[var(--font-display)] text-xl font-bold tracking-tight text-[var(--text-strong)]">Meta document</h3>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-start justify-between gap-4">
              <span className="text-[var(--text-muted)]">Type</span>
              <span className="font-medium text-[var(--text-strong)]">{docTypeLabel(doc.type)}</span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <span className="text-[var(--text-muted)]">Derniere maj</span>
              <span className="font-medium text-[var(--text-strong)]">{formatDocDate(doc.updated_at)}</span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <span className="text-[var(--text-muted)]">Volume</span>
              <span className="font-medium text-[var(--text-strong)]">{wordCount} mots</span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <span className="text-[var(--text-muted)]">Lignes</span>
              <span className="font-medium text-[var(--text-strong)]">{lineCount}</span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <span className="text-[var(--text-muted)]">Topic</span>
              <span className="max-w-[150px] text-right font-medium text-[var(--text-strong)]">{topic?.title ?? "Aucun"}</span>
            </div>
          </div>
        </div>

        {doc.tags.length > 0 && (
          <div className="rounded-[28px] border border-[var(--border)] bg-white p-5 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Tags</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {doc.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-[var(--text-strong)]">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-[28px] border border-[var(--border)] bg-white p-5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Structure</p>
          {outline.length > 0 ? (
            <div className="mt-4 space-y-2">
              {outline.map((heading, index) => (
                <div key={`${heading.title}-${index}`} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Niveau {heading.level}</p>
                  <p className="mt-1 text-sm font-medium text-[var(--text-strong)]">{heading.title}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm leading-relaxed text-[var(--text-muted)]">Ajoutez des titres pour structurer la page et alimenter un sommaire de type Notion.</p>
          )}
        </div>
      </div>
    </aside>
  );
}

interface DocumentsTabProps {
  projectId?: string;
  spaceId: string;
  topics: Topic[];
}

function DocumentsHomeView({ docs, onSelect, spaceId, topics, onCreateRoot }: { docs: Document[]; onSelect: (id: string) => void; spaceId: string; topics: Topic[]; onCreateRoot: () => void }) {
  const activeDocs = useMemo(() => docs.filter((doc) => doc.type !== "folder" && !doc.is_archived), [docs]);
  const recent = useMemo(() => [...activeDocs].sort((a, b) => new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime()).slice(0, 4), [activeDocs]);
  const pagesCount = activeDocs.filter((doc) => doc.type !== "whiteboard" && doc.type !== "mermaid").length;
  const whiteboardsCount = activeDocs.filter((doc) => doc.type === "whiteboard").length;
  const latestUpdatedAt = activeDocs[0]?.updated_at ?? null;
  const topicById = useMemo(() => Object.fromEntries(topics.map((topic) => [topic.id, topic])), [topics]);
  const hubLabel = spaceId || "HCL-Livret";

  if (docs.length === 0) {
    return (
      <div className="min-h-full overflow-y-auto bg-[var(--paper)] px-8 py-7 lg:px-10 lg:py-8">
        <div className="empty-state">
          <div className="empty-state-icon">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <p className="empty-state-title">Aucun document</p>
            <p className="empty-state-description">Creez votre premiere page ou un whiteboard pour lancer le knowledge hub.</p>
          </div>
          <button onClick={onCreateRoot} className="btn-primary">Creer la premiere page</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full overflow-y-auto bg-[var(--paper)] px-8 py-7 lg:px-10 lg:py-8">
      <div className="space-y-10">
        <div className="flex items-start justify-between gap-8 border-b border-[var(--rule)] pb-7">
          <div className="min-w-0">
            <p className="eyebrow">Espace{" \u00b7 "}{hubLabel}</p>
            <h1 className="mt-1 font-[var(--font-display)] text-[clamp(3.8rem,6vw,6rem)] leading-[0.88] tracking-[-0.05em] text-[var(--ink)]">
              <span>S1 {"\u2014"} 2026</span>
              <br />
              <em className="text-[var(--accent-deep)]">Documents</em>
            </h1>
            <p className="mt-4 max-w-[70ch] text-sm leading-7 text-[var(--text-muted)]">
              Semestre 1{" \u00b7 "}Liberalisaton code GEF{" \u00b7 "}MDS{" \u00b7 "}WCP. Les pages vivantes de l'equipe : specs, fiches, comptes-rendus, whiteboards.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="pill">{pagesCount.toString().padStart(2, "0")} pages</span>
              <span className="pill">{whiteboardsCount.toString().padStart(2, "0")} whiteboard</span>
              <span className="pill">Derniere maj{" \u00b7 "}{formatShortDocDate(latestUpdatedAt)}</span>
            </div>
          </div>
          <div className="hidden min-w-0">
            <p className="eyebrow">Espace · {spaceId ? "Knowledge hub" : "Documents"}</p>
            <h1 className="mt-1 font-[var(--font-display)] text-[clamp(3.8rem,6vw,6rem)] leading-[0.88] tracking-[-0.05em] text-[var(--ink)]">Documents</h1>
            <p className="mt-4 max-w-[62ch] text-sm leading-7 text-[var(--text-muted)]">
              Les pages vivantes de l equipe : specs, fiches, comptes-rendus, diagrammes et whiteboards.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="pill">{pagesCount.toString().padStart(2, "0")} pages</span>
              <span className="pill">{whiteboardsCount.toString().padStart(2, "0")} whiteboard</span>
              <span className="pill">Derniere maj · {formatShortDocDate(latestUpdatedAt)}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-start gap-2 pt-2">
            <button className="btn" type="button">Modeles</button>
            <button className="btn accent" type="button" onClick={onCreateRoot}>+ Nouvelle page</button>
          </div>
        </div>

        <section>
          <div className="sec-h border-b border-[var(--rule)] pb-3">
            <div>
              <p className="eyebrow">Recemment modifies</p>
              <h2 style={{ fontSize: "28px" }}>Cette semaine</h2>
            </div>
            <button className="btn ghost" type="button">Tout voir {"\u2192"}</button>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-3">
            {recent.map((doc) => {
              const topic = doc.topic_id ? topicById[doc.topic_id] : null;
              return (
                <button key={doc.id} type="button" onClick={() => onSelect(doc.id)} className="card card-hover p-[18px] text-left">
                  <div className="flex items-center justify-between gap-4 text-[10.5px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">
                    <span>{documentEyeLabel(doc.type)}</span>
                    <span>{doc.type === "whiteboard" ? "" : "v1"}</span>
                  </div>
                  <div className="mt-2 font-[var(--font-display)] text-[19px] leading-[1.15] text-[var(--text-strong)]">{doc.title}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {topic ? <span className="tag">{topic.title}</span> : null}
                    {doc.type === "whiteboard" ? <span className="tag cool">whiteboard</span> : <span className="tag accent">active</span>}
                  </div>
                  <div className="mt-4 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                    <div className="flex items-center gap-2">
                      <div className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[var(--cool)] text-[9px] font-semibold text-white">
                        {documentEditorInitials(doc)}
                      </div>
                      <span>{documentEditorName(doc)}</span>
                    </div>
                    <span className="mono">{formatShortDocDate(doc.updated_at)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <div className="sec-h border-b border-[var(--rule)] pb-3">
            <div>
              <p className="eyebrow">Arborescence</p>
              <h2 style={{ fontSize: "28px" }}>Toutes les pages</h2>
            </div>
          </div>
          <div className="tlist mt-4">
            {activeDocs.map((doc) => {
              const topic = doc.topic_id ? topicById[doc.topic_id] : null;
              return (
                <button key={doc.id} type="button" onClick={() => onSelect(doc.id)} className="trow w-full text-left" style={{ gridTemplateColumns: "40px 1fr 120px 140px 110px 110px" }}>
                  <span style={{ color: "var(--ink-4)" }}>{documentGlyph(doc.type)}</span>
                  <div>
                    <div className="t-title" style={{ fontFamily: "var(--font-display)", fontSize: "18px" }}>{doc.title}</div>
                    <div className="t-tags">
                      {topic ? <span className="tag">{topic.title}</span> : null}
                      {doc.type === "whiteboard" ? <span className="tag cool">whiteboard</span> : null}
                    </div>
                  </div>
                  <span className="mono text-[11px] text-[var(--text-muted)]">{documentListLabel(doc.type)}</span>
                  <span className="mono text-[11px] text-[var(--text-muted)]">{formatDocDate(doc.updated_at)}</span>
                  <span className="mono text-[11px] text-[var(--text-muted)]">{topic?.title ?? "Aucun"}</span>
                  <span className="btn ghost justify-self-end">Ouvrir →</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function DocumentsHubSidebar({ docs, selectedId, onSelect }: { docs: Document[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const navDocs = docs.filter((doc) => doc.type !== "folder" && !doc.is_archived).slice(0, 8);
  const pageCount = navDocs.filter((doc) => doc.type !== "whiteboard" && doc.type !== "mermaid").length;
  const whiteboardCount = navDocs.filter((doc) => doc.type === "whiteboard").length;

  return (
    <aside className="hidden w-[260px] min-w-[260px] flex-col border-r border-[var(--rule)] bg-[var(--paper)] px-5 py-6 md:flex overflow-y-auto">
      <div>
        <p className="eyebrow">Knowledge hub</p>
        <div className="mt-3 flex flex-col gap-px">
          {navDocs.map((doc) => (
            <button
              key={doc.id}
              type="button"
              onClick={() => onSelect(doc.id)}
              className={cn(
                "flex min-h-[34px] items-center gap-3 rounded-[8px] px-3 py-2 text-left text-[13px] transition",
                selectedId === doc.id
                  ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent-deep)]"
                  : "text-[var(--ink-3)] hover:bg-[var(--paper-2)] hover:text-[var(--ink)]",
              )}
            >
              <span className="flex h-4 w-4 items-center justify-center text-[var(--ink-4)]">{documentGlyph(doc.type)}</span>
              <span className="flex-1 truncate">{doc.title}</span>
            </button>
          ))}
        </div>
      </div>

      <hr className="rule my-5" />

      <div>
        <p className="eyebrow">Filtres</p>
        <div className="mt-3 flex flex-col gap-2 text-[12.5px] text-[var(--ink-3)]">
          <label className="flex items-center gap-2"><input type="checkbox" checked readOnly /> Pages ({pageCount})</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked readOnly /> Whiteboards ({whiteboardCount})</label>
          <label className="flex items-center gap-2"><input type="checkbox" readOnly /> Archives</label>
        </div>
      </div>
    </aside>
  );
}

function DocumentPageSidebar({ docs, selectedDoc, onOpenDocuments, onSelect }: { docs: Document[]; selectedDoc: Document; onOpenDocuments: () => void; onSelect: (id: string) => void }) {
  const outline = extractOutline(selectedDoc.content);
  const navDocs = docs.filter((doc) => doc.type !== "folder" && !doc.is_archived).slice(0, 8);

  return (
    <aside className="hidden w-[260px] min-w-[260px] flex-col border-r border-[var(--rule)] bg-[var(--paper)] px-5 py-6 md:flex overflow-y-auto">
      <button type="button" onClick={onOpenDocuments} className="btn ghost w-fit px-0 text-[12px] text-[var(--ink-4)] hover:bg-transparent">← Documents</button>
      <div className="mt-4">
        <p className="eyebrow">Dans cet espace</p>
        <div className="mt-3 flex flex-col gap-px">
          {navDocs.map((doc) => (
            <button
              key={doc.id}
              type="button"
              onClick={() => onSelect(doc.id)}
              className={cn(
                "flex min-h-[34px] items-center gap-3 rounded-[8px] px-3 py-2 text-left text-[13px] transition",
                selectedDoc.id === doc.id
                  ? "bg-[var(--ink)] text-[var(--paper)]"
                  : "text-[var(--ink-3)] hover:bg-[var(--paper-2)] hover:text-[var(--ink)]",
              )}
            >
              <span className="flex h-4 w-4 items-center justify-center">{documentGlyph(doc.type)}</span>
              <span className="flex-1 truncate">{doc.title}</span>
            </button>
          ))}
        </div>
      </div>

      <hr className="rule my-5" />

      <div>
        <p className="eyebrow">Sommaire</p>
        <div className="mt-3 flex flex-col gap-2 border-l border-[var(--rule)] pl-3 text-[12.5px] text-[var(--ink-3)]">
          {outline.length > 0 ? outline.map((heading, index) => (
            <span key={`${heading.title}-${index}`} className={cn(index === 1 ? "text-[var(--ink)]" : "")}>{heading.title}</span>
          )) : (
            <span>Aucun intertitre pour le moment</span>
          )}
        </div>
      </div>
    </aside>
  );
}

function DocumentPageMetaPanel({ doc, topics }: { doc: Document; topics: Topic[] }) {
  const topic = topics.find((item) => item.id === doc.topic_id) ?? null;

  return (
    <aside className="hidden w-[260px] min-w-[260px] flex-col border-l border-[var(--rule)] bg-[var(--paper-2)] px-5 py-6 xl:flex">
      <div>
        <p className="eyebrow">Proprietes</p>
        <div className="mt-4 space-y-4 text-[12.5px]">
          <div>
            <p className="eyebrow">Story</p>
            <div className="mt-1">{topic ? <span className="pill accent">{topic.title}</span> : <span className="pill">Aucune</span>}</div>
          </div>
          <div>
            <p className="eyebrow">Statut</p>
            <div className="mt-1"><span className="pill">{doc.is_archived ? "Archive" : "En revue"}</span></div>
          </div>
          <div>
            <p className="eyebrow">Version</p>
            <div className="mt-1 font-mono text-[11px] text-[var(--ink-3)]">V1 · {formatShortDocDate(doc.updated_at)}</div>
          </div>
          <div>
            <p className="eyebrow">Tags</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {doc.tags.length > 0 ? doc.tags.map((tag) => <span key={tag} className="tag">{tag}</span>) : <span className="text-[var(--ink-4)]">Aucun tag</span>}
            </div>
          </div>
        </div>
      </div>

      <hr className="rule my-5" />

      <div>
        <p className="eyebrow">Commentaires · 0</p>
        <div className="mt-3 rounded-[10px] bg-[var(--paper)] p-3 text-[12.5px] text-[var(--ink-3)]">
          Aucun commentaire synchronise pour cette page.
        </div>
      </div>
    </aside>
  );
}

function DocumentEditorialHeader({
  doc,
  topics,
  saveStatus,
  onRename,
  onDelete,
  onTopicChange,
  onBack,
}: {
  doc: Document;
  topics: Topic[];
  saveStatus: "idle" | "pending" | "saved";
  onRename: (title: string) => void;
  onDelete: () => void;
  onTopicChange: (topicId: string | null) => void;
  onBack?: () => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleVal, setTitleVal] = useState(doc.title);
  const [menuOpen, setMenuOpen] = useState(false);
  const topic = topics.find((item) => item.id === doc.topic_id) ?? null;

  return (
    <div className="sticky top-0 z-20 border-b border-[var(--rule)] bg-[var(--paper)] px-6 pb-4 pt-7 lg:px-[60px]">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                title="Retour a la liste"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--rule)] bg-[var(--paper)] text-[var(--ink-3)] transition hover:bg-[var(--paper-2)] hover:text-[var(--ink)] md:hidden"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : null}
            <p className="eyebrow">Page · {doc.title}</p>
          </div>

          {editingTitle ? (
            <input
              autoFocus
              value={titleVal}
              onChange={(event) => setTitleVal(event.target.value)}
              onBlur={() => { setEditingTitle(false); onRename(titleVal); }}
              onKeyDown={(event) => {
                if (event.key === "Enter") { setEditingTitle(false); onRename(titleVal); }
                if (event.key === "Escape") setEditingTitle(false);
              }}
              className="mt-3 w-full border-0 bg-transparent px-0 py-0 font-[var(--font-display)] text-[clamp(2.2rem,3.2vw,3.7rem)] leading-[0.98] tracking-[-0.04em] text-[var(--ink)] outline-none"
            />
          ) : (
            <h2
              className="mt-3 cursor-text break-words font-[var(--font-display)] text-[clamp(2.2rem,3.2vw,3.7rem)] leading-[0.98] tracking-[-0.04em] text-[var(--ink)]"
              title="Cliquer pour renommer"
              onClick={() => { setEditingTitle(true); setTitleVal(doc.title); }}
            >
              {doc.title}
            </h2>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2 text-[12px] text-[var(--ink-3)]">
            <span className="mono rounded-full border border-[var(--rule)] bg-[var(--paper-2)] px-3 py-1">
              {docTypeLabel(doc.type)}
            </span>
            {topic ? <span className="pill accent">{topic.title}</span> : null}
            {doc.updated_at ? (
              <span className="mono flex items-center gap-2">
                <Clock className="h-3.5 w-3.5" />
                Derniere maj · {formatDocDate(doc.updated_at)}
              </span>
            ) : null}
            {saveStatus === "pending" ? (
              <span className="mono flex items-center gap-2 text-[var(--ink-4)]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Enregistrement...
              </span>
            ) : null}
            {saveStatus === "saved" ? (
              <span className="mono flex items-center gap-2 text-[var(--success)]">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Enregistre
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn ghost">Historique</button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              if (typeof window !== "undefined" && navigator?.clipboard) {
                void navigator.clipboard.writeText(window.location.href);
              }
            }}
          >
            <Share2 className="h-4 w-4" />
            Partager
          </button>
          <button type="button" className="btn accent">+ Creer une tache</button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--rule)] bg-[var(--paper)] text-[var(--ink-3)] transition hover:bg-[var(--paper-2)] hover:text-[var(--ink)]"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menuOpen ? (
              <div className="absolute right-0 top-12 z-30 min-w-[220px] rounded-[16px] border border-[var(--rule)] bg-[var(--paper)] p-2 shadow-[0_24px_48px_rgba(28,24,20,0.08)]">
                <button
                  type="button"
                  onClick={() => { setEditingTitle(true); setTitleVal(doc.title); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2 rounded-[12px] px-3 py-2 text-sm text-[var(--ink)] transition hover:bg-[var(--paper-2)]"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Renommer
                </button>

                {topics.length > 0 ? (
                  <div className="px-3 py-2">
                    <p className="eyebrow">Topic lie</p>
                    <select
                      value={doc.topic_id ?? ""}
                      onChange={(event) => { onTopicChange(event.target.value || null); setMenuOpen(false); }}
                      className="mt-2 w-full rounded-[12px] border border-[var(--rule)] bg-[var(--paper-2)] px-3 py-2 text-sm text-[var(--ink)] outline-none"
                    >
                      <option value="">Aucun</option>
                      {topics.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                    </select>
                  </div>
                ) : null}

                <div className="mx-2 my-1 border-t border-[var(--rule)]" />

                <button
                  type="button"
                  onClick={() => { onDelete(); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2 rounded-[12px] px-3 py-2 text-sm text-[var(--hot)] transition hover:bg-[var(--hot-soft)]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Supprimer
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function DocumentListIcon({ type, active = false }: { type: DocType; active?: boolean }) {
  const Icon = docTypeIcon(type);

  return (
    <span className={cn("flex h-4 w-4 items-center justify-center", active ? "text-current" : "text-[var(--ink-4)]")}>
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}

function DocumentsHubSidebarV2({
  docs,
  selectedId,
  onSelect,
  collapsed,
  onToggleCollapse,
}: {
  docs: Document[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const navDocs = docs.filter((doc) => doc.type !== "folder" && !doc.is_archived).slice(0, 8);

  if (collapsed) {
    return (
      <aside className="hidden md:flex flex-col flex-shrink-0 w-[52px] border-r border-[var(--rule)] bg-[var(--paper)] py-3 items-center gap-1 overflow-y-auto">
        <button type="button" onClick={onToggleCollapse} title="Développer" className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[var(--ink-4)] hover:bg-[var(--paper-2)] hover:text-[var(--ink)] transition mb-2">
          <ChevronRight className="h-4 w-4" />
        </button>
        {navDocs.map((doc) => {
          const isActive = selectedId === doc.id;
          return (
            <button
              key={doc.id}
              type="button"
              title={doc.title}
              onClick={() => onSelect(doc.id)}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-[8px] transition",
                isActive ? "bg-[var(--ink)] text-[var(--paper)]" : "text-[var(--ink-4)] hover:bg-[var(--paper-2)] hover:text-[var(--ink)]",
              )}
            >
              <DocumentListIcon type={doc.type} active={isActive} />
            </button>
          );
        })}
      </aside>
    );
  }

  return (
    <aside className="hidden w-[260px] min-w-[260px] flex-col border-r border-[var(--rule)] bg-[var(--paper)] px-4 py-4 md:flex overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <p className="eyebrow">Knowledge hub</p>
        <button type="button" onClick={onToggleCollapse} title="Réduire" className="flex h-6 w-6 items-center justify-center rounded-[6px] text-[var(--ink-5)] hover:bg-[var(--paper-2)] hover:text-[var(--ink)] transition">
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex flex-col gap-px">
        {navDocs.map((doc) => {
          const isActive = selectedId === doc.id;
          return (
            <button
              key={doc.id}
              type="button"
              onClick={() => onSelect(doc.id)}
              className={cn(
                "flex min-h-[34px] items-center gap-3 rounded-[8px] px-3 py-2 text-left text-[13px] transition",
                isActive
                  ? "bg-[var(--ink)] font-semibold text-[var(--paper)]"
                  : "text-[var(--ink-3)] hover:bg-[var(--paper-2)] hover:text-[var(--ink)]",
              )}
            >
              <DocumentListIcon type={doc.type} active={isActive} />
              <span className="flex-1 truncate">{doc.title}</span>
            </button>
          );
        })}
      </div>

      <hr className="rule my-5" />

      <div>
        <p className="eyebrow">Filtres</p>
        <div className="mt-3 flex flex-col gap-2 text-[12.5px] text-[var(--ink-3)]">
          <label className="flex items-center gap-2"><input type="checkbox" checked readOnly /> Pages</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked readOnly /> Whiteboards</label>
          <label className="flex items-center gap-2"><input type="checkbox" readOnly /> Archives</label>
        </div>
      </div>
    </aside>
  );
}

function DocumentPageSidebarV2({
  docs,
  selectedDoc,
  onOpenDocuments,
  onSelect,
  collapsed,
  onToggleCollapse,
}: {
  docs: Document[];
  selectedDoc: Document;
  onOpenDocuments: () => void;
  onSelect: (id: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const outline = extractOutline(selectedDoc.content);
  const navDocs = docs.filter((doc) => doc.type !== "folder" && !doc.is_archived).slice(0, 8);

  if (collapsed) {
    return (
      <aside className="hidden md:flex flex-col flex-shrink-0 w-[52px] border-r border-[var(--rule)] bg-[var(--paper)] py-3 items-center gap-1 overflow-y-auto">
        <button type="button" onClick={onToggleCollapse} title="Développer" className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[var(--ink-4)] hover:bg-[var(--paper-2)] hover:text-[var(--ink)] transition mb-1">
          <ChevronRight className="h-4 w-4" />
        </button>
        <button type="button" onClick={onOpenDocuments} title="Retour documents" className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[var(--ink-4)] hover:bg-[var(--paper-2)] hover:text-[var(--ink)] transition mb-2">
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
        {navDocs.map((doc) => {
          const isActive = selectedDoc.id === doc.id;
          return (
            <button
              key={doc.id}
              type="button"
              title={doc.title}
              onClick={() => onSelect(doc.id)}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-[8px] transition",
                isActive ? "bg-[var(--ink)] text-[var(--paper)]" : "text-[var(--ink-4)] hover:bg-[var(--paper-2)] hover:text-[var(--ink)]",
              )}
            >
              <DocumentListIcon type={doc.type} active={isActive} />
            </button>
          );
        })}
      </aside>
    );
  }

  return (
    <aside className="hidden w-[260px] min-w-[260px] flex-col border-r border-[var(--rule)] bg-[var(--paper)] px-4 py-4 md:flex overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={onOpenDocuments} className="flex items-center gap-1.5 text-[12px] text-[var(--ink-4)] hover:text-[var(--ink)] transition">
          <ArrowLeft className="h-3.5 w-3.5" />Documents
        </button>
        <button type="button" onClick={onToggleCollapse} title="Réduire" className="flex h-6 w-6 items-center justify-center rounded-[6px] text-[var(--ink-5)] hover:bg-[var(--paper-2)] hover:text-[var(--ink)] transition">
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
      </div>

      <div>
        <p className="eyebrow">Dans cet espace</p>
        <div className="mt-3 flex flex-col gap-px">
          {navDocs.map((doc) => {
            const isActive = selectedDoc.id === doc.id;
            return (
              <button
                key={doc.id}
                type="button"
                onClick={() => onSelect(doc.id)}
                className={cn(
                  "flex min-h-[34px] items-center gap-3 rounded-[8px] px-3 py-2 text-left text-[13px] transition",
                  isActive
                    ? "bg-[var(--ink)] text-[var(--paper)]"
                    : "text-[var(--ink-3)] hover:bg-[var(--paper-2)] hover:text-[var(--ink)]",
                )}
              >
                <DocumentListIcon type={doc.type} active={isActive} />
                <span className="flex-1 truncate">{doc.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      <hr className="rule my-5" />

      <div>
        <p className="eyebrow">Sommaire</p>
        <div className="mt-3 flex flex-col gap-2 border-l border-[var(--rule)] pl-3 text-[12.5px] text-[var(--ink-3)]">
          {outline.length > 0 ? outline.map((heading, index) => (
            <span key={`${heading.title}-${index}`} className={cn(index === 0 ? "text-[var(--ink)]" : "")}>{heading.title}</span>
          )) : (
            <span>Aucun intertitre pour le moment</span>
          )}
        </div>
      </div>
    </aside>
  );
}

function DocumentsHomeViewV2({ docs, onSelect, topics, onCreateRoot, spaceId }: { docs: Document[]; onSelect: (id: string) => void; topics: Topic[]; onCreateRoot: () => void; spaceId: string }) {
  const activeDocs = useMemo(() => docs.filter((doc) => doc.type !== "folder" && !doc.is_archived), [docs]);
  const recent = useMemo(() => [...activeDocs].sort((a, b) => new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime()).slice(0, 4), [activeDocs]);
  const pagesCount = activeDocs.filter((doc) => doc.type !== "whiteboard" && doc.type !== "mermaid").length;
  const whiteboardsCount = activeDocs.filter((doc) => doc.type === "whiteboard").length;
  const latestUpdatedAt = activeDocs[0]?.updated_at ?? null;
  const topicById = useMemo(() => Object.fromEntries(topics.map((topic) => [topic.id, topic])), [topics]);
  const hubLabel = spaceId || "HCL-Livret";

  if (docs.length === 0) {
    return (
      <div className="min-h-full overflow-y-auto bg-[var(--paper)] px-8 py-7 lg:px-10 lg:py-8">
        <div className="empty-state">
          <div className="empty-state-icon">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <p className="empty-state-title">Aucun document</p>
            <p className="empty-state-description">Creez votre premiere page ou un whiteboard pour lancer le knowledge hub.</p>
          </div>
          <button onClick={onCreateRoot} className="btn-primary">Creer la premiere page</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full overflow-y-auto bg-[var(--paper)] px-8 py-7 lg:px-10 lg:py-8">
      <div className="space-y-10">
        <div className="flex items-start justify-between gap-8 border-b border-[var(--rule)] pb-7">
          <div className="min-w-0">
            <p className="eyebrow">Espace · Knowledge hub</p>
            <h1 className="mt-1 font-[var(--font-display)] text-[clamp(3.8rem,6vw,6rem)] leading-[0.88] tracking-[-0.05em] text-[var(--ink)]">Documents</h1>
            <p className="mt-4 max-w-[62ch] text-sm leading-7 text-[var(--text-muted)]">
              Les pages vivantes de l equipe : specs, fiches, comptes-rendus, diagrammes et whiteboards.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="pill">{pagesCount.toString().padStart(2, "0")} pages</span>
              <span className="pill">{whiteboardsCount.toString().padStart(2, "0")} whiteboard</span>
              <span className="pill">Derniere maj · {formatShortDocDate(latestUpdatedAt)}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-start gap-2 pt-2">
            <button className="btn" type="button">Modeles</button>
            <button className="btn accent" type="button" onClick={onCreateRoot}>+ Nouvelle page</button>
          </div>
        </div>

        <section>
          <div className="sec-h border-b border-[var(--rule)] pb-3">
            <div>
              <p className="eyebrow">Recemment modifies</p>
              <h2 style={{ fontSize: "28px" }}>Cette semaine</h2>
            </div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-3">
            {recent.map((doc) => {
              const topic = doc.topic_id ? topicById[doc.topic_id] : null;
              return (
                <button key={doc.id} type="button" onClick={() => onSelect(doc.id)} className="card card-hover p-[18px] text-left">
                  <div className="flex items-center justify-between gap-4 text-[10.5px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">
                    <span>{documentEyeLabel(doc.type)}</span>
                    <span>{doc.type === "whiteboard" ? "" : documentVersion(doc)}</span>
                  </div>
                  <div className="mt-2 font-[var(--font-display)] text-[19px] leading-[1.15] text-[var(--text-strong)]">{doc.title}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {topic ? <span className="tag">{topic.title}</span> : null}
                    {doc.type === "whiteboard" ? <span className="tag cool">whiteboard</span> : <span className="tag accent">{documentStatus(doc)}</span>}
                  </div>
                  <div className="mt-4 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                    <span className="mono">{documentListLabel(doc.type)}</span>
                    <span className="mono">{formatShortDocDate(doc.updated_at)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <div className="sec-h border-b border-[var(--rule)] pb-3">
            <div>
              <p className="eyebrow">Arborescence</p>
              <h2 style={{ fontSize: "28px" }}>Toutes les pages</h2>
            </div>
          </div>
          <div className="tlist mt-4">
            {activeDocs.map((doc) => {
              const topic = doc.topic_id ? topicById[doc.topic_id] : null;
              return (
                <button key={doc.id} type="button" onClick={() => onSelect(doc.id)} className="trow w-full text-left" style={{ gridTemplateColumns: "40px 1fr 120px 140px 110px 110px" }}>
                  <span style={{ color: "var(--ink-4)" }}>{documentGlyph(doc.type)}</span>
                  <div>
                    <div className="t-title" style={{ fontFamily: "var(--font-display)", fontSize: "18px" }}>{doc.title}</div>
                    <div className="t-tags">
                      {topic ? <span className="tag">{topic.title}</span> : null}
                      {doc.type === "whiteboard" ? <span className="tag cool">whiteboard</span> : null}
                    </div>
                  </div>
                  <span className="mono text-[11px] text-[var(--text-muted)]">{documentListLabel(doc.type)}</span>
                  <span className="mono text-[11px] text-[var(--text-muted)]">{formatDocDate(doc.updated_at)}</span>
                  <span className="mono text-[11px] text-[var(--text-muted)]">{documentEditorName(doc)}</span>
                  <span className="btn ghost justify-self-end">Ouvrir {"\u2192"}</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function DocumentPageMetaPanelV2({ doc, topics }: { doc: Document; topics: Topic[] }) {
  const topic = topics.find((item) => item.id === doc.topic_id) ?? null;
  const comments = documentComments(doc);

  return (
    <aside className="hidden w-[260px] min-w-[260px] flex-col border-l border-[var(--rule)] bg-[var(--paper-2)] px-5 py-6 xl:flex">
      <div>
        <p className="eyebrow">Proprietes</p>
        <div className="mt-4 space-y-4 text-[12.5px]">
          <div>
            <p className="eyebrow">Story</p>
            <div className="mt-1">{topic ? <span className="pill accent">{topic.title}</span> : <span className="pill">Aucune</span>}</div>
          </div>
          <div>
            <p className="eyebrow">Statut</p>
            <div className="mt-1"><span className="pill">{documentStatus(doc)}</span></div>
          </div>
          <div>
            <p className="eyebrow">Version</p>
            <div className="mt-1 font-mono text-[11px] text-[var(--ink-3)]">{documentVersion(doc)} · {formatShortDocDate(doc.updated_at)}</div>
          </div>
          <div>
            <p className="eyebrow">Tags</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {doc.tags.length > 0 ? doc.tags.map((tag) => <span key={tag} className="tag">{tag}</span>) : <span className="text-[var(--ink-4)]">Aucun tag</span>}
            </div>
          </div>
        </div>
      </div>

      <hr className="rule my-5" />

      <div>
        <p className="eyebrow">Commentaires · {comments.length}</p>
        {comments.length > 0 ? (
          <div className="mt-3 flex flex-col gap-3">
            {comments.map((comment, index) => (
              <div key={`${comment.author}-${index}`} className="rounded-[10px] bg-[var(--paper)] p-3 text-[12.5px] text-[var(--ink-3)]">
                <div className="mb-2 flex items-center gap-2">
                  <div className={cn(
                    "flex h-[18px] w-[18px] items-center justify-center rounded-full text-[9px] font-semibold",
                    comment.tone === "cool" ? "bg-[var(--cool)] text-white" : "bg-[var(--warm)] text-[var(--accent-ink)]",
                  )}>
                    {comment.author.slice(0, 2).toUpperCase()}
                  </div>
                  <b className="text-[12px] text-[var(--ink)]">{comment.author}</b>
                  <span className="mono text-[10px] text-[var(--ink-5)]">{comment.time ?? "recent"}</span>
                </div>
                <div>{comment.text}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-[10px] bg-[var(--paper)] p-3 text-[12.5px] text-[var(--ink-3)]">
            Aucun commentaire synchronise pour cette page.
          </div>
        )}
      </div>
    </aside>
  );
}

function DocumentEditorialHeaderV2({
  doc,
  topics,
  saveStatus,
  onRename,
  onDelete,
  onTopicChange,
  onBack,
}: {
  doc: Document;
  topics: Topic[];
  saveStatus: "idle" | "pending" | "saved";
  onRename: (title: string) => void;
  onDelete: () => void;
  onTopicChange: (topicId: string | null) => void;
  onBack?: () => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleVal, setTitleVal] = useState(doc.title);
  const [menuOpen, setMenuOpen] = useState(false);
  const titleParts = splitDocumentTitle(doc.title);

  return (
    <div className="sticky top-0 z-20 border-b border-[var(--rule)] bg-[var(--paper)] px-6 pb-4 pt-7 lg:px-[60px]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              title="Retour a la liste"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--rule)] bg-[var(--paper)] text-[var(--ink-3)] transition hover:bg-[var(--paper-2)] hover:text-[var(--ink)] md:hidden"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : null}
          <p className="eyebrow">Page · {doc.title}</p>
        </div>

        {editingTitle ? (
          <input
            autoFocus
            value={titleVal}
            onChange={(event) => setTitleVal(event.target.value)}
            onBlur={() => { setEditingTitle(false); onRename(titleVal); }}
            onKeyDown={(event) => {
              if (event.key === "Enter") { setEditingTitle(false); onRename(titleVal); }
              if (event.key === "Escape") setEditingTitle(false);
            }}
            className="mt-3 w-full border-0 bg-transparent px-0 py-0 font-[var(--font-display)] text-[clamp(2.2rem,3.2vw,3.7rem)] leading-[0.98] tracking-[-0.04em] text-[var(--ink)] outline-none"
          />
        ) : (
          <h2
            className="mt-3 max-w-[22ch] cursor-text break-words font-[var(--font-display)] text-[clamp(2.2rem,3.2vw,3.7rem)] leading-[0.98] tracking-[-0.04em] text-[var(--ink)]"
            title="Cliquer pour renommer"
            onClick={() => { setEditingTitle(true); setTitleVal(doc.title); }}
          >
            {titleParts.lead}
            {titleParts.tail ? <em className="text-[var(--ink-3)]"> - {titleParts.tail}</em> : null}
          </h2>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3 text-[12px] text-[var(--ink-4)]">
          <div className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[var(--cool)] text-[10px] font-semibold text-white">
            {documentEditorInitials(doc)}
          </div>
          <span>{documentEditorName(doc)} · edite le {formatDocDate(doc.updated_at)}</span>
          <span className="mono rounded-full border border-[var(--rule)] bg-[var(--paper-2)] px-3 py-1">
            {docTypeLabel(doc.type)}
          </span>
          <span className="mono rounded-full border border-[var(--rule)] bg-[var(--paper-2)] px-3 py-1">
            {documentVersion(doc)}
          </span>
          {saveStatus === "pending" ? (
            <span className="mono flex items-center gap-2 text-[var(--ink-4)]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Enregistrement...
            </span>
          ) : null}
          {saveStatus === "saved" ? (
            <span className="mono flex items-center gap-2 text-[var(--success)]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Enregistre
            </span>
          ) : null}

          <span className="ml-auto flex flex-wrap gap-2">
            <button type="button" className="btn ghost">Historique</button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                if (typeof window !== "undefined" && navigator?.clipboard) {
                  void navigator.clipboard.writeText(window.location.href);
                }
              }}
            >
              <Share2 className="h-4 w-4" />
              Partager
            </button>
            <button type="button" className="btn accent">+ Creer une tache</button>
            <span className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((value) => !value)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--rule)] bg-[var(--paper)] text-[var(--ink-3)] transition hover:bg-[var(--paper-2)] hover:text-[var(--ink)]"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {menuOpen ? (
                <div className="absolute right-0 top-12 z-30 min-w-[220px] rounded-[16px] border border-[var(--rule)] bg-[var(--paper)] p-2 shadow-[0_24px_48px_rgba(28,24,20,0.08)]">
                  <button
                    type="button"
                    onClick={() => { setEditingTitle(true); setTitleVal(doc.title); setMenuOpen(false); }}
                    className="flex w-full items-center gap-2 rounded-[12px] px-3 py-2 text-sm text-[var(--ink)] transition hover:bg-[var(--paper-2)]"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Renommer
                  </button>

                  {topics.length > 0 ? (
                    <div className="px-3 py-2">
                      <p className="eyebrow">Topic lie</p>
                      <select
                        value={doc.topic_id ?? ""}
                        onChange={(event) => { onTopicChange(event.target.value || null); setMenuOpen(false); }}
                        className="mt-2 w-full rounded-[12px] border border-[var(--rule)] bg-[var(--paper-2)] px-3 py-2 text-sm text-[var(--ink)] outline-none"
                      >
                        <option value="">Aucun</option>
                        {topics.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                      </select>
                    </div>
                  ) : null}

                  <div className="mx-2 my-1 border-t border-[var(--rule)]" />

                  <button
                    type="button"
                    onClick={() => { onDelete(); setMenuOpen(false); }}
                    className="flex w-full items-center gap-2 rounded-[12px] px-3 py-2 text-sm text-[var(--hot)] transition hover:bg-[var(--hot-soft)]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Supprimer
                  </button>
                </div>
              ) : null}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

function DocumentsHomeViewV3({
  docs,
  onSelect,
  topics,
  onCreateRoot,
  spaceId,
}: {
  docs: Document[];
  onSelect: (id: string) => void;
  topics: Topic[];
  onCreateRoot: () => void;
  spaceId: string;
}) {
  const activeDocs = useMemo(() => docs.filter((doc) => doc.type !== "folder" && !doc.is_archived), [docs]);
  const recent = useMemo(() => [...activeDocs].sort((a, b) => new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime()).slice(0, 4), [activeDocs]);
  const pagesCount = activeDocs.filter((doc) => doc.type !== "whiteboard" && doc.type !== "mermaid").length;
  const whiteboardsCount = activeDocs.filter((doc) => doc.type === "whiteboard").length;
  const latestUpdatedAt = activeDocs[0]?.updated_at ?? null;
  const topicById = useMemo(() => Object.fromEntries(topics.map((topic) => [topic.id, topic])), [topics]);

  if (docs.length === 0) {
    return (
      <div className="min-h-full overflow-y-auto bg-[var(--paper)] px-8 py-7 lg:px-10 lg:py-8">
        <div className="empty-state">
          <div className="empty-state-icon">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <p className="empty-state-title">Aucun document</p>
            <p className="empty-state-description">Creez votre premiere page ou un whiteboard pour lancer le knowledge hub.</p>
          </div>
          <button onClick={onCreateRoot} className="btn-primary">Creer la premiere page</button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[var(--paper)] px-8 py-7 lg:px-10 lg:py-8">
      <div className="space-y-10">
        <div className="flex items-start justify-between gap-8 border-b border-[var(--rule)] pb-[18px]">
          <div className="min-w-0">
            <div className="eyebrow">Espace{" \u00b7 "}{spaceId || "HCL-Livret"}</div>
            <h1 className="mt-1 font-[var(--font-display)] text-[64px] leading-[0.92] tracking-[-0.05em] text-[var(--ink)]">
              <span>S1 {"\u2014"} 2026</span>
              <br />
              <em className="text-[var(--accent-deep)]">Documents</em>
            </h1>
            <div className="mt-3 max-w-[72ch] text-sm leading-6 text-[var(--ink-4)]">
              Semestre 1{" \u00b7 "}Liberalisation code GEF{" \u00b7 "}MDS{" \u00b7 "}WCP. Les pages vivantes de l'equipe : specs, fiches, comptes-rendus, whiteboards.
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="pill">{pagesCount.toString().padStart(2, "0")} pages</span>
              <span className="pill">{whiteboardsCount.toString().padStart(2, "0")} whiteboard</span>
              <span className="pill">Derniere maj{" \u00b7 "}{formatShortDocDate(latestUpdatedAt)}</span>
            </div>
          </div>

          <div className="flex shrink-0 items-start gap-2 pt-2">
            <button className="btn" type="button">Modeles</button>
            <button className="btn accent" type="button" onClick={onCreateRoot}>+ Nouvelle page</button>
          </div>
        </div>

        <section>
          <div className="sec-h border-b border-[var(--rule)] pb-3">
            <div>
              <p className="eyebrow">Recemment modifies</p>
              <h2 style={{ fontSize: "28px" }}>Cette semaine</h2>
            </div>
            <button className="btn ghost" type="button">Tout voir {"\u2192"}</button>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-3">
            {recent.map((doc) => {
              const topic = doc.topic_id ? topicById[doc.topic_id] : null;
              return (
                <button key={doc.id} type="button" onClick={() => onSelect(doc.id)} className="card card-hover p-[18px] text-left">
                  <div className="flex items-center justify-between gap-4 text-[10.5px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">
                    <span>{documentEyeLabel(doc.type)}</span>
                    <span>{doc.type === "whiteboard" ? "" : documentVersion(doc)}</span>
                  </div>
                  <div className="mt-2 font-[var(--font-display)] text-[19px] leading-[1.15] text-[var(--text-strong)]">{doc.title}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {topic ? <span className="tag">{topic.title}</span> : null}
                    {doc.type === "whiteboard" ? <span className="tag cool">whiteboard</span> : <span className="tag accent">{documentStatus(doc)}</span>}
                  </div>
                  <div className="mt-4 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                    <div className="flex items-center gap-2">
                      <div className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[var(--ink)] text-[9px] font-semibold text-[var(--paper)]">
                        {documentEditorInitials(doc)}
                      </div>
                      <span>{documentEditorName(doc)}</span>
                    </div>
                    <span className="mono">{formatShortDocDate(doc.updated_at)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <div className="sec-h border-b border-[var(--rule)] pb-3">
            <div>
              <p className="eyebrow">Arborescence</p>
              <h2 style={{ fontSize: "28px" }}>Toutes les pages</h2>
            </div>
          </div>

          <div className="tlist mt-4">
            {activeDocs.map((doc) => {
              const topic = doc.topic_id ? topicById[doc.topic_id] : null;
              return (
                <button key={doc.id} type="button" onClick={() => onSelect(doc.id)} className="trow w-full text-left" style={{ gridTemplateColumns: "40px 1fr 120px 140px 110px 110px" }}>
                  <span style={{ color: "var(--ink-4)" }}>{documentGlyph(doc.type)}</span>
                  <div>
                    <div className="t-title" style={{ fontFamily: "var(--font-display)", fontSize: "18px" }}>{doc.title}</div>
                    <div className="t-tags">
                      {topic ? <span className="tag">{topic.title}</span> : null}
                      {doc.type === "whiteboard" ? <span className="tag cool">whiteboard</span> : <span className="tag accent">{documentStatus(doc)}</span>}
                    </div>
                  </div>
                  <span className="mono text-[11px] text-[var(--text-muted)]">{documentListLabel(doc.type)}</span>
                  <span className="mono text-[11px] text-[var(--text-muted)]">{formatDocDate(doc.updated_at)}</span>
                  <span className="mono text-[11px] text-[var(--text-muted)]">{documentEditorName(doc)}</span>
                  <span className="btn ghost justify-self-end">Ouvrir {"\u2192"}</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function DocumentPageMetaPanelV3({ doc, topics }: { doc: Document; topics: Topic[] }) {
  const topic = topics.find((item) => item.id === doc.topic_id) ?? null;
  const comments = documentComments(doc);

  return (
    <aside className="hidden min-h-0 w-[260px] min-w-[260px] flex-col overflow-y-auto border-l border-[var(--rule)] bg-[var(--paper-2)] px-[18px] py-[22px] xl:flex">
      <div>
        <div className="eyebrow">Proprietes</div>
        <div className="mt-[10px] flex flex-col gap-3 text-[12.5px]">
          <div>
            <div className="eyebrow">Story</div>
            <div className="mt-1">{topic ? <span className="pill accent">{topic.title}</span> : <span className="pill">Aucune</span>}</div>
          </div>
          <div>
            <div className="eyebrow">Statut</div>
            <div className="mt-1"><span className="pill">{documentStatus(doc)}</span></div>
          </div>
          <div>
            <div className="eyebrow">Version</div>
            <div className="mt-1 mono text-[11px] text-[var(--ink-3)]">{documentVersion(doc)}{" \u00b7 "}{formatShortDocDate(doc.updated_at)}</div>
          </div>
          <div>
            <div className="eyebrow">Tags</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {doc.tags.length > 0 ? doc.tags.map((tag) => <span key={tag} className="tag">{tag}</span>) : <span className="text-[var(--ink-4)]">Aucun tag</span>}
            </div>
          </div>
        </div>
      </div>

      <hr className="rule my-[18px]" />

      <div>
        <div className="eyebrow">Commentaires{" \u00b7 "}{comments.length}</div>
        <div className="mt-[10px] flex flex-col gap-[10px]">
          {comments.length > 0 ? comments.map((comment, index) => (
            <div key={`${comment.author}-${index}`} className="rounded-[8px] bg-[var(--paper)] p-[10px] text-[12.5px] text-[var(--ink-3)]">
              <div className="mb-[6px] flex items-center gap-2">
                <div className={cn(
                  "flex h-[18px] w-[18px] items-center justify-center rounded-full text-[9px] font-semibold",
                  comment.tone === "cool" ? "bg-[var(--cool)] text-white" : "bg-[var(--warm)] text-[#3E2A05]",
                )}>
                  {comment.author.slice(0, 2).toUpperCase()}
                </div>
                <b className="text-[12px] text-[var(--ink)]">{comment.author}</b>
                <span className="mono text-[10px] text-[var(--ink-5)]">{comment.time ?? "recent"}</span>
              </div>
              <div>{comment.text}</div>
            </div>
          )) : (
            <div className="rounded-[8px] bg-[var(--paper)] p-[10px] text-[12.5px] text-[var(--ink-3)]">
              Aucun commentaire synchronise pour cette page.
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function DocumentEditorialHeaderV3({
  doc,
  topics,
  saveStatus,
  onRename,
  onDelete,
  onTopicChange,
  onBack,
}: {
  doc: Document;
  topics: Topic[];
  saveStatus: "idle" | "pending" | "saved";
  onRename: (title: string) => void;
  onDelete: () => void;
  onTopicChange: (topicId: string | null) => void;
  onBack?: () => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleVal, setTitleVal] = useState(doc.title);
  const [menuOpen, setMenuOpen] = useState(false);
  const titleParts = splitDocumentTitle(doc.title);
  const topic = topics.find((item) => item.id === doc.topic_id) ?? null;
  const eyebrow = topic?.title ?? "Liberalisation code GEF";

  return (
    <div className="sticky top-0 z-20 border-b border-[var(--rule)] bg-[var(--paper)] px-6 pb-4 pt-5 lg:px-8 xl:px-10">
      <div className="flex items-start justify-between gap-6">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            title="Retour aux documents"
            className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--rule)] bg-[var(--paper)] text-[var(--ink-3)] transition hover:bg-[var(--paper-2)] hover:text-[var(--ink)] md:hidden"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        ) : null}

        <div className="min-w-0 max-w-[820px] flex-1">
          <div className="eyebrow">Page{" \u00b7 "}{eyebrow}</div>

          {editingTitle ? (
            <input
              autoFocus
              value={titleVal}
              onChange={(event) => setTitleVal(event.target.value)}
              onBlur={() => { setEditingTitle(false); onRename(titleVal); }}
              onKeyDown={(event) => {
                if (event.key === "Enter") { setEditingTitle(false); onRename(titleVal); }
                if (event.key === "Escape") setEditingTitle(false);
              }}
              className="mt-1 w-full border-0 bg-transparent px-0 py-0 font-[var(--font-display)] text-[clamp(2.2rem,2.8vw,3.35rem)] leading-[0.94] tracking-[-0.045em] text-[var(--ink)] outline-none"
            />
          ) : (
            <h2
              className="mt-1 max-w-[28ch] cursor-text break-words font-[var(--font-display)] text-[clamp(2.2rem,2.8vw,3.35rem)] leading-[0.94] tracking-[-0.045em] text-[var(--ink)]"
              title="Cliquer pour renommer"
              onClick={() => { setEditingTitle(true); setTitleVal(doc.title); }}
            >
              {titleParts.lead}
              {titleParts.tail ? <em className="text-[var(--ink-3)]"> {"\u2014"} {titleParts.tail}</em> : null}
            </h2>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-[10px] text-[11px] text-[var(--ink-4)]">
            <div className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[var(--ink)] text-[10px] font-semibold text-[var(--paper)]">
              {documentEditorInitials(doc)}
            </div>
            <span>{documentEditorName(doc)}{" \u00b7 "}edite le {formatDocDate(doc.updated_at)}</span>
            {saveStatus === "pending" ? (
              <span className="mono text-[var(--ink-4)]">Enregistrement...</span>
            ) : null}
            {saveStatus === "saved" ? (
              <span className="mono text-[var(--success)]">Enregistre</span>
            ) : null}
          </div>
        </div>

        <div className="hidden shrink-0 flex-wrap items-center justify-end gap-[6px] pt-5 lg:flex">
          <button type="button" className="btn ghost">Historique</button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              if (typeof window !== "undefined" && navigator?.clipboard) {
                void navigator.clipboard.writeText(window.location.href);
              }
            }}
          >
            Partager
          </button>
          <button type="button" className="btn accent">+ Creer une tache</button>
          <span className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--rule)] bg-[var(--paper)] text-[var(--ink-3)] transition hover:bg-[var(--paper-2)] hover:text-[var(--ink)]"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menuOpen ? (
              <div className="absolute right-0 top-12 z-30 min-w-[220px] rounded-[16px] border border-[var(--rule)] bg-[var(--paper)] p-2 shadow-[0_24px_48px_rgba(28,24,20,0.08)]">
                <button
                  type="button"
                  onClick={() => { setEditingTitle(true); setTitleVal(doc.title); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2 rounded-[12px] px-3 py-2 text-sm text-[var(--ink)] transition hover:bg-[var(--paper-2)]"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Renommer
                </button>

                {topics.length > 0 ? (
                  <div className="px-3 py-2">
                    <p className="eyebrow">Topic lie</p>
                    <select
                      value={doc.topic_id ?? ""}
                      onChange={(event) => { onTopicChange(event.target.value || null); setMenuOpen(false); }}
                      className="mt-2 w-full rounded-[12px] border border-[var(--rule)] bg-[var(--paper-2)] px-3 py-2 text-sm text-[var(--ink)] outline-none"
                    >
                      <option value="">Aucun</option>
                      {topics.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                    </select>
                  </div>
                ) : null}

                <div className="mx-2 my-1 border-t border-[var(--rule)]" />

                <button
                  type="button"
                  onClick={() => { onDelete(); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2 rounded-[12px] px-3 py-2 text-sm text-[var(--hot)] transition hover:bg-[var(--hot-soft)]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Supprimer
                </button>
              </div>
            ) : null}
          </span>
        </div>
      </div>
    </div>
  );
}

export function DocumentsTab({ projectId, spaceId, topics }: DocumentsTabProps) {
  const { data: docs = [], isLoading } = useDocuments({ spaceId });
  const { data: syncStatus } = useProjectDocumentsSyncStatus(projectId);
  const { mutateAsync: update } = useUpdateDocument();
  const { mutateAsync: deleteDoc } = useDeleteDocument();
  const { mutateAsync: syncProjectDocs, isPending: syncingProject } = useSyncProjectDocuments(projectId ?? "");
  const { mutateAsync: syncDocument, isPending: syncingDocument } = useSyncDocument(projectId);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [topicFilter, setTopicFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"tree" | "list">("tree");
  const [showCreateRoot, setShowCreateRoot] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "pending" | "saved">("idle");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingContentRef = useRef<{ id: string; content: string } | null>(null);

  const filteredDocs = useMemo(() => {
    return docs.filter((d) => {
      if (topicFilter !== "all" && d.topic_id !== topicFilter) return false;
      if (search && !d.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [docs, topicFilter, search]);

  const tree = useMemo(() => buildTree(filteredDocs), [filteredDocs]);

  const selectedDoc = useMemo(() => docs.find((d) => d.id === selectedId) ?? null, [docs, selectedId]);
  const selectedNode = useMemo((): TreeNode | null => {
    function find(nodes: TreeNode[]): TreeNode | null {
      for (const n of nodes) {
        if (n.id === selectedId) return n;
        const found = find(n.children);
        if (found) return found;
      }
      return null;
    }
    return find(tree);
  }, [tree, selectedId]);

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // Cancel pending save when switching documents to prevent cross-document saves
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    pendingContentRef.current = null;
    setSaveStatus("idle");
  }, [selectedId]);

  // Debounced auto-save — fires 1.5s after the last keystroke
  const handleContentChange = useCallback((content: string) => {
    if (!selectedDoc) return;
    pendingContentRef.current = { id: selectedDoc.id, content };
    setSaveStatus("pending");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const pending = pendingContentRef.current;
      if (!pending) return;
      try {
        await update({ id: pending.id, content: pending.content });
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch {
        setSaveStatus("idle");
      }
    }, 1500);
  }, [selectedDoc, update]);

  async function handleRename(title: string) {
    if (!selectedDoc || !title.trim()) return;
    await update({ id: selectedDoc.id, title: title.trim() });
  }

  async function handleDelete() {
    if (!selectedDoc) return;
    if (!confirm(`Supprimer "${selectedDoc.title}" ?`)) return;
    setSelectedId(null);
    await deleteDoc(selectedDoc.id);
  }

  async function handleTopicChange(topicId: string | null) {
    if (!selectedDoc) return;
    await update({ id: selectedDoc.id, topic_id: topicId });
  }

  async function handleToggleAiEnabled() {
    if (!selectedDoc) return;
    await update({ id: selectedDoc.id, ai_enabled: !selectedDoc.ai_enabled });
  }

  async function handleSyncSelectedDocument() {
    if (!selectedDoc) return;
    await syncDocument(selectedDoc.id);
  }

  function handleCreatedDocument(doc: Document) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    pendingContentRef.current = null;
    setSaveStatus("idle");
    if (doc.parent_id) {
      setExpandedIds((prev) => new Set(prev).add(doc.parent_id!));
    }
    setSelectedId(doc.id);
  }

  const usesDedicatedPageWorkspace =
    selectedDoc?.type === "page" || selectedDoc?.type === "note" || selectedDoc?.type === "artifact";

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-[var(--paper)]">
      {projectId && syncStatus ? (
        <div className="flex-shrink-0 border-b border-[var(--rule)] bg-[var(--paper)] px-4 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--paper-2)] px-3 py-1 text-xs font-semibold text-[var(--text-strong)]">
              Google sync: {syncStatus.google_sync_status}
            </span>
            <span className="rounded-full bg-[var(--paper-2)] px-3 py-1 text-xs font-semibold text-[var(--text-strong)]">
              Corpus: {syncStatus.corpus_status}
            </span>
            <span className="rounded-full bg-[var(--paper-2)] px-3 py-1 text-xs font-semibold text-[var(--text-strong)]">
              {syncStatus.synced_documents}/{syncStatus.eligible_documents} documents synchronises
            </span>
            <button
              type="button"
              onClick={() => void syncProjectDocs()}
              disabled={syncingProject}
              className="rounded-full border border-[var(--rule)] px-3 py-1 text-xs font-semibold text-[var(--text-strong)] transition hover:bg-[var(--paper-2)] disabled:opacity-60"
            >
              {syncingProject ? "Sync..." : "Resynchroniser le corpus"}
            </button>
            {selectedDoc ? (
              <>
                <button
                  type="button"
                  onClick={() => void handleToggleAiEnabled()}
                  className="rounded-full border border-[var(--rule)] px-3 py-1 text-xs font-semibold text-[var(--text-strong)] transition hover:bg-[var(--paper-2)]"
                >
                  IA: {selectedDoc.ai_enabled ? "inclu" : "exclu"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSyncSelectedDocument()}
                  disabled={syncingDocument || !selectedDoc.ai_enabled}
                  className="rounded-full border border-[var(--rule)] px-3 py-1 text-xs font-semibold text-[var(--text-strong)] transition hover:bg-[var(--paper-2)] disabled:opacity-60"
                >
                  {syncingDocument ? "Sync doc..." : "Synchroniser ce document"}
                </button>
                <span className="rounded-full bg-[var(--paper-2)] px-3 py-1 text-xs font-semibold text-[var(--text-strong)]">
                  Doc: {selectedDoc.google_sync_status}
                </span>
              </>
            ) : null}
            {syncStatus.last_error ? (
              <span className="text-xs font-medium text-[var(--danger)]">{syncStatus.last_error}</span>
            ) : null}
          </div>
        </div>
      ) : null}
      {showCreateRoot && (
        <CreateDocModal
          spaceId={spaceId}
          parentId={null}
          topics={topics}
          onClose={() => setShowCreateRoot(false)}
          onCreated={handleCreatedDocument}
        />
      )}

      {/* ── Content row: sidebar + main ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

      {/* ── Left Sidebar ── */}
      {!selectedDoc ? (
        <DocumentsHubSidebarV2 docs={filteredDocs} selectedId={selectedId} onSelect={setSelectedId} collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed((v) => !v)} />
      ) : selectedDoc.type === "page" || selectedDoc.type === "note" || selectedDoc.type === "artifact" ? (
        <DocumentPageSidebarV2
          docs={filteredDocs}
          selectedDoc={selectedDoc}
          onOpenDocuments={() => setSelectedId(null)}
          onSelect={setSelectedId}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        />
      ) : (
        <DocumentsHubSidebarV2 docs={filteredDocs} selectedId={selectedId} onSelect={setSelectedId} collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed((v) => !v)} />
      )}

      <aside className="hidden">
        {/* Sidebar header */}
        <div className="border-b border-[var(--border)] px-5 py-5">
          <div className="mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-violet-600)]">Knowledge hub</p>
</div>
          <button onClick={() => setShowCreateRoot(true)} className="btn-primary w-full rounded-[16px]">
            <Plus className="h-4 w-4" />Nouvelle page
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pt-5">
          <div className="flex items-center gap-2 rounded-[16px] border border-[var(--border)] bg-[var(--bg-panel-3)] px-4 py-3 shadow-[var(--shadow-xs)] transition duration-200 ease-in-out focus-within:border-[rgba(141,140,246,0.24)] focus-within:shadow-[0_10px_24px_rgba(141,140,246,0.12)]">
            <Search className="h-4 w-4 flex-shrink-0 text-[var(--text-xmuted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher…"
              className="flex-1 bg-transparent text-sm text-[var(--text-strong)] outline-none placeholder:text-[var(--text-xmuted)]"
            />
          </div>
        </div>

        {/* Topic filter */}
        {topics.length > 0 && (
          <div className="hidden px-4 pt-3">
            <select
              value={topicFilter}
              onChange={(e) => setTopicFilter(e.target.value)}
              className="w-full rounded-2xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text-strong)] outline-none shadow-sm focus:border-brand-500"
            >
              <option value="all">Tous les topics</option>
              {topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
        )}

        {/* View mode toggle */}
        <div className="hidden px-4 pt-3">
          <div className="flex items-center rounded-2xl border border-[var(--border)] bg-white p-1 shadow-sm">
            <button onClick={() => setViewMode("tree")} className={cn("flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition", viewMode === "tree" ? "bg-brand-500 text-white shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-strong)]")}><Layers className="h-3.5 w-3.5" />Arborescence</button>
            <button onClick={() => setViewMode("list")} className={cn("flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition", viewMode === "list" ? "bg-brand-500 text-white shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-strong)]")}><List className="h-3.5 w-3.5" />Liste</button>
          </div>
        </div>

        <div className="hidden px-4 pt-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-[var(--border)] bg-white p-3 shadow-sm">
              <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">Corpus</p>
              <p className="mt-1 text-lg font-bold text-[var(--text-strong)]">{filteredDocs.length}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-white p-3 shadow-sm">
              <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">Dossiers</p>
              <p className="mt-1 text-lg font-bold text-[var(--text-strong)]">{filteredDocs.filter((doc) => doc.type === "folder").length}</p>
            </div>
          </div>
        </div>

        {/* Tree / List */}
        <div className="mt-5 flex-1 overflow-y-auto px-4 pb-5">
          {isLoading ? (
            <div className="flex items-center gap-1.5 px-2 py-3 text-xs text-[var(--text-muted)]"><Loader2 className="h-3 w-3 animate-spin" />Chargement…</div>
          ) : filteredDocs.length === 0 ? (
            <p className="px-2 py-3 text-xs text-[var(--text-muted)]">Aucun document</p>
          ) : viewMode === "tree" ? (
            <div className="space-y-1 rounded-[24px] bg-[var(--bg-panel-3)] p-2 shadow-[var(--shadow-sm)]">
              {tree.map((node) => (
                <TreeItem
                  key={node.id}
                  node={node}
                  selectedId={selectedId}
                  expandedIds={expandedIds}
                  onSelect={setSelectedId}
                  onToggle={toggleExpanded}
                  depth={0}
                />
              ))}
            </div>
          ) : (
            filteredDocs.map((doc) => {
              const Icon = docTypeIcon(doc.type);
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => setSelectedId(doc.id)}
                  className={cn(
                    "mb-2 flex w-full items-start gap-3 rounded-[22px] px-3.5 py-3 text-left transition duration-200 ease-in-out",
                    selectedId === doc.id
                      ? "bg-gradient-to-r from-[#8B5CF6] to-[#3B82F6] text-white shadow-[0_16px_32px_rgba(79,70,229,0.2)] ring-1 ring-white/60"
                      : "bg-white text-slate-500 shadow-[0_10px_24px_rgba(15,23,42,0.04)] hover:bg-slate-100/80 hover:text-slate-900",
                  )}
                >
                  <div className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl",
                    selectedId === doc.id ? "bg-white/18 text-white" : "bg-slate-100 text-[#4F46E5]",
                  )}>
                    <Icon className="h-4 w-4 flex-shrink-0" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{doc.title}</p>
                    <p className={cn(
                      "mt-1 text-[11px] capitalize",
                      selectedId === doc.id ? "text-white/75" : "text-slate-400",
                    )}>{docTypeLabel(doc.type)}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────── */}
      <div className="relative flex min-w-0 flex-1 min-h-0 bg-[var(--paper)]">
        {!selectedDoc ? (
          <DocumentsHomeViewV3 docs={docs} onSelect={setSelectedId} topics={topics} onCreateRoot={() => setShowCreateRoot(true)} spaceId={spaceId} />
        ) : selectedDoc.type === "whiteboard" || selectedDoc.type === "mermaid" ? (
          /* Whiteboard & Mermaid: plein écran via portal */
          null
        ) : (
          <>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {/* Document header */}
            <DocumentEditorialHeaderV3
              doc={selectedDoc}
              topics={topics}
              saveStatus={saveStatus}
              onRename={handleRename}
              onDelete={handleDelete}
              onTopicChange={handleTopicChange}
              onBack={() => setSelectedId(null)}
            />

            {/* Editor area — scrollable */}
            <div className="flex-1 overflow-y-auto bg-[var(--paper)]">
              {selectedDoc.type === "folder" && selectedNode ? (
                <FolderView
                  node={selectedNode}
                  onSelect={setSelectedId}
                  spaceId={spaceId}
                  topics={topics}
                  onCreated={handleCreatedDocument}
                />
              ) : selectedDoc.type === "page" || selectedDoc.type === "note" || selectedDoc.type === "artifact" ? (
                <PageEditor key={selectedDoc.id} content={selectedDoc.content} onChange={handleContentChange} />
              ) : (
                <div className="flex flex-col items-center gap-3 p-12 text-center">
                  <FileText className="h-10 w-10 text-[var(--text-muted)]" />
                  <p className="text-sm text-[var(--text-muted)]">Type de document non pris en charge.</p>
                </div>
              )}
            </div>
            </div>
            {(selectedDoc.type === "page" || selectedDoc.type === "note" || selectedDoc.type === "artifact") ? (
              <DocumentPageMetaPanelV3 doc={selectedDoc} topics={topics} />
            ) : !usesDedicatedPageWorkspace ? (
              <DocumentContextPanel doc={selectedDoc} topics={topics} />
            ) : null}
          </>
        )}
      </div>

      </div>{/* end content row */}

      {/* ── Mermaid plein écran ──────────────────────────────────── */}
      {selectedDoc?.type === "mermaid" && createPortal(
        <div className="fixed inset-0 z-[200] flex flex-col bg-[var(--paper-2)]">
          <div className="flex flex-shrink-0 items-center justify-between gap-4 bg-[var(--bg-body)] px-6 py-5">
            <button
              onClick={() => setSelectedId(null)}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 py-1.5 text-xs font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-panel-3)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />Retour
            </button>
            <div className="flex flex-col leading-none">
              <span className="text-[9px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Mermaid</span>
              <span className="text-sm font-semibold text-[var(--text-strong)]">{selectedDoc.title}</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {saveStatus === "pending" && (
                <span className="flex items-center gap-1 rounded-full bg-[var(--bg-panel-2)] px-2.5 py-1 text-[10px] text-[var(--text-muted)]">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />Enregistrement…
                </span>
              )}
              {saveStatus === "saved" && (
                <span className="flex items-center gap-1 rounded-full bg-[var(--bg-panel-2)] px-2.5 py-1 text-[10px] text-[var(--accent)]">
                  <CheckCircle2 className="h-2.5 w-2.5" />Enregistré
                </span>
              )}
              {topics.length > 0 && (
                <select
                  value={selectedDoc.topic_id ?? ""}
                  onChange={(e) => handleTopicChange(e.target.value || null)}
                  className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel-2)] px-2 py-1.5 text-xs text-[var(--text-strong)] outline-none focus:border-brand-500"
                  title="Topic lié"
                >
                  <option value="">— Aucun topic —</option>
                  {topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
              )}
              <button
                onClick={handleDelete}
                className="flex items-center gap-1.5 rounded-lg border border-danger-500/40 bg-danger-500/8 px-3 py-1.5 text-xs font-medium text-danger-500 transition hover:bg-danger-500/15"
                title="Supprimer ce diagramme"
              >
                <Trash2 className="h-3.5 w-3.5" />Supprimer
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <MermaidEditor code={selectedDoc.content} onChange={handleContentChange} />
          </div>
        </div>,
        document.body,
      )}

      {/* ── Whiteboard plein écran (portal vers document.body) ─────── */}
      {selectedDoc?.type === "whiteboard" && createPortal(
        <div className="fixed inset-0 z-[200] flex flex-col bg-[var(--paper-2)]">

          {/* Topbar plein écran */}
          <div className="hidden">
            <button
              onClick={() => setSelectedId(null)}
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/78 text-slate-600 shadow-[0_10px_24px_rgba(15,23,42,0.08)] backdrop-blur-md transition duration-200 ease-in-out hover:bg-white hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            <div className="mr-auto flex flex-col leading-none">
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#3B82F6]">Whiteboard</span>
              <span className="mt-1 text-xl font-bold tracking-tight text-[#0F172A]">{selectedDoc.title}</span>
            </div>

            {/* Save indicator + avatars + share */}
            <div className="ml-auto flex items-center gap-2">
              {saveStatus === "pending" && (
                <span className="rounded-full bg-white/78 px-3 py-1 text-[11px] font-medium text-slate-500 shadow-[0_10px_24px_rgba(15,23,42,0.06)] backdrop-blur-md">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />Enregistrement…
                </span>
              )}
              {saveStatus === "saved" && (
                <span className="rounded-full bg-white/78 px-3 py-1 text-[11px] font-medium text-[#10B981] shadow-[0_10px_24px_rgba(15,23,42,0.06)] backdrop-blur-md">
                  <CheckCircle2 className="h-2.5 w-2.5" />Enregistré
                </span>
              )}
              {topics.length > 0 && (
                <select
                  value={selectedDoc.topic_id ?? ""}
                  onChange={(e) => handleTopicChange(e.target.value || null)}
                  className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel-2)] px-2 py-1.5 text-xs text-[var(--text-strong)] outline-none focus:border-brand-500"
                  title="Topic lié"
                >
                  <option value="">— Aucun topic —</option>
                  {topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
              )}
              <button
                onClick={handleDelete}
                className="flex items-center gap-1.5 rounded-lg border border-danger-500/40 bg-danger-500/8 px-3 py-1.5 text-xs font-medium text-danger-500 transition hover:bg-danger-500/15"
                title="Supprimer ce whiteboard"
              >
                <Trash2 className="h-3.5 w-3.5" />Supprimer
              </button>
            </div>
          </div>

          {/* Canvas plein écran */}
          <div className="flex-1 overflow-hidden">
            <WhiteboardEditor
              key={selectedDoc.id}
              content={selectedDoc.content}
              onChange={handleContentChange}
              title={selectedDoc.title}
              onBack={() => setSelectedId(null)}
              saveStatus={saveStatus}
            />
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
