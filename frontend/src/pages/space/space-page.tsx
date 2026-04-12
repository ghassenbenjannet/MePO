import type { Dispatch, SetStateAction } from "react";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  FileText,
  FolderKanban,
  Layers,
  Loader2,
  Map,
  MessageSquareText,
  Pencil,
  Plus,
  Send,
  Sparkles,
  Table2,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { DocumentsTab } from "../../components/documents/documents-tab";
import { useDocuments } from "../../hooks/use-documents";
import { useSpace } from "../../hooks/use-spaces";
import { useCreateTicket, useTickets, useUpdateTicket } from "../../hooks/use-tickets";
import { useCreateTopic, useTopics, useUpdateTopic } from "../../hooks/use-topics";
import { cn } from "../../lib/utils";
import type { Document, Ticket, Topic } from "../../types/domain";

// ─── Types ───────────────────────────────────────────────────────────────────

type MainTabId = "suivi" | "documents" | "chat";
type SuiviSubTabId = "overview" | "topics" | "kanban" | "backlog" | "roadmap";

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

const MAIN_TABS = [
  { id: "suivi" as MainTabId, label: "1 - Suivi", icon: FolderKanban },
  { id: "documents" as MainTabId, label: "2 - Documents", icon: FileText },
  { id: "chat" as MainTabId, label: "3 - Let's Chat", icon: MessageSquareText },
];

const SUIVI_SUBTABS = [
  { id: "overview" as SuiviSubTabId, label: "Vue d'ensemble", icon: BarChart3 },
  { id: "topics" as SuiviSubTabId, label: "Topics", icon: Layers },
  { id: "kanban" as SuiviSubTabId, label: "Kanban", icon: FolderKanban },
  { id: "backlog" as SuiviSubTabId, label: "Backlog", icon: Table2 },
  { id: "roadmap" as SuiviSubTabId, label: "Roadmap", icon: Map },
];

const KANBAN_COLS = [
  { id: "backlog", label: "Backlog", color: "text-[var(--text-muted)]", dot: "bg-slate-400" },
  { id: "todo", label: "À faire", color: "text-brand-500", dot: "bg-brand-500" },
  { id: "in_progress", label: "En cours", color: "text-warn-500", dot: "bg-warn-500" },
  { id: "review", label: "Revue", color: "text-sky-600", dot: "bg-sky-500" },
  { id: "done", label: "Terminé", color: "text-accent-500", dot: "bg-accent-500" },
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
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800",
  blue: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  rose: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
  violet: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800",
  cyan: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800",
  orange: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800",
  lime: "bg-lime-50 text-lime-700 border-lime-200 dark:bg-lime-950/40 dark:text-lime-300 dark:border-lime-800",
  slate: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
};

const TOPIC_COLOR_DOT: Record<string, string> = {
  indigo: "bg-indigo-500",
  blue: "bg-blue-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  violet: "bg-violet-500",
  cyan: "bg-cyan-500",
  orange: "bg-orange-500",
  lime: "bg-lime-500",
  slate: "bg-slate-500",
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
  if (status === "active") return "bg-accent-500/15 text-accent-500";
  if (status === "blocked") return "bg-danger-500/15 text-danger-500";
  if (status === "done") return "bg-slate-500/15 text-slate-500";
  return "bg-[var(--bg-panel-2)] text-[var(--text-muted)]";
}

function buildDefaultPatternForm(): TicketPatternForm {
  return {
    object_under_test: "", behavior_observed: "", expected_behavior: "", reproduction_steps: "",
    environment: "", severity: "", impact: "", business_need: "", objective: "", business_rules: "",
    scope: "", out_of_scope: "", risks: "", open_points: "", operational_goal: "", task_to_do: "",
    prerequisites: "", expected_result: "", definition_of_done: "", subject_to_analyze: "",
    problem: "", hypotheses: "", known_elements: "", unknowns: "", points_to_investigate: "",
    stakeholders: "", expected_decision: "", expected_deliverable: "", test_scope: "", scenarios: "",
    expected_results: "", test_data: "", test_status: "", raised_issues: "",
  };
}

