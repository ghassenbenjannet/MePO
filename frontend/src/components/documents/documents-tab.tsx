import { useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle, AlertTriangle, ArrowLeft, CheckCircle, CheckCircle2, ChevronDown, ChevronRight,
  Clock, FileText, Folder, FolderOpen, Grid2x2, Layers, List,
  Loader2, MoreHorizontal, Pencil, Plus, Search, Trash2, XCircle,
  GitBranch,
} from "lucide-react";
import { useCreateDocument, useDeleteDocument, useDocuments, useUpdateDocument } from "../../hooks/use-documents";
import { cn } from "../../lib/utils";
import type { Document, DocType, Topic } from "../../types/domain";
import { PageEditor } from "./page-editor";
import { MermaidEditor } from "./mermaid-editor";
import { WhiteboardEditor } from "./whiteboard-editor";

// ─── Constants ───────────────────────────────────────────────────────────────

const DOC_TYPES: { value: DocType; label: string; icon: React.ElementType; description: string }[] = [
  { value: "folder", label: "Dossier", icon: Folder, description: "Organiser les documents" },
  { value: "page", label: "Page", icon: FileText, description: "Document riche — texte, callouts, tableaux, code, Mermaid" },
  { value: "whiteboard", label: "Whiteboard", icon: Grid2x2, description: "Tableau blanc — post-its, schémas libres" },
  { value: "mermaid", label: "Mermaid", icon: GitBranch, description: "Diagramme Mermaid — flux, séquence, gantt…" },
];

const CALLOUT_STYLES: Record<string, { cls: string; icon: React.ElementType }> = {
  note: { cls: "border-brand-500/40 bg-brand-500/5", icon: AlertCircle },
  warning: { cls: "border-warn-500/40 bg-warn-500/5", icon: AlertTriangle },
  success: { cls: "border-accent-500/40 bg-accent-500/5", icon: CheckCircle },
  error: { cls: "border-danger-500/40 bg-danger-500/5", icon: XCircle },
};

