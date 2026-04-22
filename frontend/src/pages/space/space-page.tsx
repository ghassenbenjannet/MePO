import type { Dispatch, SetStateAction } from "react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  FileText,
  FolderKanban,
  Layers,
  Map,
  MessageSquareText,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Table2,
} from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { KanbanPage } from "../../components/kanban/kanban-page";
import { TicketModal as SharedTicketModal } from "../../components/tickets/ticket-modal";
import { SpaceOverviewHeader } from "../../components/space/space-overview-header";
import { SpaceSuiviTabs } from "../../components/space/space-suivi-tabs";
import { MiniTiptap, linesToTiptapHtml, textToTiptapHtml, tiptapHtmlToLines, tiptapHtmlToText } from "../../components/ui/mini-tiptap";
import { RowSkeleton } from "../../components/ui/skeleton";
import { StatCard } from "../../components/ui/stat-card";
import { useDocuments } from "../../hooks/use-documents";
import { useProjects } from "../../hooks/use-projects";
import { useSpaces } from "../../hooks/use-spaces";
import { useCreateTicket, useTickets, useUpdateTicket } from "../../hooks/use-tickets";
import { useCreateTopic, useTopics, useUpdateTopic } from "../../hooks/use-topics";
import {
  type SpaceSuiviView,
  isLegacyEntitySlug,
  isSpaceSuiviView,
  resolveEntityBySlug,
  spaceChatPath,
  spaceDocumentsPath,
  spaceSuiviPath,
  topicPath,
} from "../../lib/routes";
import { cn } from "../../lib/utils";
import { useUiStore } from "../../stores/ui-store";
import type { Document, Ticket, Topic } from "../../types/domain";

// ─── Types ───────────────────────────────────────────────────────────────────

type SuiviSubTabId = SpaceSuiviView;

type TicketPatternForm = {
  object_under_test: string;
  behavior_observed: string;
  expected_behavior: string;
  reproduction_steps: string;
  environment: string;
  severity: string;
  impact: string;
  business_need: string;
  objective: string;
  business_rules: string;
  scope: string;
  out_of_scope: string;
  risks: string;
  open_points: string;
  operational_goal: string;
  task_to_do: string;
  prerequisites: string;
  expected_result: string;
  definition_of_done: string;
  subject_to_analyze: string;
  problem: string;
  hypotheses: string;
  known_elements: string;
  unknowns: string;
  points_to_investigate: string;
  stakeholders: string;
  expected_decision: string;
  expected_deliverable: string;
  test_scope: string;
  scenarios: string;
  expected_results: string;
  test_data: string;
  test_status: string;
  raised_issues: string;
};


// ─── Constants ───────────────────────────────────────────────────────────────

const KANBAN_COLS = [
  { id: "backlog", label: "Backlog", color: "text-[var(--text-muted)]", dot: "bg-[var(--text-muted)]" },
  { id: "todo", label: "À faire", color: "text-sky-600", dot: "bg-sky-500" },
  { id: "in_progress", label: "En cours", color: "text-amber-600", dot: "bg-amber-500" },
  { id: "review", label: "Revue", color: "text-orange-600", dot: "bg-orange-500" },
  { id: "done", label: "Terminé", color: "text-brand-600", dot: "bg-brand-400" },
  { id: "blocked", label: "Bloqué", color: "text-danger-500", dot: "bg-danger-500" },
] as const;

const TOPIC_NATURES = [
  { value: "study", label: "Étude / Conception" },
  { value: "delivery", label: "Développement" },
  { value: "study_delivery", label: "Étude + Développement" },
];

const TICKET_TYPES = [
  { value: "feature", label: "Feature / Évolution" },
  { value: "bug", label: "Bug" },
  { value: "task", label: "Task" },
  { value: "analysis", label: "Étude / Analyse" },
  { value: "test", label: "Recette / Test" },
];

const PRIORITIES = ["low", "medium", "high", "critical"];

const TOPIC_COLOR_STYLES: Record<string, string> = {
  indigo: "bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-900/20 dark:text-brand-200 dark:border-brand-800",
  blue: "bg-brand-100 text-brand-800 border-brand-200 dark:bg-brand-900/25 dark:text-brand-100 dark:border-brand-800",
  emerald: "bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-900/20 dark:text-brand-200 dark:border-brand-800",
  amber: "bg-brand-100 text-brand-800 border-brand-200 dark:bg-brand-900/25 dark:text-brand-100 dark:border-brand-800",
  rose: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
  violet: "bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-900/20 dark:text-brand-200 dark:border-brand-800",
  cyan: "bg-brand-100 text-brand-800 border-brand-200 dark:bg-brand-900/25 dark:text-brand-100 dark:border-brand-800",
  orange: "bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-900/20 dark:text-brand-200 dark:border-brand-800",
  lime: "bg-brand-100 text-brand-800 border-brand-200 dark:bg-brand-900/25 dark:text-brand-100 dark:border-brand-800",
  slate: "bg-[var(--bg-panel-2)] text-[var(--text-strong)] border-[var(--border)]",
};

const TOPIC_COLOR_DOT: Record<string, string> = {
  indigo: "bg-brand-500",
  blue: "bg-brand-400",
  emerald: "bg-brand-500",
  amber: "bg-brand-400",
  rose: "bg-rose-500",
  violet: "bg-brand-500",
  cyan: "bg-brand-400",
  orange: "bg-brand-500",
  lime: "bg-brand-400",
  slate: "bg-[var(--text-muted)]",
};

const TOPIC_COLOR_OPTIONS = Object.keys(TOPIC_COLOR_STYLES);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function topicColorClass(color: string) {
  return TOPIC_COLOR_STYLES[color] ?? TOPIC_COLOR_STYLES.indigo;
}

function topicColorDot(color: string) {
  return TOPIC_COLOR_DOT[color] ?? TOPIC_COLOR_DOT.indigo;
}

function topicNatureLabel(nature: string) {
  return TOPIC_NATURES.find((item) => item.value === nature)?.label ?? "Étude + Développement";
}

function ticketTypeLabel(type: string) {
  return TICKET_TYPES.find((item) => item.value === type)?.label ?? "Task";
}

function priorityBadge(priority: string) {
  if (priority === "critical") return "bg-danger-500/15 text-danger-500";
  if (priority === "high") return "bg-warn-500/15 text-warn-500";
  if (priority === "medium") return "bg-brand-500/15 text-brand-500";
  return "bg-[var(--bg-panel-2)] text-[var(--text-muted)]";
}

function topicStatusBadge(status: string) {
  if (status === "active") return "bg-brand-500/15 text-brand-700";
  if (status === "blocked") return "bg-danger-500/15 text-danger-500";
  if (status === "done") return "bg-brand-100 text-brand-800";
  return "bg-[var(--bg-panel-2)] text-[var(--text-muted)]";
}

function buildDefaultPatternForm(): TicketPatternForm {
  return {
    object_under_test: "",
    behavior_observed: "",
    expected_behavior: "",
    reproduction_steps: "",
    environment: "",
    severity: "",
    impact: "",
    business_need: "",
    objective: "",
    business_rules: "",
    scope: "",
    out_of_scope: "",
    risks: "",
    open_points: "",
    operational_goal: "",
    task_to_do: "",
    prerequisites: "",
    expected_result: "",
    definition_of_done: "",
    subject_to_analyze: "",
    problem: "",
    hypotheses: "",
    known_elements: "",
    unknowns: "",
    points_to_investigate: "",
    stakeholders: "",
    expected_decision: "",
    expected_deliverable: "",
    test_scope: "",
    scenarios: "",
    expected_results: "",
    test_data: "",
    test_status: "",
    raised_issues: "",
  };
}

function readPatternForm(details: Record<string, unknown> | undefined): TicketPatternForm {
  const defaults = buildDefaultPatternForm();
  if (!details) return defaults;
  return Object.fromEntries(
    Object.keys(defaults).map((key) => [key, typeof details[key] === "string" ? String(details[key]) : ""]),
  ) as TicketPatternForm;
}

function textAreaValueToList(value: string) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