function readPatternForm(details: Record<string, unknown> | undefined): TicketPatternForm {
  const defaults = buildDefaultPatternForm();
  if (!details) return defaults;
  return Object.fromEntries(
    Object.keys(defaults).map((key) => [key, typeof details[key] === "string" ? String(details[key]) : ""])
  ) as TicketPatternForm;
}

function textAreaValueToList(value: string) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 p-4 backdrop-blur-sm">
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
  if (type === "bug") return <div className="grid gap-4 md:grid-cols-2">{ta("object_under_test","Contexte / module")}{ta("environment","Environnement")}{ta("behavior_observed","Comportement observé")}{ta("expected_behavior","Comportement attendu")}{ta("reproduction_steps","Étapes de reproduction")}{ta("severity","Sévérité")}{ta("impact","Impact")}</div>;
  if (type === "feature") return <div className="grid gap-4 md:grid-cols-2">{ta("business_need","Besoin métier")}{ta("objective","Objectif")}{ta("business_rules","Règles métier")}{ta("scope","Périmètre")}{ta("out_of_scope","Hors périmètre")}{ta("risks","Risques")}{ta("open_points","Points ouverts")}</div>;
  if (type === "analysis") return <div className="grid gap-4 md:grid-cols-2">{ta("subject_to_analyze","Sujet à analyser")}{ta("problem","Problème / question")}{ta("hypotheses","Hypothèses")}{ta("known_elements","Éléments connus")}{ta("unknowns","Zones floues")}{ta("points_to_investigate","Points à investiguer")}{ta("stakeholders","Parties prenantes")}{ta("expected_decision","Décision attendue")}{ta("expected_deliverable","Livrable attendu")}</div>;
  if (type === "test") return <div className="grid gap-4 md:grid-cols-2">{ta("object_under_test","Objet testé")}{ta("test_scope","Périmètre de test")}{ta("prerequisites","Prérequis")}{ta("scenarios","Scénarios")}{ta("expected_results","Résultats attendus")}{ta("test_data","Données de test")}{ta("test_status","Statut recette")}{ta("raised_issues","Anomalies remontées")}</div>;
  return <div className="grid gap-4 md:grid-cols-2">{ta("operational_goal","Objectif opérationnel")}{ta("task_to_do","Tâche à réaliser")}{ta("prerequisites","Prérequis")}{ta("expected_result","Résultat attendu")}{ta("definition_of_done","Définition de fini")}</div>;
}

// ─── Ticket Modal ─────────────────────────────────────────────────────────────