function docTypeIcon(type: DocType): React.ElementType {
  const found = DOC_TYPES.find((d) => d.value === type);
  return found?.icon ?? FileText;
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
  spaceId, parentId, topics, onClose,
}: {
  spaceId: string; parentId: string | null; topics: Topic[]; onClose: () => void;
}) {
  const { mutateAsync: create, isPending } = useCreateDocument();
  const [type, setType] = useState<DocType>("page");
  const [title, setTitle] = useState("");
  const [topicId, setTopicId] = useState<string>("");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Le titre est requis."); return; }
    try {
      await create({
        space_id: spaceId,
        parent_id: parentId,
        type,
        title: title.trim(),
        topic_id: topicId || null,
        content: type === "whiteboard" ? JSON.stringify({ notes: [] }) : "",
      });
      onClose();
    } catch {
      setError("Impossible de créer le document.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] shadow-2xl">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h2 className="text-base font-semibold text-[var(--text-strong)]">Créer un document</h2>
        </div>
        <form onSubmit={submit} className="space-y-4 p-6">
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

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Titre *</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 py-2.5 text-sm text-[var(--text-strong)] outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              placeholder="Titre du document…"
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

          {error && <p className="rounded-xl border border-danger-500/30 bg-danger-500/8 px-3 py-2 text-sm text-danger-500">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] px-4 py-2 text-sm font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-panel)]">
              Annuler
            </button>
            <button type="submit" disabled={isPending || !title.trim()} className="btn-primary disabled:opacity-60">
              {isPending ? "Création…" : "Créer"}
            </button>
          </div>
        </form>
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
          "flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition",
          isSelected
            ? "bg-brand-500/10 font-medium text-brand-500"
            : "text-[var(--text-muted)] hover:bg-[var(--bg-panel-2)] hover:text-[var(--text-strong)]",
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
        <span className="truncate text-xs">{node.icon ? `${node.icon} ` : ""}{node.title}</span>
        {isFolder && node.children.length > 0 && (
          <span className="ml-auto rounded bg-[var(--bg-panel)] px-1 py-0.5 text-[10px] text-[var(--text-muted)]">{node.children.length}</span>
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
  doc, topics, onRename, onDelete, onTopicChange,
}: {
  doc: Document; topics: Topic[];
  onRename: (title: string) => void;
  onDelete: () => void;
  onTopicChange: (topicId: string | null) => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleVal, setTitleVal] = useState(doc.title);
  const [menuOpen, setMenuOpen] = useState(false);
  const topic = topics.find((t) => t.id === doc.topic_id);
  const Icon = docTypeIcon(doc.type);

  return (
    <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] bg-[var(--bg-panel)] px-6 py-4">
      <div className="flex items-start gap-3 min-w-0">
        <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          {editingTitle ? (
            <input
              autoFocus
              value={titleVal}
              onChange={(e) => setTitleVal(e.target.value)}
              onBlur={() => { setEditingTitle(false); onRename(titleVal); }}
              onKeyDown={(e) => { if (e.key === "Enter") { setEditingTitle(false); onRename(titleVal); } if (e.key === "Escape") setEditingTitle(false); }}
              className="rounded border border-brand-500 bg-transparent px-1 text-lg font-bold text-[var(--text-strong)] outline-none"
            />
          ) : (
            <h2
              className="cursor-text text-lg font-bold text-[var(--text-strong)] hover:text-brand-500"
              onClick={() => { setEditingTitle(true); setTitleVal(doc.title); }}
            >
              {doc.icon && <span className="mr-1">{doc.icon}</span>}{doc.title}
            </h2>
          )}
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
            {topic && <span className="font-medium text-brand-500">● {topic.title}</span>}
            {doc.updated_at && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(doc.updated_at).toLocaleDateString("fr-FR")}</span>}
            {doc.tags.map((tag) => <span key={tag} className="rounded-full bg-[var(--bg-panel-2)] px-2 py-0.5 text-[10px]">#{tag}</span>)}
          </div>
        </div>
      </div>

      <div className="relative flex-shrink-0">
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] transition hover:bg-[var(--bg-panel-2)] hover:text-[var(--text-strong)]"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-9 z-30 min-w-[160px] rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] py-1 shadow-xl">
            <button onClick={() => { setEditingTitle(true); setTitleVal(doc.title); setMenuOpen(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[var(--text-strong)] transition hover:bg-[var(--bg-panel-2)]">
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
            <button onClick={() => { onDelete(); setMenuOpen(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-danger-500 transition hover:bg-danger-500/8">
              <Trash2 className="h-3.5 w-3.5" />Supprimer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Folder View ──────────────────────────────────────────────────────────────

function FolderView({ node, onSelect, spaceId, topics }: { node: TreeNode; onSelect: (id: string) => void; spaceId: string; topics: Topic[] }) {
  const [showCreate, setShowCreate] = useState(false);
  return (
    <div className="p-6">
      {showCreate && <CreateDocModal spaceId={spaceId} parentId={node.id} topics={topics} onClose={() => setShowCreate(false)} />}
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
              <button
                key={child.id}
                type="button"
                onClick={() => onSelect(child.id)}
                className="card flex items-start gap-3 p-4 text-left transition hover:border-brand-500/40"
              >
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--text-strong)]">{child.icon ? `${child.icon} ` : ""}{child.title}</p>
                  <p className="text-xs text-[var(--text-muted)] capitalize">{child.type}</p>
                  {child.updated_at && <p className="text-[10px] text-[var(--text-muted)]">{new Date(child.updated_at).toLocaleDateString("fr-FR")}</p>}
                </div>
              </button>
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
            <p className="mt-1 text-sm text-[var(--text-muted)]">Créez votre première page, whiteboard ou diagramme Mermaid.</p>
          </div>
          <button onClick={onCreateRoot} className="btn-primary">Créer le premier document</button>
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--text-strong)]">Récemment modifiés</h3>
            <button onClick={onCreateRoot} className="btn-primary"><Plus className="h-3.5 w-3.5" />Nouveau</button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((doc) => {
              const Icon = docTypeIcon(doc.type);
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => onSelect(doc.id)}
                  className="card flex items-start gap-3 p-4 text-left transition hover:border-brand-500/40"
                >
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--text-strong)]">{doc.icon ? `${doc.icon} ` : ""}{doc.title}</p>
                    <p className="text-[10px] text-[var(--text-muted)] capitalize">{doc.type}</p>
                    {doc.updated_at && (
                      <p className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                        <Clock className="h-2.5 w-2.5" />{new Date(doc.updated_at).toLocaleDateString("fr-FR")}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main DocumentsTab ────────────────────────────────────────────────────────

interface DocumentsTabProps {
  spaceId: string;
  topics: Topic[];
}

export function DocumentsTab({ spaceId, topics }: DocumentsTabProps) {
  const { data: docs = [], isLoading } = useDocuments({ spaceId });
  const { mutateAsync: update } = useUpdateDocument();
  const { mutateAsync: deleteDoc } = useDeleteDocument();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [topicFilter, setTopicFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"tree" | "list">("tree");
  const [showCreateRoot, setShowCreateRoot] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "pending" | "saved">("idle");
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

  return (
    <div className="flex h-[calc(100vh-220px)] min-h-[500px] overflow-hidden rounded-2xl border border-[var(--border)]">
      {showCreateRoot && <CreateDocModal spaceId={spaceId} parentId={null} topics={topics} onClose={() => setShowCreateRoot(false)} />}

      {/* ── Left Sidebar ────────────────────────────────────────── */}
      <aside className="flex w-[220px] min-w-[200px] flex-col border-r border-[var(--border)] bg-[var(--bg-panel)]">
        {/* Sidebar header */}
        <div className="border-b border-[var(--border)] p-3">
          <button
            onClick={() => setShowCreateRoot(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-brand-500/40 bg-brand-500/8 px-3 py-2 text-sm font-medium text-brand-500 transition hover:bg-brand-500/15"
          >
            <Plus className="h-4 w-4" />Nouveau
          </button>
        </div>

        {/* Search */}
        <div className="px-3 pt-2.5">
          <div className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-panel-2)] px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 flex-shrink-0 text-[var(--text-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher…"
              className="flex-1 bg-transparent text-xs text-[var(--text-strong)] outline-none placeholder:text-[var(--text-muted)]"
            />
          </div>
        </div>

        {/* Topic filter */}
        {topics.length > 0 && (
          <div className="px-3 pt-2">
            <select
              value={topicFilter}
              onChange={(e) => setTopicFilter(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-panel-2)] px-2 py-1.5 text-xs text-[var(--text-strong)] outline-none focus:border-brand-500"
            >
              <option value="all">Tous les topics</option>
              {topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
        )}

        {/* View mode toggle */}
        <div className="flex items-center gap-1 px-3 pb-1.5 pt-2">
          <button onClick={() => setViewMode("tree")} className={cn("flex h-6 w-6 items-center justify-center rounded transition", viewMode === "tree" ? "bg-brand-500/15 text-brand-500" : "text-[var(--text-muted)] hover:text-[var(--text-strong)]")}><Layers className="h-3.5 w-3.5" /></button>
          <button onClick={() => setViewMode("list")} className={cn("flex h-6 w-6 items-center justify-center rounded transition", viewMode === "list" ? "bg-brand-500/15 text-brand-500" : "text-[var(--text-muted)] hover:text-[var(--text-strong)]")}><List className="h-3.5 w-3.5" /></button>
          <span className="ml-auto text-[10px] text-[var(--text-muted)]">{filteredDocs.length} doc{filteredDocs.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Tree / List */}
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {isLoading ? (
            <div className="flex items-center gap-1.5 px-2 py-3 text-xs text-[var(--text-muted)]"><Loader2 className="h-3 w-3 animate-spin" />Chargement…</div>
          ) : filteredDocs.length === 0 ? (
            <p className="px-2 py-3 text-xs text-[var(--text-muted)]">Aucun document</p>
          ) : viewMode === "tree" ? (
            tree.map((node) => (
              <TreeItem
                key={node.id}
                node={node}
                selectedId={selectedId}
                expandedIds={expandedIds}
                onSelect={setSelectedId}
                onToggle={toggleExpanded}
                depth={0}
              />
            ))
          ) : (
            filteredDocs.map((doc) => {
              const Icon = docTypeIcon(doc.type);
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => setSelectedId(doc.id)}
                  className={cn(
                    "flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs transition",
                    selectedId === doc.id ? "bg-brand-500/10 font-medium text-brand-500" : "text-[var(--text-muted)] hover:bg-[var(--bg-panel-2)] hover:text-[var(--text-strong)]",
                  )}
                >
                  <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">{doc.title}</span>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────── */}
      <div className="relative flex min-w-0 flex-1 flex-col bg-[var(--bg-panel)]">
        {!selectedDoc ? (
          <HomeView docs={docs} onSelect={setSelectedId} spaceId={spaceId} topics={topics} onCreateRoot={() => setShowCreateRoot(true)} />
        ) : selectedDoc.type === "whiteboard" || selectedDoc.type === "mermaid" ? (
          /* Whiteboard & Mermaid: plein écran via portal */
          null
        ) : (
          <>
            {/* Document header */}
            <DocHeader
              doc={selectedDoc}
              topics={topics}
              onRename={handleRename}
              onDelete={handleDelete}
              onTopicChange={handleTopicChange}
            />

            {/* Auto-save status — fixed position, no layout shift */}
            <div className="pointer-events-none absolute right-4 top-16 z-20">
              {saveStatus === "pending" && (
                <span className="flex items-center gap-1 rounded-full bg-[var(--bg-panel-2)] px-2 py-1 text-[10px] text-[var(--text-muted)] shadow-sm">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />Enregistrement…
                </span>
              )}
              {saveStatus === "saved" && (
                <span className="flex items-center gap-1 rounded-full bg-[var(--bg-panel-2)] px-2 py-1 text-[10px] text-accent-500 shadow-sm">
                  <CheckCircle2 className="h-2.5 w-2.5" />Enregistré
                </span>
              )}
            </div>

            {/* Editor area */}
            <div className="flex-1 overflow-hidden">
              {selectedDoc.type === "folder" && selectedNode ? (
                <FolderView node={selectedNode} onSelect={setSelectedId} spaceId={spaceId} topics={topics} />
              ) : selectedDoc.type === "page" ? (
                <PageEditor content={selectedDoc.content} onChange={handleContentChange} />
              ) : (
                <div className="flex flex-col items-center gap-3 p-12 text-center">
                  <FileText className="h-10 w-10 text-[var(--text-muted)]" />
                  <p className="text-sm text-[var(--text-muted)]">Type de document non pris en charge.</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Mermaid plein écran ──────────────────────────────────── */}
      {selectedDoc?.type === "mermaid" && createPortal(
        <div className="fixed inset-0 z-[200] flex flex-col bg-[var(--bg-body)]">
          <div className="flex flex-shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-panel)] px-4 py-2 shadow-sm">
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
            <div className="ml-auto">
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
        <div className="fixed inset-0 z-[200] flex flex-col bg-[var(--bg-body)]">

          {/* Topbar plein écran */}
          <div className="flex flex-shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-panel)] px-4 py-2 shadow-sm">
            <button
              onClick={() => setSelectedId(null)}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 py-1.5 text-xs font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-panel-3)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />Retour
            </button>

            <div className="flex flex-col leading-none">
              <span className="text-[9px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Whiteboard</span>
              <span className="text-sm font-semibold text-[var(--text-strong)]">{selectedDoc.title}</span>
            </div>

            {/* Save indicator */}
            <div className="ml-auto">
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
            </div>
          </div>

          {/* Canvas plein écran */}
          <div className="flex-1 overflow-hidden">
            <WhiteboardEditor
              content={selectedDoc.content}
              onChange={handleContentChange}
            />
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
