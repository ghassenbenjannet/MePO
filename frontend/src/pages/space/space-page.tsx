import { useState } from "react";
import {
  ArrowRight,
  FileText,
  FolderKanban,
  FolderOpen,
  Loader2,
  MessageSquareText,
  Plus,
  Send,
  Sparkles,
  StickyNote,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useSpace } from "../../hooks/use-spaces";
import { useTopics, useCreateTopic } from "../../hooks/use-topics";
import { useTickets, useUpdateTicket } from "../../hooks/use-tickets";
import { useDocuments, useCreateDocument } from "../../hooks/use-documents";
import { cn } from "../../lib/utils";
import type { Topic, Ticket } from "../../types/domain";

// ─── Constants ────────────────────────────────────────────────────────────────
type TabId = "suivi" | "documents" | "chat";

const TABS = [
  { id: "suivi" as TabId,     label: "1 — Suivi",      icon: FolderKanban },
  { id: "documents" as TabId, label: "2 — Documents",  icon: FileText },
  { id: "chat" as TabId,      label: "3 — Let's Chat", icon: MessageSquareText },
];

const KANBAN_COLS = [
  { id: "backlog",     label: "Backlog",     color: "text-[var(--text-muted)]" },
  { id: "todo",        label: "À faire",     color: "text-brand-500" },
  { id: "in_progress", label: "En cours",    color: "text-warn-500" },
  { id: "review",      label: "Revue",       color: "text-purple-400" },
  { id: "done",        label: "Terminé",     color: "text-accent-500" },
  { id: "blocked",     label: "Bloqué",      color: "text-danger-500" },
] as const;

const priorityBadge = (p: string) =>
  p === "critical" ? "bg-danger-500/15 text-danger-500"
  : p === "high"   ? "bg-warn-500/15 text-warn-500"
  : p === "medium" ? "bg-brand-500/15 text-brand-500"
  :                  "bg-[var(--bg-panel-2)] text-[var(--text-muted)]";

const statusBadge = (s: string) =>
  s === "active"  ? "bg-accent-500/15 text-accent-500"
  : s === "blocked" ? "bg-danger-500/15 text-danger-500"
  :                   "bg-[var(--bg-panel-2)] text-[var(--text-muted)]";