function TicketModal({ topics, documents, ticket, defaultTopicId, onClose }: { topics: Topic[]; documents: Document[]; ticket?: Ticket; defaultTopicId?: string; onClose: () => void }) {
  const { mutateAsync: createTicket, isPending: creating } = useCreateTicket();
  const { mutateAsync: updateTicket, isPending: updating } = useUpdateTicket();
  const [topicId, setTopicId] = useState(ticket?.topic_id ?? defaultTopicId ?? topics[0]?.id ?? "");
  const [type, setType] = useState(ticket?.type ?? "feature");
  const [title, setTitle] = useState(ticket?.title ?? "");
  const [description, setDescription] = useState(ticket?.description ?? "");
  const [status, setStatus] = useState(ticket?.status ?? "backlog");
  const [priority, setPriority] = useState(ticket?.priority ?? "medium");
  const [assignee, setAssignee] = useState(ticket?.assignee ?? "");
  const [reporter, setReporter] = useState(ticket?.reporter ?? "");
  const [tags, setTags] = useState((ticket?.tags ?? []).join(", "));
  const [acceptanceCriteria, setAcceptanceCriteria] = useState((ticket?.acceptance_criteria ?? []).join("\n"));
  const [dueDate, setDueDate] = useState(ticket?.due_date ?? "");
  const [estimate, setEstimate] = useState(ticket?.estimate?.toString() ?? "");
  const [dependencies, setDependencies] = useState((ticket?.dependencies ?? []).join("\n"));
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
      description: description.trim() || null,
      status, priority,
      assignee: assignee.trim() || null,
      reporter: reporter.trim() || null,
      tags: tags.split(",").map((item) => item.trim()).filter(Boolean),
      acceptance_criteria: textAreaValueToList(acceptanceCriteria),
      due_date: dueDate || null,
      estimate: estimate ? Number(estimate) : null,
      dependencies: textAreaValueToList(dependencies),
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-panel)] px-6 py-4">
          <h2 className="text-base font-semibold text-[var(--text-strong)]">{ticket ? "Modifier le ticket" : "Créer un ticket"}</h2>
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-[var(--text-muted)] transition hover:bg-[var(--bg-panel-2)]">Fermer</button>
        </div>
        <form onSubmit={submit} className="p-6">
          <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Titre *</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className={fieldCls} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} className={cn(fieldCls, "resize-none")} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Critères d'acceptation</label>
                  <textarea value={acceptanceCriteria} onChange={(e) => setAcceptanceCriteria(e.target.value)} rows={5} placeholder="Un critère par ligne" className={cn(fieldCls, "resize-none")} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Dépendances</label>
                  <textarea value={dependencies} onChange={(e) => setDependencies(e.target.value)} rows={5} placeholder="Une dépendance par ligne" className={cn(fieldCls, "resize-none")} />
                </div>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] p-4">
                <p className="text-sm font-semibold text-[var(--text-strong)]">Pattern du ticket</p>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">Le formulaire spécialisé s'adapte au type de ticket.</p>
                <div className="mt-4"><TicketPatternFields type={type} form={patternForm} setForm={setPatternForm} /></div>
              </div>
            </div>
            <aside className="space-y-4">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] p-4 space-y-4">
                <p className="text-sm font-semibold text-[var(--text-strong)]">Configuration</p>
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
              {documents.length > 0 && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] p-4">
                  <p className="mb-3 text-sm font-semibold text-[var(--text-strong)]">Documentation liée</p>
                  <div className="space-y-2">
                    {documents.map((doc) => (
                      <label key={doc.id} className="flex items-start gap-2 text-sm text-[var(--text-strong)]">
                        <input type="checkbox" checked={linkedDocumentIds.includes(doc.id)} onChange={(e) => setLinkedDocumentIds((s) => e.target.checked ? [...s, doc.id] : s.filter((item) => item !== doc.id))} className="mt-1 h-4 w-4 rounded border-[var(--border)]" />
                        <span className="text-xs">{doc.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </div>
          {errorMessage ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div> : null}
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] px-4 py-2 text-sm font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-panel)]">Annuler</button>
            <button type="submit" disabled={isPending || !title.trim() || !topicId} className="btn-primary disabled:opacity-60">
              {isPending ? "Enregistrement..." : ticket ? "Enregistrer" : "Créer le ticket"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Sub-tab: Vue d'ensemble ──────────────────────────────────────────────────

function OverviewSubTab({
  projectId, spaceId, topics, tickets, onNavigate,
}: {
  projectId: string; spaceId: string; topics: Topic[]; tickets: Ticket[];
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

  const blockedTickets = useMemo(() => tickets.filter((t) => t.status === "blocked"), [tickets]);

  const recentTickets = useMemo(() => [...tickets].sort((a, b) => {
    const da = a.updated_at ? new Date(a.updated_at).getTime() : 0;
    const db = b.updated_at ? new Date(b.updated_at).getTime() : 0;
    return db - da;
  }).slice(0, 5), [tickets]);

  const kpis = [
    { label: "Total tickets", value: tickets.length, icon: Table2, color: "text-brand-500", bg: "bg-brand-500/10" },
    { label: "En cours", value: statsByStatus.in_progress, icon: FolderKanban, color: "text-warn-500", bg: "bg-warn-500/10" },
    { label: "Terminés", value: statsByStatus.done, icon: CheckCircle2, color: "text-accent-500", bg: "bg-accent-500/10" },
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

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
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
                          <Link to={`/projects/${projectId}/spaces/${spaceId}/topics/${topic.id}`} className="text-sm font-semibold text-[var(--text-strong)] transition hover:text-brand-500">{topic.title}</Link>
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

          {/* Recent tickets */}
          {recentTickets.length > 0 && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[var(--text-strong)]">Activité récente</h2>
                <button onClick={() => onNavigate("backlog")} className="text-xs text-brand-500 transition hover:underline">Voir tout →</button>
              </div>
              <div className="card overflow-hidden">
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

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Status distribution */}
          <div className="card p-4">
            <h3 className="mb-3 text-sm font-semibold text-[var(--text-strong)]">Répartition par statut</h3>
            <div className="space-y-2">
              {KANBAN_COLS.map((col) => {
                const count = statsByStatus[col.id] ?? 0;
                const pct = tickets.length > 0 ? Math.round((count / tickets.length) * 100) : 0;
                return (
                  <div key={col.id} className="flex items-center gap-3">
                    <span className={cn("w-16 text-xs font-medium", col.color)}>{col.label}</span>
                    <div className="flex-1 rounded-full bg-[var(--bg-panel-2)] h-1.5">
                      <div className={cn("h-1.5 rounded-full", col.dot)} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-6 text-right text-xs text-[var(--text-muted)]">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Blocked tickets */}
          {blockedTickets.length > 0 && (
            <div className="card border-danger-500/30 p-4">
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-danger-500" />
                <h3 className="text-sm font-semibold text-danger-500">Tickets bloqués ({blockedTickets.length})</h3>
              </div>
              <div className="space-y-2">
                {blockedTickets.map((ticket) => {
                  const topic = topicMap[ticket.topic_id];
                  return (
                    <div key={ticket.id} className="rounded-lg border border-danger-500/20 bg-danger-500/5 px-3 py-2">
                      <p className="text-xs font-medium text-[var(--text-strong)]">{ticket.title}</p>
                      {topic && <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{topic.title}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div className="card p-4">
            <h3 className="mb-3 text-sm font-semibold text-[var(--text-strong)]">Accès rapide</h3>
            <div className="space-y-1">
              {SUIVI_SUBTABS.filter((t) => t.id !== "overview").map((tab) => (
                <button key={tab.id} onClick={() => onNavigate(tab.id)} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[var(--text-muted)] transition hover:bg-[var(--bg-panel-2)] hover:text-[var(--text-strong)]">
                  <tab.icon className="h-4 w-4" />{tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-tab: Topics ──────────────────────────────────────────────────────────

function TopicsSubTab({ spaceId, projectId, topics, tickets }: { spaceId: string; projectId: string; topics: Topic[]; tickets: Ticket[] }) {
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);

  const ticketCountByTopic = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of tickets) map[t.topic_id] = (map[t.topic_id] ?? 0) + 1;
    return map;
  }, [tickets]);

  return (
    <div>
      {showTopicModal && <TopicModal spaceId={spaceId} topic={editingTopic ?? undefined} onClose={() => { setShowTopicModal(false); setEditingTopic(null); }} />}

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
              <div key={topic.id} className="card flex flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={cn("h-3 w-3 flex-shrink-0 rounded-full", topicColorDot(topic.color))} />
                    <Link to={`/projects/${projectId}/spaces/${spaceId}/topics/${topic.id}`} className="truncate text-sm font-semibold text-[var(--text-strong)] transition hover:text-brand-500">
                      {topic.title}
                    </Link>
                  </div>
                  <button type="button" onClick={() => { setEditingTopic(topic); setShowTopicModal(true); }}
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] transition hover:bg-[var(--bg-panel-2)] hover:text-brand-500">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", topicColorClass(topic.color))}>{topicNatureLabel(topic.topic_nature)}</span>
                  <span className={cn("badge text-[10px]", topicStatusBadge(topic.status))}>{topic.status}</span>
                  <span className={cn("badge text-[10px]", priorityBadge(topic.priority))}>{topic.priority}</span>
                </div>

                {topic.description && <p className="line-clamp-2 text-xs text-[var(--text-muted)]">{topic.description}</p>}

                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-3 text-xs text-[var(--text-muted)]">
                  <span className="flex items-center gap-1"><Table2 className="h-3.5 w-3.5" />{count} ticket{count !== 1 ? "s" : ""}</span>
                  {topic.risks.length > 0 && <span className="flex items-center gap-1 text-danger-500"><AlertTriangle className="h-3.5 w-3.5" />{topic.risks.length} risque{topic.risks.length > 1 ? "s" : ""}</span>}
                  {topic.open_questions.length > 0 && <span>{topic.open_questions.length} question{topic.open_questions.length > 1 ? "s" : ""}</span>}
                </div>

                {topic.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {topic.tags.slice(0, 4).map((tag) => (
                      <span key={tag} className="rounded-full bg-[var(--bg-panel-2)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">#{tag}</span>
                    ))}
                    {topic.tags.length > 4 && <span className="rounded-full bg-[var(--bg-panel-2)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">+{topic.tags.length - 4}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Sub-tab: Kanban ──────────────────────────────────────────────────────────

function KanbanSubTab({ spaceId, topics, tickets, documents, loadingTickets }: { spaceId: string; topics: Topic[]; tickets: Ticket[]; documents: Document[]; loadingTickets: boolean }) {
  const { mutateAsync: updateTicket } = useUpdateTicket();
  const [topicFilter, setTopicFilter] = useState("all");
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [draggingTicketId, setDraggingTicketId] = useState<string | null>(null);

  const filteredTickets = useMemo(() => topicFilter === "all" ? tickets : tickets.filter((t) => t.topic_id === topicFilter), [tickets, topicFilter]);
  const topicMap = useMemo(() => Object.fromEntries(topics.map((t) => [t.id, t])), [topics]);

  return (
    <div>
      {showTicketModal && <TicketModal topics={topics} documents={documents} ticket={editingTicket ?? undefined} defaultTopicId={topicFilter !== "all" ? topicFilter : topics[0]?.id} onClose={() => { setShowTicketModal(false); setEditingTicket(null); }} />}

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
        <div className="flex items-center gap-2 py-8 text-sm text-[var(--text-muted)]"><Loader2 className="h-4 w-4 animate-spin" />Chargement...</div>
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

function BacklogSubTab({ topics, tickets, documents, loadingTickets }: { topics: Topic[]; tickets: Ticket[]; documents: Document[]; loadingTickets: boolean }) {
  const { mutateAsync: updateTicket } = useUpdateTicket();
  const [topicFilter, setTopicFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);

  const topicMap = useMemo(() => Object.fromEntries(topics.map((t) => [t.id, t])), [topics]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (topicFilter !== "all" && t.topic_id !== topicFilter) return false;
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      return true;
    });
  }, [tickets, topicFilter, typeFilter, statusFilter]);

  return (
    <div>
      {showTicketModal && <TicketModal topics={topics} documents={documents} ticket={editingTicket ?? undefined} defaultTopicId={topicFilter !== "all" ? topicFilter : topics[0]?.id} onClose={() => { setShowTicketModal(false); setEditingTicket(null); }} />}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select value={topicFilter} onChange={(e) => setTopicFilter(e.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] px-3 py-1.5 text-xs text-[var(--text-strong)] outline-none transition focus:border-brand-500">
            <option value="all">Tous les topics</option>
            {topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] px-3 py-1.5 text-xs text-[var(--text-strong)] outline-none transition focus:border-brand-500">
            <option value="all">Tous les types</option>
            {TICKET_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] px-3 py-1.5 text-xs text-[var(--text-strong)] outline-none transition focus:border-brand-500">
            <option value="all">Tous les statuts</option>
            {KANBAN_COLS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <span className="text-xs text-[var(--text-muted)]">{filteredTickets.length} résultat{filteredTickets.length !== 1 ? "s" : ""}</span>
        </div>
        <button onClick={() => { setEditingTicket(null); setShowTicketModal(true); }} disabled={topics.length === 0} className="btn-primary disabled:opacity-60">
          <Plus className="h-4 w-4" />Nouveau ticket
        </button>
      </div>

      {loadingTickets ? (
        <div className="flex items-center gap-2 py-8 text-sm text-[var(--text-muted)]"><Loader2 className="h-4 w-4 animate-spin" />Chargement...</div>
      ) : filteredTickets.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-[var(--border)] py-12 text-center">
          <Table2 className="h-8 w-8 text-[var(--text-muted)]" />
          <p className="text-sm text-[var(--text-muted)]">Aucun ticket ne correspond à ces filtres.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg-panel-2)]">
                {["ID", "Topic", "Type", "Titre", "Statut", "Priorité", "Assigné", "Action"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredTickets.map((ticket) => {
                const topic = topicMap[ticket.topic_id];
                return (
                  <tr key={ticket.id} className="border-b border-[var(--border)] last:border-0 transition hover:bg-[var(--bg-panel-2)]">
                    <td className="px-4 py-3 font-mono text-[10px] text-[var(--text-muted)]">{ticket.id}</td>
                    <td className="px-4 py-3">
                      {topic ? (
                        <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold", topicColorClass(topic.color))}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", topicColorDot(topic.color))} />{topic.title}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="badge bg-[var(--bg-panel-2)] text-[10px] text-[var(--text-muted)]">{ticketTypeLabel(ticket.type)}</span>
                    </td>
                    <td className="max-w-[240px] px-4 py-3">
                      <p className="truncate text-xs font-medium text-[var(--text-strong)]">{ticket.title}</p>
                      {ticket.assignee && <p className="text-[10px] text-[var(--text-muted)]">{ticket.assignee}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={ticket.status}
                        onChange={(e) => updateTicket({ id: ticket.id, status: e.target.value })}
                        className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel-2)] px-2 py-1 text-[10px] text-[var(--text-strong)] outline-none transition focus:border-brand-500"
                      >
                        {KANBAN_COLS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("badge text-[10px]", priorityBadge(ticket.priority))}>{ticket.priority}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--text-muted)]">{ticket.assignee ?? "—"}</td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => { setEditingTicket(ticket); setShowTicketModal(true); }}
                        className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1 text-[10px] text-[var(--text-muted)] transition hover:border-brand-500/40 hover:text-brand-500">
                        <Pencil className="h-3 w-3" />Modifier
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Sub-tab: Roadmap ─────────────────────────────────────────────────────────

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
  projectId, spaceId, topics, tickets, documents, loadingTickets,
}: {
  projectId: string; spaceId: string; topics: Topic[]; tickets: Ticket[]; documents: Document[]; loadingTickets: boolean;
}) {
  const [subTab, setSubTab] = useState<SuiviSubTabId>("overview");

  return (
    <div>
      {/* Sub-tab bar */}
      <div className="mb-5 flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] p-1">
        {SUIVI_SUBTABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition",
              subTab === tab.id
                ? "bg-[var(--bg-panel)] text-[var(--text-strong)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-strong)]",
            )}
          >
            <tab.icon className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      {subTab === "overview" && <OverviewSubTab projectId={projectId} spaceId={spaceId} topics={topics} tickets={tickets} onNavigate={setSubTab} />}
      {subTab === "topics" && <TopicsSubTab spaceId={spaceId} projectId={projectId} topics={topics} tickets={tickets} />}
      {subTab === "kanban" && <KanbanSubTab spaceId={spaceId} topics={topics} tickets={tickets} documents={documents} loadingTickets={loadingTickets} />}
      {subTab === "backlog" && <BacklogSubTab topics={topics} tickets={tickets} documents={documents} loadingTickets={loadingTickets} />}
      {subTab === "roadmap" && <RoadmapSubTab topics={topics} />}
    </div>
  );
}

// ─── Chat Tab ─────────────────────────────────────────────────────────────────

const SUGGESTIONS = ["Résume le backlog de cet espace", "Génère un ticket pour un sujet", "Analyse les tickets bloqués", "Crée un plan de recette", "Mets à jour la mémoire topic"];

function ChatTab({ spaceName, topics, tickets }: { spaceName: string; topics: Topic[]; tickets: Ticket[] }) {
  const [input, setInput] = useState("");
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
      <div className="card flex flex-col overflow-hidden">
        <div className="flex-1 space-y-4 p-5" style={{ minHeight: 380 }}>
          <div className="flex gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 text-xs font-bold text-white">SP</div>
            <div className="max-w-lg rounded-xl rounded-tl-none bg-[var(--bg-panel-2)] px-4 py-3">
              <p className="text-xs font-semibold text-brand-500">Shadow PO</p>
              <p className="mt-1 text-sm leading-6 text-[var(--text-strong)]">Bonjour ! Je suis prêt à t'assister sur l'espace <strong>{spaceName}</strong>. J'ai accès à <strong>{tickets.length} tickets</strong> et <strong>{topics.length} topics</strong>. Que veux-tu accomplir ?</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pl-11">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => setInput(s)} className="rounded-full border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 py-1 text-xs text-[var(--text-muted)] transition hover:border-brand-500/50 hover:text-brand-500">{s}</button>
            ))}
          </div>
        </div>
        <div className="border-t border-[var(--border)] p-3">
          <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 py-2 transition focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20">
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Dis-moi ce que tu veux créer ou analyser..." className="flex-1 bg-transparent text-sm text-[var(--text-strong)] outline-none placeholder:text-[var(--text-muted)]" />
            <button disabled={!input.trim()} className="btn-primary disabled:opacity-40"><Send className="h-3.5 w-3.5" />Envoyer</button>
          </div>
          <p className="mt-1.5 text-center text-xs text-[var(--text-muted)]">LLM fait maison</p>
        </div>
      </div>
      <div className="space-y-3">
        <div className="card p-4">
          <div className="mb-3 flex items-center gap-2"><Sparkles className="h-4 w-4 text-brand-500" /><p className="text-sm font-bold text-[var(--text-strong)]">Contexte actif</p></div>
          <div className="space-y-3">
            {[{ label: "Espace", value: spaceName }, { label: "Topics", value: `${topics.length} actifs` }, { label: "Tickets", value: `${tickets.length} total` }].map((row) => (
              <div key={row.label}>
                <p className="section-title">{row.label}</p>
                <p className="mt-0.5 text-sm font-medium text-[var(--text-strong)]">{row.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function SpacePage() {
  const { projectId, spaceId } = useParams<{ projectId: string; spaceId: string }>();
  const [activeTab, setActiveTab] = useState<MainTabId>("suivi");
  const { data: space } = useSpace(spaceId);
  const { data: topics = [] } = useTopics(spaceId);
  const { data: tickets = [], isLoading: loadingTickets } = useTickets({ spaceId });
  const { data: documents = [] } = useDocuments({ spaceId });
  const spaceName = space?.name ?? "Espace";

  return (
    <div className="mx-auto max-w-full space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="section-title">Espace</p>
          <h1 className="mt-0.5 text-xl font-bold text-[var(--text-strong)]">{spaceName}</h1>
          {space?.description && <p className="mt-0.5 text-sm text-[var(--text-muted)]">{space.description}</p>}
        </div>
        <button onClick={() => setActiveTab("chat")} className="btn-primary flex-shrink-0">
          <Sparkles className="h-4 w-4" />Let's Chat
        </button>
      </div>

      {/* Main tab bar */}
      <div className="flex border-b border-[var(--border)]">
        {MAIN_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-medium transition",
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
        {activeTab === "suivi" && <SuiviTab projectId={projectId!} spaceId={spaceId!} topics={topics} tickets={tickets} documents={documents} loadingTickets={loadingTickets} />}
        {activeTab === "documents" && <DocumentsTab spaceId={spaceId!} topics={topics} />}
        {activeTab === "chat" && <ChatTab spaceName={spaceName} topics={topics} tickets={tickets} />}
      </div>
    </div>
  );
}
