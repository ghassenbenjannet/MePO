import type { Dispatch, FormEvent, SetStateAction } from "react";
import { useState } from "react";
import { useCreateTicket, useUpdateTicket } from "../../hooks/use-tickets";
import { cn } from "../../lib/utils";
import type { Document, Ticket, Topic } from "../../types/domain";
import {
  MiniTiptap,
  linesToTiptapHtml,
  textToTiptapHtml,
  tiptapHtmlToLines,
  tiptapHtmlToText,
} from "../ui/mini-tiptap";

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

const KANBAN_COLS = [
  { id: "backlog", label: "Backlog" },
  { id: "todo", label: "A faire" },
  { id: "in_progress", label: "En cours" },
  { id: "review", label: "Revue" },
  { id: "done", label: "Termine" },
  { id: "blocked", label: "Bloque" },
] as const;

const TICKET_TYPES = [
  { value: "feature", label: "Feature / Evolution" },
  { value: "bug", label: "Bug" },
  { value: "task", label: "Task" },
  { value: "analysis", label: "Etude / Analyse" },
  { value: "test", label: "Recette / Test" },
];

const PRIORITIES = ["low", "medium", "high", "critical"];

const fieldCls =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] px-3 py-2.5 text-sm text-[var(--text-strong)] outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";

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

function readPatternForm(details: Record<string, unknown> | null | undefined): TicketPatternForm {
  const defaults = buildDefaultPatternForm();
  if (!details) return defaults;
  return Object.fromEntries(
    Object.keys(defaults).map((key) => [key, typeof details[key] === "string" ? String(details[key]) : ""]),
  ) as TicketPatternForm;
}