// ─── Suivi tab ────────────────────────────────────────────────────────────────
function SuiviTab({ projectId, spaceId, topics, tickets, loadingTickets }: {
  projectId: string;
  spaceId: string;
  topics: Topic[];
  tickets: Ticket[];
  loadingTickets: boolean;
}) {
  const { mutateAsync: updateTicket } = useUpdateTicket();
  const [newTopicTitle, setNewTopicTitle] = useState("");
  const { mutateAsync: createTopic, isPending: creatingTopic } = useCreateTopic();

  async function handleCreateTopic(e: React.FormEvent) {
    e.preventDefault();
    if (!newTopicTitle.trim()) return;
    await createTopic({ space_id: spaceId, title: newTopicTitle });
    setNewTopicTitle("");
  }

  return (
    <div className="space-y-5">
      {/* Topics bar */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold text-[var(--text-strong)]">
            Sujets (topics){" "}
            <span className="ml-1 rounded bg-[var(--bg-panel-2)] px-1.5 py-0.5 text-xs text-[var(--text-muted)]">
              {topics.length}
            </span>
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {topics.map((t) => (
            <Link
              key={t.id}
              to={`/projects/${projectId}/spaces/${spaceId}/topics/${t.id}`}
              className="group flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] px-3 py-2 text-sm transition hover:border-brand-500/50"
            >
              <span className={cn("badge capitalize", statusBadge(t.status))}>{t.status}</span>
              <span className="font-medium text-[var(--text-strong)]">{t.title}</span>
              <span className={cn("badge capitalize", priorityBadge(t.priority))}>{t.priority}</span>
              <ArrowRight className="h-3 w-3 text-[var(--text-muted)] opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
            </Link>
          ))}
          {/* Quick add topic */}
          <form onSubmit={handleCreateTopic} className="flex items-center gap-1">
            <input
              value={newTopicTitle}
              onChange={(e) => setNewTopicTitle(e.target.value)}
              placeholder="+ Nouveau topic…"
              className="h-9 rounded-lg border border-dashed border-[var(--border)] bg-transparent px-3 text-sm text-[var(--text-muted)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-brand-500 focus:text-[var(--text-strong)] focus:ring-1 focus:ring-brand-500/20 w-44"
            />
            {newTopicTitle && (
              <button type="submit" disabled={creatingTopic} className="btn-primary h-9 px-2">
                {creatingTopic ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              </button>
            )}
          </form>
        </div>
      </div>

      {/* Kanban board */}
      <div>
        <h2 className="mb-3 text-sm font-bold text-[var(--text-strong)]">Kanban</h2>
        {loadingTickets ? (
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement des tickets…
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-3">
            {KANBAN_COLS.map((col) => {
              const colTickets = tickets.filter((t) => t.status === col.id);
              return (
                <div key={col.id} className="w-60 flex-shrink-0">
                  {/* Column header */}
                  <div className="mb-2 flex items-center justify-between px-1">
                    <span className={cn("text-xs font-semibold uppercase tracking-wider", col.color)}>
                      {col.label}
                    </span>
                    <span className="rounded bg-[var(--bg-panel-2)] px-1.5 py-0.5 text-xs text-[var(--text-muted)]">
                      {colTickets.length}
                    </span>
                  </div>
                  {/* Cards */}
                  <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--bg-panel-2)] p-2 min-h-[80px]">
                    {colTickets.map((ticket) => (
                      <div
                        key={ticket.id}
                        className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-3 transition hover:border-brand-500/40 hover:shadow-panel cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono text-[10px] text-[var(--text-muted)]">{ticket.id}</span>
                          <span className={cn("badge capitalize text-[10px]", priorityBadge(ticket.priority))}>
                            {ticket.priority}
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs font-medium leading-4 text-[var(--text-strong)]">
                          {ticket.title}
                        </p>
                        <div className="mt-2 flex items-center gap-1">
                          <span className="badge bg-[var(--bg-panel-2)] text-[10px] capitalize text-[var(--text-muted)]">
                            {ticket.type}
                          </span>
                          {ticket.assignee && (
                            <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-[9px] font-bold text-white">
                              {ticket.assignee.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    {colTickets.length === 0 && (
                      <div className="flex items-center justify-center py-3 text-xs text-[var(--text-muted)]">
                        Vide
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Backlog table */}
      {tickets.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-bold text-[var(--text-strong)]">
            Backlog complet{" "}
            <span className="ml-1 rounded bg-[var(--bg-panel-2)] px-1.5 py-0.5 text-xs text-[var(--text-muted)]">
              {tickets.length}
            </span>
          </h2>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {["ID", "Type", "Titre", "Statut", "Priorité", "Assigné"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--text-muted)]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-panel-2)]">
                    <td className="px-4 py-2.5 font-mono text-xs text-[var(--text-muted)]">{t.id}</td>
                    <td className="px-4 py-2.5">
                      <span className="badge bg-[var(--bg-panel-2)] capitalize text-[var(--text-muted)]">{t.type}</span>
                    </td>
                    <td className="px-4 py-2.5 font-medium text-[var(--text-strong)]">{t.title}</td>
                    <td className="px-4 py-2.5">
                      <select
                        value={t.status}
                        onChange={(e) => updateTicket({ id: t.id, status: e.target.value })}
                        className="rounded border border-[var(--border)] bg-[var(--bg-panel-2)] px-2 py-0.5 text-xs text-[var(--text-strong)] outline-none"
                      >
                        {KANBAN_COLS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={cn("badge capitalize", priorityBadge(t.priority))}>{t.priority}</span>
                    </td>
                    <td className="px-4 py-2.5 text-[var(--text-muted)]">{t.assignee ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Documents tab ────────────────────────────────────────────────────────────
function DocumentsTab({ spaceId, topics }: { spaceId: string; topics: Topic[] }) {
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [newDocTitle, setNewDocTitle] = useState("");
  const { data: docs = [], isLoading } = useDocuments({ spaceId, topicId: selectedTopic ?? undefined });
  const { mutateAsync: createDoc, isPending: creating } = useCreateDocument();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newDocTitle.trim()) return;
    await createDoc({ space_id: spaceId, topic_id: selectedTopic, title: newDocTitle });
    setNewDocTitle("");
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[220px_1fr]">
      {/* Folder tree */}
      <div className="card p-3">
        <p className="section-title mb-2 px-2">Répertoires</p>
        <div className="space-y-0.5">
          <button
            onClick={() => setSelectedTopic(null)}
            className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition",
              !selectedTopic ? "bg-brand-500/10 font-medium text-brand-500" : "text-[var(--text-muted)] hover:bg-[var(--bg-panel-2)] hover:text-[var(--text-strong)]")}
          >
            <FolderOpen className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">Tous les documents</span>
          </button>
          {topics.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTopic(t.id)}
              className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition",
                selectedTopic === t.id ? "bg-brand-500/10 font-medium text-brand-500" : "text-[var(--text-muted)] hover:bg-[var(--bg-panel-2)] hover:text-[var(--text-strong)]")}
            >
              <FolderOpen className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{t.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Document list */}
      <div className="card p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-[var(--text-strong)]">Documents</h3>
          <form onSubmit={handleCreate} className="flex gap-2">
            <input
              value={newDocTitle}
              onChange={(e) => setNewDocTitle(e.target.value)}
              placeholder="Titre de la page…"
              className="input h-8 w-52 text-xs"
            />
            <button type="submit" disabled={creating || !newDocTitle.trim()} className="btn-primary h-8">
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Nouvelle page
            </button>
          </form>
        </div>

        {isLoading && <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>}

        {!isLoading && docs.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-[var(--border)] py-10 text-center">
            <FileText className="h-7 w-7 text-[var(--text-muted)]" />
            <div>
              <p className="font-medium text-[var(--text-strong)]">Aucun document</p>
              <p className="text-xs text-[var(--text-muted)]">Crée ta première page ci-dessus</p>
            </div>
          </div>
        )}

        <div className="space-y-1">
          {docs.map((doc) => (
            <div key={doc.id}
              className="group flex cursor-pointer items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 py-2.5 transition hover:border-brand-500/40 hover:bg-[var(--bg-panel)]"
            >
              <div className="flex items-center gap-2.5">
                <StickyNote className="h-4 w-4 flex-shrink-0 text-brand-500" />
                <div>
                  <p className="text-sm font-medium text-[var(--text-strong)]">{doc.title}</p>
                  {doc.updated_at && (
                    <p className="text-xs text-[var(--text-muted)]">
                      Mis à jour {new Date(doc.updated_at).toLocaleDateString("fr-FR")}
                    </p>
                  )}
                </div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-[var(--text-muted)] opacity-0 transition group-hover:opacity-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Chat tab ─────────────────────────────────────────────────────────────────
const SUGGESTIONS = [
  "Résume le backlog de cet espace",
  "Génère un ticket pour un sujet",
  "Analyse les tickets bloqués",
  "Crée un plan de recette",
  "Mets à jour la mémoire topic",
];

function ChatTab({ spaceName, topics, tickets }: { spaceName: string; topics: Topic[]; tickets: Ticket[] }) {
  const [input, setInput] = useState("");

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
      {/* Chat */}
      <div className="card flex flex-col overflow-hidden">
        {/* Messages */}
        <div className="flex-1 space-y-4 p-5" style={{ minHeight: 380 }}>
          {/* Welcome */}
          <div className="flex gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 text-xs font-bold text-white">
              SP
            </div>
            <div className="max-w-lg rounded-xl rounded-tl-none bg-[var(--bg-panel-2)] px-4 py-3">
              <p className="text-xs font-semibold text-brand-500">Shadow PO</p>
              <p className="mt-1 text-sm leading-6 text-[var(--text-strong)]">
                Bonjour ! Je suis prêt à t'assister sur l'espace <strong>{spaceName}</strong>.
                J'ai accès à <strong>{tickets.length} tickets</strong> et <strong>{topics.length} topics</strong>.
                Que veux-tu accomplir ?
              </p>
            </div>
          </div>
          {/* Chips */}
          <div className="flex flex-wrap gap-2 pl-11">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setInput(s)}
                className="rounded-full border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 py-1 text-xs text-[var(--text-muted)] transition hover:border-brand-500/50 hover:text-brand-500"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        {/* Input */}
        <div className="border-t border-[var(--border)] p-3">
          <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 py-2 transition focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Dis-moi ce que tu veux créer ou analyser…"
              className="flex-1 bg-transparent text-sm text-[var(--text-strong)] outline-none placeholder:text-[var(--text-muted)]"
            />
            <button disabled={!input.trim()} className="btn-primary disabled:opacity-40">
              <Send className="h-3.5 w-3.5" />
              Envoyer
            </button>
          </div>
          <p className="mt-1.5 text-center text-xs text-[var(--text-muted)]">
            Shadow PO reconstruit le contexte et l'envoie à ChatGPT avec ton skill Shadow PO.
          </p>
        </div>
      </div>

      {/* Context panel */}
      <div className="space-y-3">
        <div className="card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-500" />
            <p className="text-sm font-bold text-[var(--text-strong)]">Contexte actif</p>
          </div>
          <div className="space-y-3">
            {[
              { label: "Espace", value: spaceName },
              { label: "Topics", value: `${topics.length} actifs` },
              { label: "Tickets", value: `${tickets.length} total` },
            ].map((row) => (
              <div key={row.label}>
                <p className="section-title">{row.label}</p>
                <p className="mt-0.5 text-sm font-medium text-[var(--text-strong)]">{row.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card border-brand-500/20 bg-brand-500/5 p-4">
          <p className="text-xs font-bold text-brand-500">Shadow Core</p>
          <p className="mt-1.5 text-xs leading-5 text-[var(--text-muted)]">
            Source unique de vérité. Reconstruit le contexte à chaque requête.
            ChatGPT agit comme moteur d'analyse et de génération.
          </p>
        </div>

        <div className="card p-3">
          <p className="section-title mb-2">Actions rapides</p>
          {["Créer un ticket", "Nouvelle page", "Enregistrer artefact", "Màj mémoire topic"].map((a) => (
            <button key={a} className="btn-ghost w-full justify-start text-left">
              <Plus className="h-3.5 w-3.5 flex-shrink-0" />{a}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export function SpacePage() {
  const { projectId, spaceId } = useParams<{ projectId: string; spaceId: string }>();
  const [activeTab, setActiveTab] = useState<TabId>("suivi");

  const { data: space } = useSpace(spaceId);
  const { data: topics = [] } = useTopics(spaceId);
  const { data: tickets = [], isLoading: loadingTickets } = useTickets({ spaceId });

  const spaceName = space?.name ?? "Espace";

  return (
    <div className="mx-auto max-w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="section-title">Espace</p>
          <h1 className="mt-0.5 text-xl font-bold text-[var(--text-strong)]">{spaceName}</h1>
          {space?.description && (
            <p className="mt-0.5 text-sm text-[var(--text-muted)]">{space.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary">
            <Plus className="h-4 w-4" />
            Nouveau ticket
          </button>
          <button onClick={() => setActiveTab("chat")} className="btn-primary">
            <Sparkles className="h-4 w-4" />
            Let's Chat
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-[var(--border)]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition",
              activeTab === tab.id
                ? "border-brand-500 text-brand-500"
                : "border-transparent text-[var(--text-muted)] hover:border-[var(--border)] hover:text-[var(--text-strong)]",
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "suivi" && (
          <SuiviTab
            projectId={projectId!}
            spaceId={spaceId!}
            topics={topics}
            tickets={tickets}
            loadingTickets={loadingTickets}
          />
        )}
        {activeTab === "documents" && (
          <DocumentsTab spaceId={spaceId!} topics={topics} />
        )}
        {activeTab === "chat" && (
          <ChatTab spaceName={spaceName} topics={topics} tickets={tickets} />
        )}
      </div>
    </div>
  );
}