function formatBacklogDate(value: string | null) {
  if (!value) return "Aucune date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date inconnue";
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function ticketPriorityRank(priority: string) {
  if (priority === "critical") return 4;
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  if (priority === "low") return 1;
  return 0;
}

// ─── Shared input/select styles ───────────────────────────────────────────────

const fieldCls = "w-full rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] px-3 py-2.5 text-sm text-[var(--text-strong)] outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";

// ─── Topic Modal ──────────────────────────────────────────────────────────────

function TopicModal({ spaceId, topic, onClose }: { spaceId: string; topic?: Topic; onClose: () => void }) {
  const { mutateAsync: createTopic, isPending: creating } = useCreateTopic();
  const { mutateAsync: updateTopic, isPending: updating } = useUpdateTopic();
  const [title, setTitle] = useState(topic?.title ?? "");
  const [description, setDescription] = useState(topic?.description ?? "");
  const [status, setStatus] = useState(topic?.status ?? "active");
  const [priority, setPriority] = useState(topic?.priority ?? "medium");
  const [nature, setNature] = useState(topic?.topic_nature ?? "study_delivery");
  const [color, setColor] = useState(topic?.color ?? "indigo");
  const [owner, setOwner] = useState(topic?.owner ?? "");
  const [roadmapStartDate, setRoadmapStartDate] = useState(topic?.roadmap_start_date ?? "");
  const [roadmapEndDate, setRoadmapEndDate] = useState(topic?.roadmap_end_date ?? "");
  const [risks, setRisks] = useState((topic?.risks ?? []).join("\n"));
  const [dependencies, setDependencies] = useState((topic?.dependencies ?? []).join("\n"));
  const [openQuestions, setOpenQuestions] = useState((topic?.open_questions ?? []).join("\n"));
  const [tags, setTags] = useState((topic?.tags ?? []).join(", "));
  const [errorMessage, setErrorMessage] = useState("");
  const isPending = creating || updating;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage("");
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      status, priority,
      topic_nature: nature, color,
      owner: owner.trim() || null,
      roadmap_start_date: roadmapStartDate || null,
      roadmap_end_date: roadmapEndDate || null,
      risks: textAreaValueToList(risks),
      dependencies: textAreaValueToList(dependencies),
      open_questions: textAreaValueToList(openQuestions),
      tags: tags.split(",").map((item) => item.trim()).filter(Boolean),
    };
    try {
      if (topic) await updateTopic({ id: topic.id, ...payload });
      else await createTopic({ space_id: spaceId, ...payload });
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Impossible d'enregistrer le topic.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[var(--overlay)] p-4 backdrop-blur-sm">
      <div className="flex min-h-full items-start justify-center py-6">
        <div className="max-h-[calc(100vh-3rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] shadow-2xl">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-panel)] px-6 py-4">
            <h2 className="text-base font-semibold text-[var(--text-strong)]">{topic ? "Modifier le topic" : "Créer un topic"}</h2>
            <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-[var(--text-muted)] transition hover:bg-[var(--bg-panel-2)] hover:text-[var(--text-strong)]">Fermer</button>
          </div>
          <form onSubmit={submit} className="space-y-4 p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Titre *</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className={fieldCls} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Nature</label>
                <select value={nature} onChange={(e) => setNature(e.target.value)} className={fieldCls}>
                  {TOPIC_NATURES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Couleur</label>
              <div className="flex flex-wrap gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] p-3">
                {TOPIC_COLOR_OPTIONS.map((option) => (
                  <button key={option} type="button" onClick={() => setColor(option)}
                    className={cn("rounded-full border px-3 py-1 text-xs font-semibold transition", topicColorClass(option), color === option ? "ring-2 ring-brand-500" : "opacity-70 hover:opacity-100")}>
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Statut</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className={fieldCls}>
                  <option value="active">Actif</option>
                  <option value="blocked">Bloqué</option>
                  <option value="done">Terminé</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Priorité</label>
                <select value={priority} onChange={(e) => setPriority(e.target.value)} className={fieldCls}>
                  {PRIORITIES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Owner</label>
                <input value={owner} onChange={(e) => setOwner(e.target.value)} className={fieldCls} />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={cn(fieldCls, "resize-none")} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Roadmap début</label>
                <input type="date" value={roadmapStartDate} onChange={(e) => setRoadmapStartDate(e.target.value)} className={fieldCls} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Roadmap fin</label>
                <input type="date" value={roadmapEndDate} onChange={(e) => setRoadmapEndDate(e.target.value)} className={fieldCls} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Risques (un par ligne)</label>
                <textarea value={risks} onChange={(e) => setRisks(e.target.value)} rows={4} className={cn(fieldCls, "resize-none")} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Questions ouvertes (une par ligne)</label>
                <textarea value={openQuestions} onChange={(e) => setOpenQuestions(e.target.value)} rows={4} className={cn(fieldCls, "resize-none")} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Dépendances (une par ligne)</label>
                <textarea value={dependencies} onChange={(e) => setDependencies(e.target.value)} rows={4} className={cn(fieldCls, "resize-none")} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Tags (séparés par virgule)</label>
                <textarea value={tags} onChange={(e) => setTags(e.target.value)} rows={4} placeholder="auth, api, mobile" className={cn(fieldCls, "resize-none")} />
              </div>
            </div>
            {errorMessage ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div> : null}
            <div className="sticky bottom-0 -mx-6 -mb-6 flex justify-end gap-3 border-t border-[var(--border)] bg-[var(--bg-panel)] px-6 py-4">
              <button type="button" onClick={onClose} className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] px-4 py-2 text-sm font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-panel)]">Annuler</button>
              <button type="submit" disabled={isPending || !title.trim()} className="btn-primary disabled:opacity-60">
                {isPending ? "Enregistrement..." : topic ? "Enregistrer" : "Créer le topic"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Ticket Pattern Fields ────────────────────────────────────────────────────

function TicketPatternFields({ type, form, setForm }: { type: string; form: TicketPatternForm; setForm: Dispatch<SetStateAction<TicketPatternForm>> }) {
  function updateField(field: keyof TicketPatternForm, value: string) {
    setForm((s) => ({ ...s, [field]: value }));
  }
  function ta(field: keyof TicketPatternForm, label: string) {
    return (
      <div key={field}>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{label}</label>
        <textarea value={form[field]} onChange={(e) => updateField(field, e.target.value)} rows={3} className={cn(fieldCls, "resize-none")} />
      </div>
    );
  }
  if (type === "bug") return <div className="space-y-4">{ta("object_under_test","Contexte / module")}{ta("environment","Environnement")}{ta("behavior_observed","Comportement observé")}{ta("expected_behavior","Comportement attendu")}{ta("reproduction_steps","Étapes de reproduction")}{ta("severity","Sévérité")}{ta("impact","Impact")}</div>;
  if (type === "feature") return <div className="space-y-4">{ta("business_need","Besoin métier")}{ta("objective","Objectif")}{ta("business_rules","Règles métier")}{ta("scope","Périmètre")}{ta("out_of_scope","Hors périmètre")}{ta("risks","Risques")}{ta("open_points","Points ouverts")}</div>;
  if (type === "analysis") return <div className="space-y-4">{ta("subject_to_analyze","Sujet à analyser")}{ta("problem","Problème / question")}{ta("hypotheses","Hypothèses")}{ta("known_elements","Éléments connus")}{ta("unknowns","Zones floues")}{ta("points_to_investigate","Points à investiguer")}{ta("stakeholders","Parties prenantes")}{ta("expected_decision","Décision attendue")}{ta("expected_deliverable","Livrable attendu")}</div>;
  if (type === "test") return <div className="space-y-4">{ta("object_under_test","Objet testé")}{ta("test_scope","Périmètre de test")}{ta("prerequisites","Prérequis")}{ta("scenarios","Scénarios")}{ta("expected_results","Résultats attendus")}{ta("test_data","Données de test")}{ta("test_status","Statut recette")}{ta("raised_issues","Anomalies remontées")}</div>;
  return <div className="space-y-4">{ta("operational_goal","Objectif opérationnel")}{ta("task_to_do","Tâche à réaliser")}{ta("prerequisites","Prérequis")}{ta("expected_result","Résultat attendu")}{ta("definition_of_done","Définition de fini")}</div>;
}

// ─── Ticket Modal ─────────────────────────────────────────────────────────────

function TicketModal({
  topics,
  documents,
  ticket,
  defaultTopicId,
  defaultStatus,
  onClose,
}: {
  topics: Topic[];
  documents: Document[];
  ticket?: Ticket;
  defaultTopicId?: string;
  defaultStatus?: string;
  onClose: () => void;
}) {
  const { mutateAsync: createTicket, isPending: creating } = useCreateTicket();
  const { mutateAsync: updateTicket, isPending: updating } = useUpdateTicket();
  const [topicId, setTopicId] = useState(ticket?.topic_id ?? defaultTopicId ?? topics[0]?.id ?? "");
  const [type, setType] = useState(ticket?.type ?? "feature");
  const [title, setTitle] = useState(ticket?.title ?? "");
  // Rich-text fields stored as Tiptap HTML
  const [descriptionHtml, setDescriptionHtml] = useState(() => textToTiptapHtml(ticket?.description ?? ""));
  const [criteriaHtml, setCriteriaHtml] = useState(() => linesToTiptapHtml(ticket?.acceptance_criteria ?? []));
  const [dependenciesHtml, setDependenciesHtml] = useState(() => linesToTiptapHtml(ticket?.dependencies ?? []));
  const [status, setStatus] = useState(ticket?.status ?? defaultStatus ?? "backlog");
  const [priority, setPriority] = useState(ticket?.priority ?? "medium");
  const [assignee, setAssignee] = useState(ticket?.assignee ?? "");
  const [reporter, setReporter] = useState(ticket?.reporter ?? "");
  const [tags, setTags] = useState((ticket?.tags ?? []).join(", "));
  const [dueDate, setDueDate] = useState(ticket?.due_date ?? "");
  const [estimate, setEstimate] = useState(ticket?.estimate?.toString() ?? "");
  const [linkedDocumentIds, setLinkedDocumentIds] = useState<string[]>(ticket?.linked_document_ids ?? []);
  const [patternForm, setPatternForm] = useState(readPatternForm(ticket?.ticket_details));
  const [errorMessage, setErrorMessage] = useState("");
  const isPending = creating || updating;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage("");
    const payload = {
      topic_id: topicId, type,
      title: title.trim(),
      description: tiptapHtmlToText(descriptionHtml) || null,
      status, priority,
      assignee: assignee.trim() || null,
      reporter: reporter.trim() || null,
      tags: tags.split(",").map((item) => item.trim()).filter(Boolean),
      acceptance_criteria: tiptapHtmlToLines(criteriaHtml),
      due_date: dueDate || null,
      estimate: estimate ? Number(estimate) : null,
      dependencies: tiptapHtmlToLines(dependenciesHtml),
      linked_document_ids: linkedDocumentIds,
      ticket_details: patternForm,
    };
    try {
      if (ticket) await updateTicket({ id: ticket.id, ...payload });
      else await createTicket(payload);
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Impossible d'enregistrer le ticket.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] shadow-2xl">
        {/* ── Header ── */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-panel)] px-6 py-4">
          <h2 className="text-base font-semibold text-[var(--text-strong)]">{ticket ? "Modifier le ticket" : "Créer un ticket"}</h2>
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-[var(--text-muted)] transition hover:bg-[var(--bg-panel-2)]">Fermer</button>
        </div>

        <form onSubmit={submit} className="p-6">
          <div className="grid grid-cols-[1fr_300px] gap-6 items-start">

            {/* ── Left: main fields ── */}
            <div className="space-y-5">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Titre *</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className={fieldCls} />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Description</label>
                <MiniTiptap
                  content={descriptionHtml}
                  onChange={setDescriptionHtml}
                  placeholder="Décrivez le ticket…"
                  minHeight="120px"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Critères d'acceptation</label>
                <MiniTiptap
                  content={criteriaHtml}
                  onChange={setCriteriaHtml}
                  placeholder="Un critère par item de liste…"
                  minHeight="100px"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Dépendances</label>
                <MiniTiptap
                  content={dependenciesHtml}
                  onChange={setDependenciesHtml}
                  placeholder="Une dépendance par item de liste…"
                  minHeight="80px"
                />
              </div>

              {errorMessage && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={onClose} className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] px-4 py-2 text-sm font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-panel)]">Annuler</button>
                <button type="submit" disabled={isPending || !title.trim() || !topicId} className="btn-primary disabled:opacity-60">
                  {isPending ? "Enregistrement..." : ticket ? "Enregistrer" : "Créer le ticket"}
                </button>
              </div>
            </div>

            {/* ── Right sidebar ── */}
            <div className="space-y-4">
              {/* Configuration */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] p-4 space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Configuration</p>
                <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Type</label><select value={type} onChange={(e) => setType(e.target.value)} className={fieldCls}>{TICKET_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
                <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Topic *</label><select value={topicId} onChange={(e) => setTopicId(e.target.value)} className={fieldCls}>{topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select></div>
                <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Statut</label><select value={status} onChange={(e) => setStatus(e.target.value)} className={fieldCls}>{KANBAN_COLS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
                <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Priorité</label><select value={priority} onChange={(e) => setPriority(e.target.value)} className={fieldCls}>{PRIORITIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
                <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Assigné à</label><input value={assignee} onChange={(e) => setAssignee(e.target.value)} className={fieldCls} /></div>
                <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Reporter</label><input value={reporter} onChange={(e) => setReporter(e.target.value)} className={fieldCls} /></div>
                <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Échéance</label><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={fieldCls} /></div>
                <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Estimation (j)</label><input type="number" step="0.5" value={estimate} onChange={(e) => setEstimate(e.target.value)} className={fieldCls} /></div>
                <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Tags</label><input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="tag1, tag2" className={fieldCls} /></div>
              </div>

              {/* Pattern du ticket */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Pattern du ticket</p>
                <p className="mt-0.5 mb-3 text-xs text-[var(--text-muted)]">Champs adaptés au type sélectionné.</p>
                <TicketPatternFields type={type} form={patternForm} setForm={setPatternForm} />
              </div>

              {/* Documentation liée */}
              {documents.length > 0 && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Documentation liée</p>
                  <div className="space-y-2">
                    {documents.map((doc) => (
                      <label key={doc.id} className="flex items-start gap-2">
                        <input type="checkbox" checked={linkedDocumentIds.includes(doc.id)} onChange={(e) => setLinkedDocumentIds((s) => e.target.checked ? [...s, doc.id] : s.filter((item) => item !== doc.id))} className="mt-0.5 h-4 w-4 rounded border-[var(--border)]" />
                        <span className="text-xs text-[var(--text-strong)]">{doc.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Sub-tab: Vue d'ensemble ──────────────────────────────────────────────────

function OverviewSubTab({
  projectId, projectName, spaceId, spaceName, topics, tickets, onNavigate,
}: {
  projectId: string; projectName: string; spaceId: string; spaceName: string; topics: Topic[]; tickets: Ticket[];
  onNavigate: (tab: SuiviSubTabId) => void;
}) {
  const topicMap = useMemo(() => Object.fromEntries(topics.map((t) => [t.id, t])), [topics]);

  const statsByStatus = useMemo(() => {
    const counts: Record<string, number> = { backlog: 0, todo: 0, in_progress: 0, review: 0, done: 0, blocked: 0 };
    for (const t of tickets) {
      if (t.status in counts) counts[t.status]++;
    }
    return counts;
  }, [tickets]);

  const recentTickets = useMemo(() => [...tickets].sort((a, b) => {
    const da = a.updated_at ? new Date(a.updated_at).getTime() : 0;
    const db = b.updated_at ? new Date(b.updated_at).getTime() : 0;
    return db - da;
  }).slice(0, 5), [tickets]);

  const kpis = [
    { label: "Total tickets", value: tickets.length, icon: Table2, color: "text-brand-500", bg: "bg-brand-500/10" },
    { label: "En cours", value: statsByStatus.in_progress, icon: FolderKanban, color: "text-warn-500", bg: "bg-warn-500/10" },
    { label: "Terminés", value: statsByStatus.done, icon: CheckCircle2, color: "text-brand-700", bg: "bg-brand-100" },
    { label: "Bloqués", value: statsByStatus.blocked, icon: AlertTriangle, color: "text-danger-500", bg: "bg-danger-500/10" },
  ];

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="card flex items-center gap-4 p-4">
            <div className={cn("flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl", kpi.bg)}>
              <kpi.icon className={cn("h-5 w-5", kpi.color)} />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--text-strong)]">{kpi.value}</p>
              <p className="text-xs text-[var(--text-muted)]">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-6">
          {/* Topics summary */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--text-strong)]">
                Topics <span className="ml-1.5 rounded bg-[var(--bg-panel-2)] px-1.5 py-0.5 text-xs text-[var(--text-muted)]">{topics.length}</span>
              </h2>
              <button onClick={() => onNavigate("topics")} className="text-xs text-brand-500 transition hover:underline">Voir tous →</button>
            </div>
            {topics.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-[var(--border)] py-8 text-center">
                <Layers className="h-7 w-7 text-[var(--text-muted)]" />
                <p className="text-sm text-[var(--text-muted)]">Aucun topic — commencez par en créer un dans l'onglet Topics.</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {topics.map((topic) => {
                  const topicTickets = tickets.filter((t) => t.topic_id === topic.id);
                  const doneCount = topicTickets.filter((t) => t.status === "done").length;
                  const progress = topicTickets.length > 0 ? Math.round((doneCount / topicTickets.length) * 100) : 0;
                  return (
                    <div key={topic.id} className="card p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className={cn("h-2.5 w-2.5 flex-shrink-0 rounded-full", topicColorDot(topic.color))} />
                          <Link to={topicPath({ id: projectId, name: projectName }, { id: spaceId, name: spaceName }, topic)} className="text-sm font-semibold text-[var(--text-strong)] transition hover:text-brand-500">{topic.title}</Link>
                        </div>
                        <span className={cn("badge text-[10px]", topicStatusBadge(topic.status))}>{topic.status}</span>
                      </div>
                      <div className="mt-3">
                        <div className="mb-1 flex items-center justify-between text-xs text-[var(--text-muted)]">
                          <span>{topicTickets.length} tickets</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-[var(--bg-panel-2)]">
                          <div className={cn("h-1.5 rounded-full", topicColorDot(topic.color))} style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                      {topic.risks.length > 0 && (
                        <p className="mt-2 flex items-center gap-1 text-xs text-danger-500">
                          <AlertTriangle className="h-3 w-3" />{topic.risks.length} risque{topic.risks.length > 1 ? "s" : ""}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {recentTickets.length > 0 && (
            <div>
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-[var(--text-strong)]">Activite recente</h2>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Les derniers tickets visibles dans l'espace, avec leur topic, leur statut et leur priorite.
                  </p>
                </div>
                <button
                  onClick={() => onNavigate("backlog")}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-brand-500 transition duration-200 ease-in-out hover:bg-brand-50 hover:text-brand-600"
                >
                  Voir tout
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--bg-panel)] shadow-[var(--shadow-sm)]">
                <div className="hidden grid-cols-[140px_240px_minmax(0,1fr)_120px_100px] gap-4 border-b border-[var(--border)] bg-[var(--bg-panel-2)] px-6 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)] lg:grid">
                  <span>Reference</span>
                  <span>Topic</span>
                  <span>Sujet</span>
                  <span>Statut</span>
                  <span>Priorite</span>
                </div>
                <div className="divide-y divide-[var(--border)]">
                  {recentTickets.map((ticket) => {
                    const topic = topicMap[ticket.topic_id];
                    const statusMeta = KANBAN_COLS.find((c) => c.id === ticket.status);
                    return (
                      <button
                        key={ticket.id}
                        type="button"
                        onClick={() => onNavigate("backlog")}
                        className="grid w-full gap-3 px-5 py-4 text-left transition duration-200 ease-in-out hover:bg-[var(--bg-panel-2)] lg:grid-cols-[140px_240px_minmax(0,1fr)_120px_100px] lg:items-center lg:gap-4 lg:px-6"
                      >
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-[var(--bg-panel-2)] px-3 py-1.5 font-mono text-[11px] font-semibold tracking-[0.08em] text-[var(--text-muted)]">
                            {ticket.id}
                          </span>
                        </div>
                        <div className="min-w-0">
                          {topic ? (
                            <span
                              className={cn(
                                "inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold",
                                topicColorClass(topic.color),
                              )}
                            >
                              <span className={cn("h-1.5 w-1.5 flex-shrink-0 rounded-full", topicColorDot(topic.color))} />
                              <span className="truncate">{topic.title}</span>
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 py-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                              Sans topic
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[var(--text-strong)] lg:text-[15px]">
                            {ticket.title}
                          </p>
                        </div>
                        <div>
                          <span
                            className={cn(
                              "inline-flex rounded-full px-3 py-1.5 text-[11px] font-semibold",
                              statusMeta ? `${statusMeta.color} bg-[var(--bg-panel-2)]` : "bg-[var(--bg-panel-2)] text-[var(--text-muted)]",
                            )}
                          >
                            {statusMeta?.label ?? ticket.status}
                          </span>
                        </div>
                        <div>
                          <span className={cn("inline-flex rounded-full px-3 py-1.5 text-[11px] font-semibold capitalize", priorityBadge(ticket.priority))}>
                            {ticket.priority}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Recent tickets */}
          {false && recentTickets.length > 0 && (
            <div>
              <div className="mb-4 flex items-end justify-between gap-4 [&>h2]:hidden [&>button]:hidden">
                <div className="hidden">
                  <h2 className="text-sm font-semibold text-[var(--text-strong)]">ActivitÃ© rÃ©cente</h2>
                </div>
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-[var(--text-strong)]">Activité récente</h2>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">Les derniers tickets actifs, avec leur topic, leur statut et leur priorité.</p>
                </div>
                <h2 className="text-sm font-semibold text-[var(--text-strong)]">Activité récente</h2>
                <button onClick={() => onNavigate("backlog")} className="text-xs text-brand-500 transition hover:underline">Voir tout →</button>
              </div>
              <div className="overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--bg-panel)] shadow-[var(--shadow-sm)]">
                <table className="w-full text-sm">
                  <tbody>
                    {recentTickets.map((ticket) => {
                      const topic = topicMap[ticket.topic_id];
                      return (
                        <tr key={ticket.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-panel-2)]">
                          <td className="px-4 py-2.5 font-mono text-xs text-[var(--text-muted)]">{ticket.id}</td>
                          <td className="px-4 py-2.5">
                            {topic && <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold", topicColorClass(topic.color))}>
                              <span className={cn("h-1.5 w-1.5 rounded-full", topicColorDot(topic.color))} />{topic.title}
                            </span>}
                          </td>
                          <td className="max-w-xs px-4 py-2.5 text-xs font-medium text-[var(--text-strong)] truncate">{ticket.title}</td>
                          <td className="px-4 py-2.5">
                            <span className={cn("badge text-[10px]", (() => {
                              const col = KANBAN_COLS.find((c) => c.id === ticket.status);
                              return col ? col.color + " bg-[var(--bg-panel-2)]" : "";
                            })())}>{KANBAN_COLS.find((c) => c.id === ticket.status)?.label ?? ticket.status}</span>
                          </td>
                          <td className="px-4 py-2.5"><span className={cn("badge capitalize text-[10px]", priorityBadge(ticket.priority))}>{ticket.priority}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

      </div>
  );
}

// ─── Sub-tab: Topics ──────────────────────────────────────────────────────────

function TopicsSubTab({ spaceId, spaceName, projectId, projectName, topics, tickets, autoOpen, returnTo }: { spaceId: string; spaceName: string; projectId: string; projectName: string; topics: Topic[]; tickets: Ticket[]; autoOpen?: boolean; returnTo?: string | null }) {
  const navigate = useNavigate();
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);

  useEffect(() => {
    if (autoOpen) { setEditingTopic(null); setShowTopicModal(true); }
  }, [autoOpen]);

  function handleTopicModalClose() {
    setShowTopicModal(false);
    setEditingTopic(null);
    if (returnTo) navigate(decodeURIComponent(returnTo));
  }

  const ticketCountByTopic = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of tickets) map[t.topic_id] = (map[t.topic_id] ?? 0) + 1;
    return map;
  }, [tickets]);

  return (
    <div>
      {showTopicModal && <TopicModal spaceId={spaceId} topic={editingTopic ?? undefined} onClose={handleTopicModalClose} />}

      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-[var(--text-strong)]">Topics</h2>
          <p className="text-xs text-[var(--text-muted)]">{topics.length} topic{topics.length !== 1 ? "s" : ""} dans cet espace</p>
        </div>
        <button onClick={() => { setEditingTopic(null); setShowTopicModal(true); }} className="btn-primary">
          <Plus className="h-4 w-4" />Nouveau topic
        </button>
      </div>

      {topics.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-[var(--border)] py-16 text-center">
          <Layers className="h-10 w-10 text-[var(--text-muted)]" />
          <div>
            <p className="font-semibold text-[var(--text-strong)]">Aucun topic</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Un topic regroupe les tickets d'un même périmètre fonctionnel.</p>
          </div>
          <button onClick={() => setShowTopicModal(true)} className="btn-primary">Créer le premier topic</button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {topics.map((topic) => {
            const count = ticketCountByTopic[topic.id] ?? 0;
            return (
              <div
                key={topic.id}
                className="group relative h-full overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--bg-panel)] p-5 shadow-[var(--shadow-sm)] transition duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"
              >
                <div className="pointer-events-none absolute left-5 right-5 top-0 h-16 rounded-b-[16px] bg-[radial-gradient(circle_at_top_left,rgba(209,245,105,0.10),transparent_56%),radial-gradient(circle_at_top_right,rgba(57,63,56,0.05),transparent_50%)]" />

                <div className="relative flex h-full flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <span className={cn("h-3.5 w-3.5 flex-shrink-0 rounded-full shadow-[0_0_0_5px_var(--bg-panel)]", topicColorDot(topic.color))} />
                        <Link
                          to={topicPath({ id: projectId, name: projectName }, { id: spaceId, name: spaceName }, topic)}
                          className="truncate text-lg font-semibold tracking-tight text-[var(--text-strong)] transition group-hover:text-brand-600"
                        >
                          {topic.title}
                        </Link>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", topicColorClass(topic.color))}>
                          {topicNatureLabel(topic.topic_nature)}
                        </span>
                        <span className={cn("rounded-full px-3 py-1 text-[11px] font-semibold capitalize", topicStatusBadge(topic.status))}>
                          {topic.status}
                        </span>
                        <span className={cn("rounded-full px-3 py-1 text-[11px] font-semibold capitalize", priorityBadge(topic.priority))}>
                          {topic.priority}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setEditingTopic(topic); setShowTopicModal(true); }}
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] text-[var(--text-muted)] transition duration-200 ease-in-out hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="rounded-[14px] border border-[var(--border)] bg-[var(--bg-panel-2)] px-4 py-3">
                    <p className="line-clamp-3 min-h-[3.75rem] text-sm leading-6 text-[var(--text-muted)]">
                      {topic.description?.trim() || "Aucune description pour le moment. Ajoutez un cadrage clair pour guider les tickets, la documentation et les arbitrages du topic."}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-[14px] bg-[var(--bg-panel-2)] px-4 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Tickets</p>
                      <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-[var(--text-strong)]">
                        <Table2 className="h-4 w-4 text-brand-500" />
                        <span>{count}</span>
                      </div>
                    </div>
                    <div className="rounded-[14px] bg-[var(--bg-panel-2)] px-4 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Risques</p>
                      <div className={cn("mt-2 flex items-center gap-2 text-sm font-semibold", topic.risks.length > 0 ? "text-amber-600" : "text-[var(--text-strong)]")}>
                        <AlertTriangle className="h-4 w-4" />
                        <span>{topic.risks.length}</span>
                      </div>
                    </div>
                    <div className="rounded-[14px] bg-[var(--bg-panel-2)] px-4 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Questions</p>
                      <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-[var(--text-strong)]">
                        <MessageSquareText className="h-4 w-4 text-brand-500" />
                        <span>{topic.open_questions.length}</span>
                      </div>
                    </div>
                  </div>

                  <div className="min-h-[34px] flex flex-wrap items-center gap-2">
                    {topic.tags.length > 0 ? (
                      <>
                        {topic.tags.slice(0, 4).map((tag) => (
                          <span key={tag} className="rounded-full border border-[var(--border)] bg-[var(--bg-panel-2)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)]">
                            #{tag}
                          </span>
                        ))}
                        {topic.tags.length > 4 && (
                          <span className="rounded-full border border-[var(--border)] bg-[var(--bg-panel-2)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)]">
                            +{topic.tags.length - 4}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-[11px] font-medium text-[var(--text-muted)]">Aucun tag pour le moment</span>
                    )}
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
                    <p className="max-w-[65%] text-xs leading-5 text-[var(--text-muted)]">
                      {count > 0 ? "Topic deja alimente en tickets et suivi actif." : "Pret a accueillir les premiers tickets de cadrage."}
                    </p>
                    <Link
                      to={topicPath({ id: projectId, name: projectName }, { id: spaceId, name: spaceName }, topic)}
                      className="inline-flex items-center gap-1 rounded-full bg-[var(--text-strong)] px-4 py-2 text-xs font-semibold text-[#D1F569] transition duration-200 ease-in-out hover:bg-brand-500 hover:text-[var(--text-strong)]"
                    >
                      Ouvrir
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Sub-tab: Kanban ──────────────────────────────────────────────────────────

function LegacyKanbanSubTab({ spaceId, topics, tickets, documents, loadingTickets }: { spaceId: string; topics: Topic[]; tickets: Ticket[]; documents: Document[]; loadingTickets: boolean }) {
  const { mutateAsync: updateTicket } = useUpdateTicket();
  const [topicFilter, setTopicFilter] = useState("all");
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [draggingTicketId, setDraggingTicketId] = useState<string | null>(null);

  const filteredTickets = useMemo(() => topicFilter === "all" ? tickets : tickets.filter((t) => t.topic_id === topicFilter), [tickets, topicFilter]);
  const topicMap = useMemo(() => Object.fromEntries(topics.map((t) => [t.id, t])), [topics]);

  return (
    <div>
      {showTicketModal && <SharedTicketModal topics={topics} documents={documents} ticket={editingTicket ?? undefined} defaultTopicId={topicFilter !== "all" ? topicFilter : topics[0]?.id} onClose={() => { setShowTicketModal(false); setEditingTicket(null); }} />}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Topic</span>
          <select value={topicFilter} onChange={(e) => setTopicFilter(e.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] px-3 py-1.5 text-sm text-[var(--text-strong)] outline-none transition focus:border-brand-500">
            <option value="all">Tous</option>
            {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}
          </select>
          <span className="text-xs text-[var(--text-muted)]">{filteredTickets.length} ticket{filteredTickets.length !== 1 ? "s" : ""}</span>
        </div>
        <button onClick={() => { setEditingTicket(null); setShowTicketModal(true); }} disabled={topics.length === 0} className="btn-primary disabled:opacity-60">
          <Plus className="h-4 w-4" />Nouveau ticket
        </button>
      </div>

      {loadingTickets ? (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {KANBAN_COLS.map((col) => (
            <div key={col.id} className="w-72 min-w-[280px] flex-shrink-0">
              <div className="mb-2.5 flex items-center gap-2 px-1">
                <span className={cn("h-2 w-2 rounded-full", col.dot)} />
                <span className={cn("text-xs font-semibold uppercase tracking-wider", col.color)}>{col.label}</span>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] p-2 space-y-2">
                <RowSkeleton lines={2} />
                <RowSkeleton lines={1} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {KANBAN_COLS.map((col) => {
            const colTickets = filteredTickets.filter((t) => t.status === col.id);
            return (
              <div key={col.id} className="w-72 min-w-[280px] flex-shrink-0">
                <div className="mb-2.5 flex items-center gap-2 px-1">
                  <span className={cn("h-2 w-2 rounded-full", col.dot)} />
                  <span className={cn("text-xs font-semibold uppercase tracking-wider", col.color)}>{col.label}</span>
                  <span className="ml-auto rounded bg-[var(--bg-panel-2)] px-1.5 py-0.5 text-xs text-[var(--text-muted)]">{colTickets.length}</span>
                </div>
                <div
                  className={cn("min-h-[200px] space-y-2 rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] p-2 transition", draggingTicketId ? "ring-1 ring-brand-500/30" : "")}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={async (e) => {
                    e.preventDefault();
                    const ticketId = e.dataTransfer.getData("text/plain");
                    if (!ticketId) return;
                    setDraggingTicketId(null);
                    await updateTicket({ id: ticketId, status: col.id });
                  }}
                >
                  {colTickets.map((ticket) => {
                    const topic = topicMap[ticket.topic_id];
                    return (
                      <button
                        key={ticket.id}
                        type="button"
                        draggable
                        onDragStart={(e) => { setDraggingTicketId(ticket.id); e.dataTransfer.setData("text/plain", ticket.id); }}
                        onDragEnd={() => setDraggingTicketId(null)}
                        onClick={() => { setEditingTicket(ticket); setShowTicketModal(true); }}
                        className="w-full cursor-grab rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-3.5 text-left transition hover:border-brand-500/40 hover:shadow-panel active:cursor-grabbing"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[10px] text-[var(--text-muted)]">{ticket.id}</span>
                          <span className={cn("badge text-[10px]", priorityBadge(ticket.priority))}>{ticket.priority}</span>
                        </div>
                        <p className="mt-2 text-xs font-medium leading-5 text-[var(--text-strong)]">{ticket.title}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                          {topic && <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold", topicColorClass(topic.color))}>
                            <span className={cn("h-1.5 w-1.5 rounded-full", topicColorDot(topic.color))} />{topic.title}
                          </span>}
                          <span className="badge bg-[var(--bg-panel-2)] text-[10px] text-[var(--text-muted)]">{ticketTypeLabel(ticket.type)}</span>
                        </div>
                        {ticket.assignee && <p className="mt-2 text-[10px] text-[var(--text-muted)]">→ {ticket.assignee}</p>}
                        {ticket.tags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {ticket.tags.slice(0, 3).map((tag) => (
                              <span key={tag} className="rounded-full bg-[var(--bg-panel-2)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">#{tag}</span>
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                  {colTickets.length === 0 && (
                    <div className="flex items-center justify-center py-6 text-xs text-[var(--text-muted)]">Vide</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Sub-tab: Backlog ─────────────────────────────────────────────────────────

function KanbanSubTab({
  topics,
  tickets,
  documents,
  loadingTickets,
  ticketsError,
  onRetryTickets,
  autoOpen,
}: {
  topics: Topic[];
  tickets: Ticket[];
  documents: Document[];
  loadingTickets: boolean;
  ticketsError?: string | null;
  onRetryTickets?: () => void;
  autoOpen?: boolean;
  returnTo?: string | null;
}) {
  const navigate = useNavigate();
  const { mutateAsync: updateTicket } = useUpdateTicket();
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [createDefaults, setCreateDefaults] = useState<{ topicId?: string; status?: string }>({});

  useEffect(() => {
    if (autoOpen) { setEditingTicket(null); setCreateDefaults({}); setShowTicketModal(true); }
  }, [autoOpen]);

  function handleTicketModalClose() {
    setShowTicketModal(false);
    setEditingTicket(null);
    setCreateDefaults({});
    if (returnTo) navigate(decodeURIComponent(returnTo));
  }

  return (
    <div>
      {showTicketModal && (
        <SharedTicketModal
          topics={topics}
          documents={documents}
          ticket={editingTicket ?? undefined}
          defaultTopicId={createDefaults.topicId ?? topics[0]?.id}
          defaultStatus={createDefaults.status}
          onClose={handleTicketModalClose}
        />
      )}

      <KanbanPage
        topics={topics}
        tickets={tickets}
        loading={loadingTickets}
        error={ticketsError}
        onRetry={onRetryTickets}
        onCreateTicket={topics.length > 0 ? (statusId?: string) => {
          setEditingTicket(null);
          setCreateDefaults({ topicId: topics[0]?.id, status: statusId });
          setShowTicketModal(true);
        } : undefined}
        onOpenTicket={(ticket) => {
          setEditingTicket(ticket);
          setCreateDefaults({});
          setShowTicketModal(true);
        }}
        onStatusChange={(ticket, nextStatus) => {
          void updateTicket({ id: ticket.id, status: nextStatus });
        }}
      />
    </div>
  );
}

function BacklogSubTab({
  topics,
  tickets,
  documents,
  loadingTickets,
  mode = "backlog",
}: {
  topics: Topic[];
  tickets: Ticket[];
  documents: Document[];
  loadingTickets: boolean;
  mode?: "backlog" | "tasks";
}) {
  const { mutateAsync: updateTicket } = useUpdateTicket();
  const isTasksView = mode === "tasks";
  const [query, setQuery] = useState("");
  const [topicFilter, setTopicFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"updated_desc" | "priority_desc" | "title_asc">(
    isTasksView ? "priority_desc" : "updated_desc",
  );
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase("fr"));

  const topicMap = useMemo(() => Object.fromEntries(topics.map((t) => [t.id, t])), [topics]);

  const filteredTickets = useMemo(() => {
    return [...tickets]
      .filter((ticket) => {
        const topic = topicMap[ticket.topic_id];
        if (topicFilter !== "all" && ticket.topic_id !== topicFilter) return false;
        if (typeFilter !== "all" && ticket.type !== typeFilter) return false;
        if (statusFilter !== "all" && ticket.status !== statusFilter) return false;
        if (!deferredQuery) return true;

        const haystack = [
          ticket.id,
          ticket.title,
          ticket.type,
          ticket.priority,
          ticket.assignee ?? "",
          topic?.title ?? "",
          ...ticket.tags,
        ]
          .join(" ")
          .toLocaleLowerCase("fr");

        return haystack.includes(deferredQuery);
      })
      .sort((left, right) => {
        if (sortBy === "title_asc") {
          return left.title.localeCompare(right.title, "fr", { sensitivity: "base" });
        }

        if (sortBy === "priority_desc") {
          const priorityDelta = ticketPriorityRank(right.priority) - ticketPriorityRank(left.priority);
          if (priorityDelta !== 0) return priorityDelta;
        }

        const leftDate = new Date(left.updated_at ?? left.created_at ?? 0).getTime();
        const rightDate = new Date(right.updated_at ?? right.created_at ?? 0).getTime();
        return rightDate - leftDate;
      });
  }, [deferredQuery, sortBy, statusFilter, tickets, topicFilter, topicMap, typeFilter]);

  const blockedCount = filteredTickets.filter((ticket) => ticket.status === "blocked").length;
  const assignedCount = filteredTickets.filter((ticket) => Boolean(ticket.assignee)).length;
  const dueSoonCount = filteredTickets.filter((ticket) => {
    if (!ticket.due_date) return false;
    const due = new Date(ticket.due_date).getTime();
    if (Number.isNaN(due)) return false;
    const delta = due - Date.now();
    return delta >= 0 && delta <= 7 * 24 * 60 * 60 * 1000;
  }).length;
  const totalTagCount = filteredTickets.reduce((count, ticket) => count + ticket.tags.length, 0);
  const defaultSort = isTasksView ? "priority_desc" : "updated_desc";
  const hasActiveFilters = Boolean(
    query.trim() || topicFilter !== "all" || statusFilter !== "all" || typeFilter !== "all" || sortBy !== defaultSort,
  );

  function clearFilters() {
    setQuery("");
    setTopicFilter("all");
    setStatusFilter("all");
    setTypeFilter("all");
    setSortBy(defaultSort);
  }

  return (
    <div className="space-y-4">
      {showTicketModal && <SharedTicketModal topics={topics} documents={documents} ticket={editingTicket ?? undefined} defaultTopicId={topicFilter !== "all" ? topicFilter : topics[0]?.id} onClose={() => { setShowTicketModal(false); setEditingTicket(null); }} />}

      <section className="workspace-card p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <p className="section-title">{isTasksView ? "Tasks" : "Backlog"}</p>
            <h3 className="mt-2 font-[var(--font-display)] text-[clamp(1.55rem,2vw,2.1rem)] font-extrabold tracking-tight text-[var(--text-strong)]">
              {isTasksView ? "Executer, suivre, relancer sans friction" : "Prioriser vite, sans surcharge visuelle"}
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">
              {isTasksView
                ? "La vue Tasks met l execution au premier plan: statut, assignee, echeance et priorite restent visibles en permanence pour accelerer le suivi quotidien."
                : "La liste met le titre, le statut, la priorite et l assignee au premier plan. Les details secondaires restent accessibles sans alourdir la lecture."}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
              <span className="rounded-full border border-[var(--border)] bg-[var(--bg-panel)] px-3 py-1.5 font-medium">
                {filteredTickets.length} visible{filteredTickets.length !== 1 ? "s" : ""}
              </span>
              <span className="rounded-full border border-[var(--border)] bg-[var(--bg-panel)] px-3 py-1.5 font-medium">
                {blockedCount} bloque{blockedCount !== 1 ? "s" : ""}
              </span>
              <span className="rounded-full border border-[var(--border)] bg-[var(--bg-panel)] px-3 py-1.5 font-medium">
                {assignedCount} assigne{assignedCount !== 1 ? "s" : ""}
              </span>
              {isTasksView ? (
                <span className="rounded-full border border-[var(--border)] bg-[var(--bg-panel)] px-3 py-1.5 font-medium">
                  {dueSoonCount} echeance{dueSoonCount !== 1 ? "s" : ""} proche{dueSoonCount !== 1 ? "s" : ""}
                </span>
              ) : null}
              <span className="rounded-full border border-[var(--border)] bg-[var(--bg-panel)] px-3 py-1.5 font-medium">
                {totalTagCount} tag{totalTagCount !== 1 ? "s" : ""} charge{totalTagCount !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          <button onClick={() => { setEditingTicket(null); setShowTicketModal(true); }} disabled={topics.length === 0} className="btn-primary shrink-0 disabled:opacity-60">
            <Plus className="h-4 w-4" />
            {isTasksView ? "Nouvelle task" : "Nouveau ticket"}
          </button>
        </div>

        <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.9fr)]">
          <label className="flex items-center gap-3 rounded-[22px] border border-[var(--border)] bg-[var(--bg-panel)] px-4 py-3 shadow-[var(--shadow-xs)]">
            <Search className="h-4 w-4 text-[var(--text-muted)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={isTasksView ? "Rechercher une task par titre, ID, assignee ou topic" : "Rechercher par titre, ID, assignee, tag ou topic"}
              className="min-w-0 flex-1 border-0 bg-transparent text-sm text-[var(--text-strong)] outline-none placeholder:text-[var(--text-xmuted)]"
            />
          </label>

          <select value={topicFilter} onChange={(event) => setTopicFilter(event.target.value)} className={fieldCls}>
            <option value="all">Tous les topics</option>
            {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}
          </select>

          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={fieldCls}>
            <option value="all">Tous les statuts</option>
            {KANBAN_COLS.map((column) => <option key={column.id} value={column.id}>{column.label}</option>)}
          </select>

          <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)} className={fieldCls}>
            <option value="updated_desc">Dernieres mises a jour</option>
            <option value="priority_desc">Priorite la plus haute</option>
            <option value="title_asc">Titre A-Z</option>
          </select>
        </div>

        <details className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] px-4 py-3">
          <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
            Plus de filtres
          </summary>
          <div className="mt-3 grid gap-3 md:max-w-sm">
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className={fieldCls}>
              <option value="all">Tous les types</option>
              {TICKET_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
            {hasActiveFilters ? (
              <button type="button" onClick={clearFilters} className="btn-secondary justify-center">
                Reinitialiser les filtres
              </button>
            ) : null}
          </div>
        </details>
      </section>

      {loadingTickets ? (
        <div className="workspace-card overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => <RowSkeleton key={i} lines={2} />)}
        </div>
      ) : tickets.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Table2 className="h-6 w-6" />
          </div>
          <div>
            <p className="empty-state-title">Aucun ticket pour le moment</p>
            <p className="empty-state-description">
              {isTasksView
                ? "Creez une premiere task pour suivre l execution quotidienne et distribuer les responsabilites."
                : "Creez un premier ticket pour commencer a prioriser le travail et structurer le delivery."}
            </p>
          </div>
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Search className="h-6 w-6" />
          </div>
          <div>
            <p className="empty-state-title">Aucun resultat pour ces filtres</p>
            <p className="empty-state-description">
              Elargissez la recherche ou rouvrez les filtres avances pour retrouver une vue plus large.
            </p>
          </div>
          {hasActiveFilters ? (
            <button type="button" className="btn-secondary" onClick={clearFilters}>
              Reinitialiser les filtres
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {filteredTickets.map((ticket) => {
              const topic = topicMap[ticket.topic_id];
              const visibleTags = ticket.tags.slice(0, 2);
              const hiddenTags = Math.max(0, ticket.tags.length - visibleTags.length);
              return (
                <article key={ticket.id} className="workspace-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-[11px] text-[var(--text-xmuted)]">{ticket.id}</p>
                      <h4 title={ticket.title} className="mt-2 text-sm font-semibold leading-6 text-[var(--text-strong)]">
                        {ticket.title}
                      </h4>
                    </div>
                    <span className={cn("badge shrink-0 text-[10px]", priorityBadge(ticket.priority))}>{ticket.priority || "n/a"}</span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={cn("badge text-[10px]", topic ? topicColorClass(topic.color) : "badge-neutral")}>
                      {topic?.title ?? "Sans topic"}
                    </span>
                    <span className="badge badge-neutral text-[10px]">{ticketTypeLabel(ticket.type)}</span>
                    {visibleTags.map((tag) => (
                      <span key={tag} className="badge badge-neutral text-[10px]">
                        {tag}
                      </span>
                    ))}
                    {hiddenTags > 0 ? <span className="badge badge-neutral text-[10px]">+{hiddenTags}</span> : null}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-[var(--text-xmuted)]">Statut</p>
                      <p className="mt-1 font-medium text-[var(--text-strong)]">
                        {KANBAN_COLS.find((column) => column.id === ticket.status)?.label ?? ticket.status}
                      </p>
                    </div>
                    <div>
                      <p className="text-[var(--text-xmuted)]">Assigne</p>
                      <p className="mt-1 font-medium text-[var(--text-strong)]">{ticket.assignee ?? "Non assigne"}</p>
                    </div>
                    <div>
                      <p className="text-[var(--text-xmuted)]">{isTasksView ? "Echeance" : "Mis a jour"}</p>
                      <p className="mt-1 font-medium text-[var(--text-strong)]">{formatBacklogDate(isTasksView ? ticket.due_date ?? ticket.updated_at ?? ticket.created_at : ticket.updated_at ?? ticket.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-[var(--text-xmuted)]">Topic</p>
                      <p className="mt-1 truncate font-medium text-[var(--text-strong)]">{topic?.title ?? "Non lie"}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-2">
                    <select
                      value={ticket.status}
                      onChange={(event) => { void updateTicket({ id: ticket.id, status: event.target.value }); }}
                      className={fieldCls}
                    >
                      {KANBAN_COLS.map((column) => <option key={column.id} value={column.id}>{column.label}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={() => { setEditingTicket(ticket); setShowTicketModal(true); }}
                      className="btn-secondary justify-center"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Modifier
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="hidden md:block workspace-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-[920px] w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--bg-panel-2)]/85">
                    {[
                      isTasksView ? "Task" : "Ticket",
                      "Statut",
                      "Priorite",
                      "Assigne",
                      isTasksView ? "Echeance" : "Mis a jour",
                      "Actions",
                    ].map((header) => (
                      <th key={header} className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((ticket) => {
                    const topic = topicMap[ticket.topic_id];
                    const visibleTags = ticket.tags.slice(0, 2);
                    const hiddenTags = Math.max(0, ticket.tags.length - visibleTags.length);
                    return (
                      <tr key={ticket.id} className="border-b border-[var(--border-subtle)] align-top last:border-0 hover:bg-[var(--bg-panel-2)]/45">
                        <td className="px-5 py-4">
                          <div className="max-w-[30rem]">
                            <p className="truncate font-mono text-[10px] text-[var(--text-xmuted)]" title={ticket.id}>{ticket.id}</p>
                            <button
                              type="button"
                              onClick={() => { setEditingTicket(ticket); setShowTicketModal(true); }}
                              title={ticket.title}
                              className="mt-2 text-left text-sm font-semibold leading-6 text-[var(--text-strong)] transition hover:text-brand-700"
                            >
                              {ticket.title}
                            </button>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <span className={cn("badge text-[10px]", topic ? topicColorClass(topic.color) : "badge-neutral")}>
                                {topic?.title ?? "Sans topic"}
                              </span>
                              <span className="badge badge-neutral text-[10px]">{ticketTypeLabel(ticket.type)}</span>
                              {visibleTags.map((tag) => (
                                <span key={tag} className="badge badge-neutral text-[10px]">
                                  {tag}
                                </span>
                              ))}
                              {hiddenTags > 0 ? <span className="badge badge-neutral text-[10px]">+{hiddenTags}</span> : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <select
                            value={ticket.status}
                            onChange={(event) => { void updateTicket({ id: ticket.id, status: event.target.value }); }}
                            className="w-[10rem] rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] px-3 py-2 text-xs font-medium text-[var(--text-strong)] outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
                          >
                            {KANBAN_COLS.map((column) => <option key={column.id} value={column.id}>{column.label}</option>)}
                          </select>
                        </td>
                        <td className="px-5 py-4">
                          <span className={cn("badge text-[10px]", priorityBadge(ticket.priority))}>{ticket.priority || "n/a"}</span>
                        </td>
                        <td className="px-5 py-4 text-sm text-[var(--text-muted)]">
                          {ticket.assignee ?? "Non assigne"}
                        </td>
                        <td className="px-5 py-4 text-sm text-[var(--text-muted)]">
                          {formatBacklogDate(isTasksView ? ticket.due_date ?? ticket.updated_at ?? ticket.created_at : ticket.updated_at ?? ticket.created_at)}
                        </td>
                        <td className="px-5 py-4">
                          <button
                            type="button"
                            onClick={() => { setEditingTicket(ticket); setShowTicketModal(true); }}
                            className="btn-secondary h-9 rounded-xl px-3 text-xs"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Modifier
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Sub-tab: Roadmap ─────────────────────────────────────────────────────────

function TasksSubTab(props: { topics: Topic[]; tickets: Ticket[]; documents: Document[]; loadingTickets: boolean }) {
  return <BacklogSubTab {...props} mode="tasks" />;
}

function RoadmapSubTab({ topics }: { topics: Topic[] }) {
  const topicsWithDates = useMemo(() =>
    topics.filter((t) => t.roadmap_start_date && t.roadmap_end_date)
      .sort((a, b) => (a.roadmap_start_date ?? "").localeCompare(b.roadmap_start_date ?? "")),
    [topics]
  );

  const topicsWithoutDates = useMemo(() => topics.filter((t) => !t.roadmap_start_date || !t.roadmap_end_date), [topics]);

  // Compute timeline range
  const { minDate, maxDate, totalDays } = useMemo(() => {
    if (topicsWithDates.length === 0) return { minDate: new Date(), maxDate: new Date(), totalDays: 1 };
    const dates = topicsWithDates.flatMap((t) => [new Date(t.roadmap_start_date!), new Date(t.roadmap_end_date!)]);
    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    const max = new Date(Math.max(...dates.map((d) => d.getTime())));
    min.setDate(min.getDate() - 2);
    max.setDate(max.getDate() + 2);
    return { minDate: min, maxDate: max, totalDays: Math.max(1, Math.ceil((max.getTime() - min.getTime()) / 86400000)) };
  }, [topicsWithDates]);

  function pct(dateStr: string) {
    const d = new Date(dateStr).getTime();
    return Math.max(0, Math.min(100, ((d - minDate.getTime()) / (maxDate.getTime() - minDate.getTime())) * 100));
  }

  // Generate month markers
  const months = useMemo(() => {
    const result: { label: string; pct: number }[] = [];
    const cur = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    while (cur <= maxDate) {
      const p = ((cur.getTime() - minDate.getTime()) / (maxDate.getTime() - minDate.getTime())) * 100;
      result.push({ label: cur.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }), pct: p });
      cur.setMonth(cur.getMonth() + 1);
    }
    return result;
  }, [minDate, maxDate]);

  if (topics.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-[var(--border)] py-16 text-center">
        <Map className="h-10 w-10 text-[var(--text-muted)]" />
        <div>
          <p className="font-semibold text-[var(--text-strong)]">Aucun topic</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Créez des topics pour visualiser la roadmap.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {topicsWithDates.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-[var(--border)] py-12 text-center">
          <Map className="h-8 w-8 text-[var(--text-muted)]" />
          <p className="text-sm text-[var(--text-muted)]">Aucun topic n'a de dates de roadmap. Modifiez les topics pour ajouter des dates.</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="border-b border-[var(--border)] px-5 py-3">
            <h3 className="text-sm font-semibold text-[var(--text-strong)]">Timeline — {topicsWithDates.length} topic{topicsWithDates.length !== 1 ? "s" : ""}</h3>
            <p className="text-xs text-[var(--text-muted)]">{totalDays} jours · {minDate.toLocaleDateString("fr-FR")} → {maxDate.toLocaleDateString("fr-FR")}</p>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[600px] p-5">
              {/* Month labels */}
              <div className="relative mb-2 h-5">
                {months.map((m) => (
                  <span key={m.label + m.pct} className="absolute text-[10px] text-[var(--text-muted)]" style={{ left: `${m.pct}%`, transform: "translateX(-50%)" }}>
                    {m.label}
                  </span>
                ))}
              </div>
              {/* Grid line */}
              <div className="relative mb-4 h-px bg-[var(--border)]">
                {months.map((m) => (
                  <div key={m.label + m.pct + "line"} className="absolute h-2 w-px -translate-y-1 bg-[var(--border)]" style={{ left: `${m.pct}%` }} />
                ))}
              </div>
              {/* Topic bars */}
              <div className="space-y-3">
                {topicsWithDates.map((topic) => {
                  const left = pct(topic.roadmap_start_date!);
                  const right = pct(topic.roadmap_end_date!);
                  const width = Math.max(1, right - left);
                  const startD = new Date(topic.roadmap_start_date!);
                  const endD = new Date(topic.roadmap_end_date!);
                  const days = Math.ceil((endD.getTime() - startD.getTime()) / 86400000);
                  return (
                    <div key={topic.id} className="flex items-center gap-3">
                      <div className="w-40 flex-shrink-0 truncate">
                        <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-strong)]">
                          <span className={cn("h-2 w-2 flex-shrink-0 rounded-full", topicColorDot(topic.color))} />
                          {topic.title}
                        </span>
                        <span className={cn("ml-3.5 text-[10px]", topicStatusBadge(topic.status))}>{topic.status}</span>
                      </div>
                      <div className="relative flex-1 h-7 rounded bg-[var(--bg-panel-2)]">
                        <div
                          className={cn("absolute top-1 bottom-1 rounded flex items-center px-2 text-[10px] font-semibold text-white overflow-hidden", topicColorDot(topic.color).replace("bg-", "bg-"))}
                          style={{ left: `${left}%`, width: `${width}%`, minWidth: 4 }}
                          title={`${topic.roadmap_start_date} → ${topic.roadmap_end_date} (${days}j)`}
                        >
                          <span className="truncate">{days}j</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {topicsWithoutDates.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-[var(--text-muted)]">Topics sans dates ({topicsWithoutDates.length})</h3>
          <div className="flex flex-wrap gap-2">
            {topicsWithoutDates.map((topic) => (
              <span key={topic.id} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium", topicColorClass(topic.color))}>
                <span className={cn("h-1.5 w-1.5 rounded-full", topicColorDot(topic.color))} />{topic.title}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Suivi Tab (container with sub-tabs) ─────────────────────────────────────

function SuiviTab({
  projectId, projectName, spaceId, spaceName, topics, tickets, documents, loadingTickets, ticketsError, onRetryTickets, subTab, onSetSubTab, autoOpenCreate, returnTo,
}: {
  projectId: string; projectName: string; spaceId: string; spaceName: string; topics: Topic[]; tickets: Ticket[]; documents: Document[]; loadingTickets: boolean; ticketsError?: string | null; onRetryTickets?: () => void;
  subTab: SuiviSubTabId; onSetSubTab: (tab: SuiviSubTabId) => void; autoOpenCreate?: "ticket" | "topic" | null; returnTo?: string | null;
}) {
  const doneCount = tickets.filter((ticket) => ticket.status === "done").length;
  const explicitBacklogCount = tickets.filter((ticket) => ticket.status === "backlog").length;
  const backlogCount = explicitBacklogCount > 0 ? explicitBacklogCount : Math.max(tickets.length - doneCount, 0);

  return (
    <div>
      {/* Sub-tab bar */}
      <div className="mb-5">
        <SpaceSuiviTabs
          activeTab={subTab}
          onChange={onSetSubTab}
          counts={{
            topics: topics.length,
            tasks: tickets.length,
            backlog: backlogCount,
          }}
        />
      </div>

      {/* Sub-tab content */}
      {subTab === "overview" && <OverviewSubTab projectId={projectId} projectName={projectName} spaceId={spaceId} spaceName={spaceName} topics={topics} tickets={tickets} onNavigate={onSetSubTab} />}
      {subTab === "topics" && <TopicsSubTab spaceId={spaceId} spaceName={spaceName} projectId={projectId} projectName={projectName} topics={topics} tickets={tickets} autoOpen={autoOpenCreate === "topic"} returnTo={returnTo} />}
      {subTab === "kanban" && <KanbanSubTab topics={topics} tickets={tickets} documents={documents} loadingTickets={loadingTickets} ticketsError={ticketsError} onRetryTickets={onRetryTickets} autoOpen={autoOpenCreate === "ticket"} returnTo={returnTo} />}
      {subTab === "tasks" && <TasksSubTab topics={topics} tickets={tickets} documents={documents} loadingTickets={loadingTickets} />}
      {subTab === "backlog" && <BacklogSubTab topics={topics} tickets={tickets} documents={documents} loadingTickets={loadingTickets} />}
      {subTab === "roadmap" && <RoadmapSubTab topics={topics} />}
    </div>
  );
}

// ─── Chat Tab — delegates to LetsChat ────────────────────────────────────────

// (ChatTab removed — replaced by the full LetsChat component)

// ─── Main Page ────────────────────────────────────────────────────────────────

export function SpacePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { projectSlug, spaceSlug } = useParams<{ projectSlug: string; spaceSlug: string }>();
  const { data: projects = [] } = useProjects();
  const project = useMemo(() => resolveEntityBySlug(projects, projectSlug), [projects, projectSlug]);
  const projectId = project?.id;
  const { data: spaces = [] } = useSpaces(projectId);
  const space = useMemo(() => resolveEntityBySlug(spaces, spaceSlug), [spaces, spaceSlug]);
  const spaceId = space?.id;
  const { data: topics = [] } = useTopics(spaceId);
  const {
    data: tickets = [],
    isLoading: loadingTickets,
    error: ticketsQueryError,
    refetch: refetchTickets,
  } = useTickets({ spaceId });
  const { data: documents = [] } = useDocuments({ spaceId });
  const spaceName = space?.name ?? "Espace";
  const blockedTickets = tickets.filter((ticket) => ticket.status === "blocked").length;
  const ticketsError = ticketsQueryError instanceof Error ? ticketsQueryError.message : ticketsQueryError ? "Impossible de charger les tickets." : null;
  const projectRef = { id: projectId ?? "", name: project?.name ?? projectSlug ?? "" };
  const spaceRef = { id: spaceId ?? "", name: space?.name ?? spaceSlug ?? "" };
  const requestedSuiviView = searchParams.get("view");
  const suiviSubTab: SuiviSubTabId = isSpaceSuiviView(requestedSuiviView) ? requestedSuiviView : "overview";
  const createParam = searchParams.get("create") as "ticket" | "topic" | null;
  const returnToParam = searchParams.get("returnTo");
  const setSidebarCollapsed = useUiStore((s: { setSidebarCollapsed: (v: boolean) => void }) => s.setSidebarCollapsed);

  useEffect(() => {
    setSidebarCollapsed(suiviSubTab === "kanban");
  }, [suiviSubTab, setSidebarCollapsed]);

  function setSuiviSubTab(tab: SuiviSubTabId) {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (tab === "overview") nextSearchParams.delete("view");
    else nextSearchParams.set("view", tab);
    setSearchParams(nextSearchParams, { replace: true });
  }

  useEffect(() => {
    if (!createParam && !returnToParam) return;
    const next = new URLSearchParams(searchParams);
    next.delete("create");
    next.delete("returnTo");
    setSearchParams(next, { replace: true });
  }, [createParam, returnToParam, searchParams, setSearchParams]);

  useEffect(() => {
    if (!projectId || !spaceId) return;
    if (!isLegacyEntitySlug(projectSlug) && !isLegacyEntitySlug(spaceSlug)) return;
    navigate(spaceSuiviPath(projectRef, spaceRef, suiviSubTab), { replace: true });
  }, [navigate, projectId, projectRef, projectSlug, spaceId, spaceRef, spaceSlug, suiviSubTab]);

  useEffect(() => {
    if (!requestedSuiviView || isSpaceSuiviView(requestedSuiviView)) return;
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete("view");
    setSearchParams(nextSearchParams, { replace: true });
  }, [requestedSuiviView, searchParams, setSearchParams]);

  const doneCount = tickets.filter((t: Ticket) => t.status === "done").length;
  const activeTopicsCount = topics.filter((topic) => topic.status === "active").length;
  const explicitBacklogCount = tickets.filter((ticket) => ticket.status === "backlog").length;
  const backlogCount = explicitBacklogCount > 0 ? explicitBacklogCount : Math.max(tickets.length - doneCount, 0);
  const openTicketsCount = tickets.filter((ticket) => ticket.status !== "done").length;

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[28px] border border-[var(--rule)] bg-[var(--paper)] shadow-[var(--shadow-sm)]">
        <div className="flex flex-col gap-8 px-6 py-6 lg:px-8 lg:py-8">
          <div className="flex flex-col gap-8 border-b border-[var(--rule)] pb-8 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-[820px]">
              <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-4)]">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
                  Espace actif
                </span>
                <span className="hidden h-px w-10 bg-[var(--rule)] md:block" />
                <span>{project?.name ?? "Portefeuille MePO"}</span>
              </div>

              <h1
                className="mt-5 max-w-[10ch] text-[54px] leading-[0.92] tracking-[-0.05em] text-[var(--ink)] md:text-[76px]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {spaceName}
              </h1>

              <p className="mt-5 max-w-[58ch] text-[15px] leading-7 text-[var(--ink-3)] md:text-[16px]">
                {space?.description?.trim() ||
                  "Un cockpit recentre sur les arbitrages, les sujets en mouvement et les points a debloquer plutot que sur une accumulation de cartes generiques."}
              </p>

              <div className="mt-5 flex flex-wrap gap-2.5">
                <span className="inline-flex items-center gap-2 rounded-full border border-[var(--rule)] bg-[var(--paper-2)] px-3 py-1.5 text-[12px] text-[var(--ink-3)]">
                  <span className="h-2 w-2 rounded-full bg-[var(--accent)] shadow-[0_0_0_4px_rgba(255,90,31,0.14)]" />
                  {activeTopicsCount} sujets actifs
                </span>
                <span className="inline-flex items-center rounded-full border border-[var(--rule)] bg-[var(--paper-2)] px-3 py-1.5 text-[12px] text-[var(--ink-3)]">
                  {openTicketsCount} taches ouvertes
                </span>
                <span className="inline-flex items-center rounded-full border border-[var(--rule)] bg-[var(--paper-2)] px-3 py-1.5 text-[12px] text-[var(--ink-3)]">
                  {documents.length} documents
                </span>
                {blockedTickets > 0 ? (
                  <span className="inline-flex items-center rounded-full border border-[rgba(var(--brand-rgb),0.16)] bg-[var(--accent-soft)] px-3 py-1.5 text-[12px] text-[var(--accent-deep)]">
                    {blockedTickets} blocages a arbitrer
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 xl:max-w-[340px] xl:justify-end">
              <Link
                to={spaceDocumentsPath(projectRef, spaceRef)}
                className="btn-secondary h-11 rounded-[12px] px-4 text-[12.5px]"
              >
                <FileText className="h-4 w-4" />
                Documents
              </Link>
              <Link
                to={spaceChatPath(projectRef, spaceRef)}
                className="btn-secondary h-11 rounded-[12px] px-4 text-[12.5px]"
              >
                <MessageSquareText className="h-4 w-4" />
                Let's Chat
              </Link>
              <button
                type="button"
                onClick={() => setSuiviSubTab("topics")}
                className="btn-primary h-11 rounded-[12px] px-4 text-[12.5px]"
              >
                <Layers className="h-4 w-4" />
                Ouvrir les topics
              </button>
            </div>
          </div>

          <div className="grid gap-px overflow-hidden rounded-[22px] border border-[var(--rule)] bg-[var(--rule)] xl:grid-cols-4">
            <button
              type="button"
              onClick={() => setSuiviSubTab("topics")}
              className="group flex min-h-[138px] flex-col justify-between bg-[var(--paper)] px-5 py-5 text-left transition hover:bg-[var(--paper-2)]"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-4)]">
                Topics
              </div>
              <div>
                <div
                  className="text-[50px] leading-none text-[var(--ink)]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {String(topics.length).padStart(2, "0")}
                </div>
                <div className="mt-3 text-[13px] leading-5 text-[var(--ink-3)]">
                  {activeTopicsCount} en mouvement dans cet espace
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSuiviSubTab("tasks")}
              className="group flex min-h-[138px] flex-col justify-between bg-[var(--paper)] px-5 py-5 text-left transition hover:bg-[var(--paper-2)]"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-4)]">
                Taches ouvertes
              </div>
              <div>
                <div
                  className="text-[50px] leading-none text-[var(--ink)]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {String(openTicketsCount).padStart(2, "0")}
                </div>
                <div className="mt-3 text-[13px] leading-5 text-[var(--ink-3)]">
                  {doneCount} terminees sur {tickets.length}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSuiviSubTab("backlog")}
              className="group flex min-h-[138px] flex-col justify-between bg-[var(--paper)] px-5 py-5 text-left transition hover:bg-[var(--paper-2)]"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-4)]">
                Backlog
              </div>
              <div>
                <div
                  className="text-[50px] leading-none text-[var(--accent-deep)]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {String(backlogCount).padStart(2, "0")}
                </div>
                <div className="mt-3 text-[13px] leading-5 text-[var(--ink-3)]">
                  {blockedTickets > 0 ? `${blockedTickets} point${blockedTickets > 1 ? "s" : ""} a arbitrer` : "File priorisee prete a etre tiree"}
                </div>
              </div>
            </button>

            <Link
              to={spaceDocumentsPath(projectRef, spaceRef)}
              className="group flex min-h-[138px] flex-col justify-between bg-[var(--paper)] px-5 py-5 text-left transition hover:bg-[var(--paper-2)]"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-4)]">
                Documents
              </div>
              <div>
                <div
                  className="text-[50px] leading-none text-[var(--ink)]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {String(documents.length).padStart(2, "0")}
                </div>
                <div className="mt-3 text-[13px] leading-5 text-[var(--ink-3)]">
                  Specs, notes et contexte rattaches a l'espace
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      <div className="hidden">
      {/* ── Page header ─────────────────────────────────────────── */}
            {blockedTickets > 0 ? <span className="badge badge-danger">{blockedTickets} bloqués</span> : null}

      {/* ── Compact metric strip (remplace les 4 KpiCards) ──────── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <button type="button" onClick={() => setSuiviSubTab("topics")} className="text-left">
          <StatCard label="Topics" value={topics.length} hint="unités de pilotage" tone="brand" icon={<Layers className="h-4 w-4" />} />
        </button>
        <button type="button" onClick={() => setSuiviSubTab("backlog")} className="text-left">
          <StatCard label="Backlog" value={tickets.length} hint={`${doneCount} terminés`} tone="warning" icon={<Table2 className="h-4 w-4" />} />
        </button>
        <button type="button" onClick={() => setSuiviSubTab("backlog")} className="text-left">
          <StatCard label="Bloqués" value={blockedTickets} hint="tickets à traiter" tone={blockedTickets > 0 ? "danger" : "neutral"} icon={<AlertTriangle className="h-4 w-4" />} />
        </button>
        <Link to={spaceDocumentsPath(projectRef, spaceRef)} className="text-left">
          <StatCard label="Documents" value={documents.length} hint="contexte disponible" tone="violet" icon={<FileText className="h-4 w-4" />} />
        </Link>
      </div>

      </div>

      <SuiviTab
        projectId={projectId!}
        projectName={project?.name ?? "Projet"}
        spaceId={spaceId!}
        spaceName={spaceName}
        topics={topics}
        tickets={tickets}
        documents={documents}
        loadingTickets={loadingTickets}
        ticketsError={ticketsError}
        onRetryTickets={() => { void refetchTickets(); }}
        subTab={suiviSubTab}
        onSetSubTab={setSuiviSubTab}
        autoOpenCreate={createParam}
        returnTo={returnToParam}
      />
    </div>
  );
}