function TicketPatternFields({
  type,
  form,
  setForm,
}: {
  type: string;
  form: TicketPatternForm;
  setForm: Dispatch<SetStateAction<TicketPatternForm>>;
}) {
  function updateField(field: keyof TicketPatternForm, value: string) {
    setForm((state) => ({ ...state, [field]: value }));
  }

  function textArea(field: keyof TicketPatternForm, label: string) {
    return (
      <div key={field}>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          {label}
        </label>
        <textarea
          value={form[field]}
          onChange={(event) => updateField(field, event.target.value)}
          rows={3}
          className={cn(fieldCls, "resize-none")}
        />
      </div>
    );
  }

  if (type === "bug") {
    return (
      <div className="space-y-4">
        {textArea("object_under_test", "Contexte / module")}
        {textArea("environment", "Environnement")}
        {textArea("behavior_observed", "Comportement observe")}
        {textArea("expected_behavior", "Comportement attendu")}
        {textArea("reproduction_steps", "Etapes de reproduction")}
        {textArea("severity", "Severite")}
        {textArea("impact", "Impact")}
      </div>
    );
  }

  if (type === "feature") {
    return (
      <div className="space-y-4">
        {textArea("business_need", "Besoin metier")}
        {textArea("objective", "Objectif")}
        {textArea("business_rules", "Regles metier")}
        {textArea("scope", "Perimetre")}
        {textArea("out_of_scope", "Hors perimetre")}
        {textArea("risks", "Risques")}
        {textArea("open_points", "Points ouverts")}
      </div>
    );
  }

  if (type === "analysis") {
    return (
      <div className="space-y-4">
        {textArea("subject_to_analyze", "Sujet a analyser")}
        {textArea("problem", "Probleme / question")}
        {textArea("hypotheses", "Hypotheses")}
        {textArea("known_elements", "Elements connus")}
        {textArea("unknowns", "Zones floues")}
        {textArea("points_to_investigate", "Points a investiguer")}
        {textArea("stakeholders", "Parties prenantes")}
        {textArea("expected_decision", "Decision attendue")}
        {textArea("expected_deliverable", "Livrable attendu")}
      </div>
    );
  }

  if (type === "test") {
    return (
      <div className="space-y-4">
        {textArea("object_under_test", "Objet teste")}
        {textArea("test_scope", "Perimetre de test")}
        {textArea("prerequisites", "Prerequis")}
        {textArea("scenarios", "Scenarios")}
        {textArea("expected_results", "Resultats attendus")}
        {textArea("test_data", "Donnees de test")}
        {textArea("test_status", "Statut recette")}
        {textArea("raised_issues", "Anomalies remontees")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {textArea("operational_goal", "Objectif operationnel")}
      {textArea("task_to_do", "Tache a realiser")}
      {textArea("prerequisites", "Prerequis")}
      {textArea("expected_result", "Resultat attendu")}
      {textArea("definition_of_done", "Definition de fini")}
    </div>
  );
}

export function TicketModal({
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
  const [patternForm, setPatternForm] = useState(readPatternForm(ticket?.ticket_details ?? undefined));
  const [errorMessage, setErrorMessage] = useState("");
  const isPending = creating || updating;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setErrorMessage("");

    const payload = {
      topic_id: topicId,
      type,
      title: title.trim(),
      description: tiptapHtmlToText(descriptionHtml) || null,
      status,
      priority,
      assignee: assignee.trim() || null,
      reporter: reporter.trim() || null,
      tags: tags
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
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
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-panel)] px-6 py-4">
          <h2 className="text-base font-semibold text-[var(--text-strong)]">
            {ticket ? "Modifier le ticket" : "Creer un ticket"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-[var(--text-muted)] transition hover:bg-[var(--bg-panel-2)]"
          >
            Fermer
          </button>
        </div>

        <form onSubmit={submit} className="p-6">
          <div className="grid items-start gap-6 lg:grid-cols-[1fr_300px]">
            <div className="space-y-5">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Titre *
                </label>
                <input value={title} onChange={(event) => setTitle(event.target.value)} className={fieldCls} />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Description
                </label>
                <MiniTiptap
                  content={descriptionHtml}
                  onChange={setDescriptionHtml}
                  placeholder="Decrivez le ticket..."
                  minHeight="120px"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Criteres d'acceptation
                </label>
                <MiniTiptap
                  content={criteriaHtml}
                  onChange={setCriteriaHtml}
                  placeholder="Un critere par item de liste..."
                  minHeight="100px"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Dependances
                </label>
                <MiniTiptap
                  content={dependenciesHtml}
                  onChange={setDependenciesHtml}
                  placeholder="Une dependance par item de liste..."
                  minHeight="80px"
                />
              </div>

              {errorMessage && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {errorMessage}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] px-4 py-2 text-sm font-medium text-[var(--text-strong)] transition hover:bg-[var(--bg-panel)]"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isPending || !title.trim() || !topicId}
                  className="btn-primary disabled:opacity-60"
                >
                  {isPending ? "Enregistrement..." : ticket ? "Enregistrer" : "Creer le ticket"}
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Configuration</p>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Type
                  </label>
                  <select value={type} onChange={(event) => setType(event.target.value)} className={fieldCls}>
                    {TICKET_TYPES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Topic *
                  </label>
                  <select value={topicId} onChange={(event) => setTopicId(event.target.value)} className={fieldCls}>
                    {topics.map((topic) => (
                      <option key={topic.id} value={topic.id}>
                        {topic.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Statut
                  </label>
                  <select value={status} onChange={(event) => setStatus(event.target.value)} className={fieldCls}>
                    {KANBAN_COLS.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Priorite
                  </label>
                  <select value={priority} onChange={(event) => setPriority(event.target.value)} className={fieldCls}>
                    {PRIORITIES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Assigne a
                  </label>
                  <input value={assignee} onChange={(event) => setAssignee(event.target.value)} className={fieldCls} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Reporter
                  </label>
                  <input value={reporter} onChange={(event) => setReporter(event.target.value)} className={fieldCls} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Echeance
                  </label>
                  <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className={fieldCls} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Estimation (j)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={estimate}
                    onChange={(event) => setEstimate(event.target.value)}
                    className={fieldCls}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Tags
                  </label>
                  <input
                    value={tags}
                    onChange={(event) => setTags(event.target.value)}
                    placeholder="tag1, tag2"
                    className={fieldCls}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Pattern du ticket</p>
                <p className="mb-3 mt-0.5 text-xs text-[var(--text-muted)]">Champs adaptes au type selectionne.</p>
                <TicketPatternFields type={type} form={patternForm} setForm={setPatternForm} />
              </div>

              {documents.length > 0 && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Documentation liee
                  </p>
                  <div className="space-y-2">
                    {documents.map((doc) => (
                      <label key={doc.id} className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={linkedDocumentIds.includes(doc.id)}
                          onChange={(event) =>
                            setLinkedDocumentIds((state) =>
                              event.target.checked
                                ? [...state, doc.id]
                                : state.filter((item) => item !== doc.id),
                            )
                          }
                          className="mt-0.5 h-4 w-4 rounded border-[var(--border)]"
                        />
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
