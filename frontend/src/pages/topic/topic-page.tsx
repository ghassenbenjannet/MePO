import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart2,
  Bug,
  Calendar,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  Clock,
  FileText,
  FlaskConical,
  Link2,
  MessageSquareText,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  User,
  X,
  Zap,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { TicketModal } from "../../components/tickets/ticket-modal";
import { TopicHero } from "../../components/topic/topic-hero";
import { PageSkeleton } from "../../components/ui/skeleton";
import { useDocuments } from "../../hooks/use-documents";
import { useProjects } from "../../hooks/use-projects";
import { useSpaces } from "../../hooks/use-spaces";
import { useCreateTicket, useDeleteTicket, useTickets, useUpdateTicket } from "../../hooks/use-tickets";
import { useTopic, useTopics, useUpdateTopic } from "../../hooks/use-topics";
import { isLegacyEntitySlug, resolveEntityBySlug, spaceOverviewPath, topicPath } from "../../lib/routes";
import { cn } from "../../lib/utils";
import type { Document, Ticket, TicketStatus, Topic } from "../../types/domain";

// ─── Color maps ────────────────────────────────────────────────────────────────

const TOPIC_COLOR_STYLES: Record<string, string> = {
  indigo: "bg-brand-50 text-brand-700 border-brand-200",
  blue: "bg-brand-100 text-brand-800 border-brand-200",
  emerald: "bg-brand-50 text-brand-700 border-brand-200",
  amber: "bg-brand-100 text-brand-800 border-brand-200",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
  violet: "bg-brand-50 text-brand-700 border-brand-200",
  cyan: "bg-brand-100 text-brand-800 border-brand-200",
  orange: "bg-brand-50 text-brand-700 border-brand-200",
  lime: "bg-brand-100 text-brand-800 border-brand-200",
  slate: "bg-[var(--bg-panel-2)] text-[var(--text-strong)] border-[var(--border)]",
};

const TOPIC_COLOR_OPTIONS = ["indigo", "blue", "emerald", "amber", "rose", "violet", "cyan", "orange", "lime", "slate"];

const STATUS_STYLES: Record<string, string> = {
  backlog: "bg-[var(--bg-panel-2)] text-[var(--text-muted)]",
  todo: "bg-sky-50 text-sky-700",
  in_progress: "bg-amber-50 text-amber-700",
  review: "bg-orange-50 text-orange-700",
  done: "bg-brand-50 text-brand-700",
  blocked: "bg-rose-50 text-rose-700",
};

const STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog",
  todo: "À faire",
  in_progress: "En cours",
  review: "En révision",
  done: "Terminé",
  blocked: "Bloqué",
};

const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-[var(--bg-panel-2)] text-[var(--text-muted)]",
  medium: "bg-sky-50 text-sky-700",
  high: "bg-amber-50 text-amber-700",
  critical: "bg-rose-50 text-rose-700",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Faible",
  medium: "Moyen",
  high: "Élevé",
  critical: "Critique",
};

const TOPIC_STATUS_STYLES: Record<string, string> = {
  active: "bg-brand-50 text-brand-700 border-brand-200",
  done: "bg-brand-100 text-brand-800 border-brand-200",
  blocked: "bg-rose-50 text-rose-700 border-rose-200",
};

const TOPIC_STATUS_LABELS: Record<string, string> = {
  active: "Actif",
  done: "Terminé",
  blocked: "Bloqué",
};

const PRIORITY_DOT: Record<string, string> = {
  low: "bg-[var(--text-muted)]",
  medium: "bg-sky-400",
  high: "bg-amber-500",
  critical: "bg-rose-600",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function topicColorClass(color: string) {
  return TOPIC_COLOR_STYLES[color] ?? TOPIC_COLOR_STYLES.indigo;
}

function topicNatureLabel(nature: string) {
  if (nature === "study") return "Étude";
  if (nature === "delivery") return "Livraison";
  return "Étude + Livraison";
}

function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function TypeIcon({ type, className }: { type: string; className?: string }) {
  const cls = cn("h-3.5 w-3.5 flex-shrink-0", className);
  if (type === "bug") return <Bug className={cls} />;
  if (type === "feature") return <Zap className={cls} />;
  if (type === "analysis") return <BarChart2 className={cls} />;
  if (type === "test") return <FlaskConical className={cls} />;
  return <CheckSquare className={cls} />;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold", STATUS_STYLES[status] ?? "bg-[var(--bg-panel-2)] text-[var(--text-muted)]")}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", PRIORITY_STYLES[priority] ?? "bg-[var(--bg-panel-2)] text-[var(--text-muted)]")}>
      <span className={cn("h-1.5 w-1.5 rounded-full", PRIORITY_DOT[priority] ?? "bg-[var(--text-muted)]")} />
      {PRIORITY_LABELS[priority] ?? priority}
    </span>
  );
}

function humanizeKey(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char: string) => char.toUpperCase());
}

function isHtmlLike(value: string) {
  const trimmed = value.trimStart();
  return trimmed.startsWith("<") || trimmed.includes("</");
}

function renderInlineMarkdown(text: string) {
  const nodes: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|_[^_]+_)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(<strong key={`b-${key++}`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      nodes.push(<code key={`c-${key++}`}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("*") || token.startsWith("_")) {
      nodes.push(<em key={`i-${key++}`}>{token.slice(1, -1)}</em>);
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function RichTextRenderer({ value }: { value: string | null | undefined }) {
  if (!value) {
    return <p className="text-sm italic text-muted">Aucune description pour ce ticket.</p>;
  }

  if (isHtmlLike(value)) {
    return <div className="rich-view text-sm" dangerouslySetInnerHTML={{ __html: value }} />;
  }

  const blocks = value
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  const renderBlock = (block: string, index: number) => {
    const lines = block.split(/\n/).map((line) => line.trim()).filter(Boolean);
    const firstLine = lines[0] ?? block;

    if (/^#{1,3}\s+/.test(firstLine)) {
      const level = firstLine.match(/^#+/)?.[0].length ?? 1;
      const text = firstLine.replace(/^#{1,3}\s+/, "");
      if (level === 1) return <h1 key={index}>{text}</h1>;
      if (level === 2) return <h2 key={index}>{text}</h2>;
      return <h3 key={index}>{text}</h3>;
    }

    if (/^>\s+/.test(firstLine)) {
      return <blockquote key={index}>{renderInlineMarkdown(block.replace(/^>\s+/g, ""))}</blockquote>;
    }

    if (/^(?:- |\* )/.test(firstLine)) {
      return (
        <ul key={index}>
          {lines.map((line, lineIndex) => (
            <li key={`${index}-${lineIndex}`}>{renderInlineMarkdown(line.replace(/^(?:- |\* )/, ""))}</li>
          ))}
        </ul>
      );
    }

    if (/^\d+\.\s+/.test(firstLine)) {
      return (
        <ol key={index}>
          {lines.map((line, lineIndex) => (
            <li key={`${index}-${lineIndex}`}>{renderInlineMarkdown(line.replace(/^\d+\.\s+/, ""))}</li>
          ))}
        </ol>
      );
    }

    if (firstLine.startsWith("```")) {
      const code = block.replace(/^```[a-z]*\n?/i, "").replace(/```$/, "");
      return <pre key={index}><code>{code}</code></pre>;
    }

    return <p key={index}>{renderInlineMarkdown(block.replace(/\n/g, " "))}</p>;
  };

  return <div className="rich-view text-sm">{blocks.map(renderBlock)}</div>;
}

function parseAcceptanceCriterion(criterion: string) {
  const cleaned = criterion.trim();
  const lines = cleaned.split(/\n/).map((line) => line.trim()).filter(Boolean);
  const steps: Array<{ label: "Given" | "When" | "Then" | "And" | "But"; text: string }> = [];
  const rest: string[] = [];

  for (const line of lines) {
    const match = line.match(/^(Given|When|Then|And|But|Etant donné|Étant donné|Quand|Alors|Et|Mais)\s*:?\s*(.+)$/i);
    if (!match) {
      rest.push(line);
      continue;
    }
    const raw = match[1].toLowerCase();
    const text = match[2].trim();
    const label =
      raw.startsWith("given") || raw.startsWith("étant") || raw.startsWith("etant") ? "Given"
      : raw.startsWith("when") || raw.startsWith("quand") ? "When"
      : raw.startsWith("then") || raw.startsWith("alors") ? "Then"
      : raw.startsWith("and") || raw.startsWith("et") ? "And"
      : "But";
    steps.push({ label, text });
  }

  if (steps.length === 0) return null;

  return {
    title: rest[0] ?? cleaned,
    note: rest.slice(1),
    steps,
  };
}

function AcceptanceCriteriaView({ criteria }: { criteria: string[] }) {
  if (criteria.length === 0) return null;

  const parsed = criteria.map((criterion) => parseAcceptanceCriterion(criterion));
  const hasGherkin = parsed.some(Boolean);

  if (!hasGherkin) {
    return (
      <div className="space-y-2">
        {criteria.map((criterion, index) => (
          <div key={`${criterion}-${index}`} className="rounded-2xl border border-line bg-[var(--bg-panel-2)] px-4 py-3">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
              <p className="text-sm leading-relaxed text-ink">{criterion}</p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {parsed.map((item, index) => {
        if (!item) {
          return (
            <div key={`${criteria[index]}-${index}`} className="rounded-2xl border border-line bg-[var(--bg-panel-2)] px-4 py-3">
              <p className="text-sm leading-relaxed text-ink">{criteria[index]}</p>
            </div>
          );
        }

        return (
          <article key={`${item.title}-${index}`} className="overflow-hidden rounded-2xl border border-line bg-[var(--bg-panel)]shadow-sm">
            <div className="border-b border-line bg-[var(--bg-panel-2)] px-4 py-3">
              <p className="text-sm font-semibold text-ink">{item.title}</p>
            </div>
            <div className="space-y-3 px-4 py-4">
              {item.steps.map((step) => (
                <div key={`${step.label}-${step.text}`} className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 py-2.5">
                  <span className={cn(
                    "rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em]",
                    step.label === "Given" ? "bg-brand-500/10 text-brand-600"
                      : step.label === "When" ? "bg-brand-100 text-brand-700"
                      : step.label === "Then" ? "bg-brand-500/15 text-brand-800"
                      : "bg-[var(--bg-panel-3)] text-[var(--text-muted)]",
                  )}>
                    {step.label}
                  </span>
                  <p className="text-sm leading-relaxed text-ink">{step.text}</p>
                </div>
              ))}
              {item.note.length > 0 ? (
                <div className="space-y-2 border-t border-line pt-3">
                  {item.note.map((line) => (
                    <p key={line} className="text-xs leading-relaxed text-muted">{line}</p>
                  ))}
                </div>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function TicketField({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{label}</label>
        {hint ? <p className="mt-1 text-[11px] text-muted">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

const ALL_STATUSES: TicketStatus[] = ["backlog", "todo", "in_progress", "review", "done", "blocked"];
const ALL_TYPES = ["feature", "bug", "task", "analysis", "test"];
const ALL_PRIORITIES = ["low", "medium", "high", "critical"];

// ─── Topic Edit Modal ─────────────────────────────────────────────────────────

function TopicEditModal({ topic, onClose }: { topic: Topic; onClose: () => void }) {
  const { mutateAsync: updateTopic, isPending } = useUpdateTopic();
  const [title, setTitle] = useState(topic.title);
  const [description, setDescription] = useState(topic.description ?? "");
  const [status, setStatus] = useState(topic.status);
  const [priority, setPriority] = useState(topic.priority);
  const [nature, setNature] = useState(topic.topic_nature);
  const [color, setColor] = useState(topic.color);
  const [tags, setTags] = useState(topic.tags.join(", "));
  const [risks, setRisks] = useState(topic.risks.join("\n"));
  const [dependencies, setDependencies] = useState(topic.dependencies.join("\n"));
  const [openQuestions, setOpenQuestions] = useState(topic.open_questions.join("\n"));
  const [errorMessage, setErrorMessage] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage("");
    try {
      await updateTopic({
        id: topic.id,
        title: title.trim(),
        description: description.trim() || null,
        status,
        priority,
        topic_nature: nature,
        color,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        risks: risks.split("\n").map((t) => t.trim()).filter(Boolean),
        dependencies: dependencies.split("\n").map((t) => t.trim()).filter(Boolean),
        open_questions: openQuestions.split("\n").map((t) => t.trim()).filter(Boolean),
      });
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Impossible d'enregistrer le topic.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[var(--overlay)] p-4 backdrop-blur-sm">
      <div className="flex min-h-full items-start justify-center py-4">
        <div className="flex w-full max-w-3xl max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-[28px] border border-line bg-[var(--bg-panel)] shadow-2xl">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-[var(--bg-panel)] px-6 py-5">
            <div>
              <h2 className="text-xl font-semibold text-ink">Modifier le topic</h2>
              <p className="mt-1 text-sm text-muted">Toutes les zones restent visibles et accessibles dans la fenÃªtre.</p>
            </div>
            <button onClick={onClose} className="rounded-xl border border-line bg-[var(--bg-panel)] p-2 text-muted transition hover:bg-[var(--bg-panel-2)] hover:text-ink"><X className="h-4 w-4" /></button>
          </div>
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div><label className="mb-2 block text-sm font-medium text-ink">Titre</label><input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-2xl border border-line bg-[var(--bg-panel)] px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100" /></div>
            <div><label className="mb-2 block text-sm font-medium text-ink">Nature</label><select value={nature} onChange={(e) => setNature(e.target.value)} className="w-full rounded-2xl border border-line bg-[var(--bg-panel)] px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100"><option value="study">Étude / Conception</option><option value="delivery">Livraison</option><option value="study_delivery">Étude + Livraison</option></select></div>
          </div>
          <div className="space-y-4">
            <div><label className="mb-2 block text-sm font-medium text-ink">Statut</label><select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded-2xl border border-line bg-[var(--bg-panel)] px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100"><option value="active">Actif</option><option value="blocked">Bloqué</option><option value="done">Terminé</option></select></div>
            <div><label className="mb-2 block text-sm font-medium text-ink">Priorité</label><select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full rounded-2xl border border-line bg-[var(--bg-panel)] px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100"><option value="low">Faible</option><option value="medium">Moyen</option><option value="high">Élevé</option><option value="critical">Critique</option></select></div>
            <div>
              <label className="mb-2 block text-sm font-medium text-ink">Couleur</label>
              <div className="flex flex-wrap gap-1.5 rounded-2xl border border-line bg-[var(--bg-panel-2)] p-2">
                {TOPIC_COLOR_OPTIONS.map((opt) => (
                  <button key={opt} type="button" onClick={() => setColor(opt)} className={cn("rounded-full border px-2 py-1 text-[10px] font-semibold", topicColorClass(opt), color === opt ? "ring-2 ring-brand-500 ring-offset-1" : "")}>{opt}</button>
                ))}
              </div>
            </div>
          </div>
          <div><label className="mb-2 block text-sm font-medium text-ink">Description</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full resize-none rounded-2xl border border-line bg-[var(--bg-panel)] px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100" /></div>
          <div className="space-y-4">
            <div><label className="mb-2 block text-sm font-medium text-ink">Tags (virgule)</label><textarea value={tags} onChange={(e) => setTags(e.target.value)} rows={2} className="w-full resize-none rounded-2xl border border-line bg-[var(--bg-panel)] px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100" /></div>
            <div><label className="mb-2 block text-sm font-medium text-ink">Risques (1 par ligne)</label><textarea value={risks} onChange={(e) => setRisks(e.target.value)} rows={2} className="w-full resize-none rounded-2xl border border-line bg-[var(--bg-panel)] px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100" /></div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div><label className="mb-2 block text-sm font-medium text-ink">Dépendances (1 par ligne)</label><textarea value={dependencies} onChange={(e) => setDependencies(e.target.value)} rows={2} className="w-full resize-none rounded-2xl border border-line bg-[var(--bg-panel)] px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100" /></div>
            <div><label className="mb-2 block text-sm font-medium text-ink">Questions ouvertes (1 par ligne)</label><textarea value={openQuestions} onChange={(e) => setOpenQuestions(e.target.value)} rows={2} className="w-full resize-none rounded-2xl border border-line bg-[var(--bg-panel)] px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100" /></div>
          </div>
                {errorMessage && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div>}
              </div>
            </div>
            <div className="sticky bottom-0 flex justify-end gap-3 border-t border-line bg-[var(--bg-panel)]px-6 py-4">
              <button type="button" onClick={onClose} className="rounded-2xl border border-line bg-[var(--bg-panel)] px-4 py-3 text-sm font-medium text-ink transition hover:bg-[var(--bg-panel-2)]">Annuler</button>
              <button type="submit" disabled={isPending || !title.trim()} className="rounded-2xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60">{isPending ? "Enregistrement..." : "Enregistrer"}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Ticket Create Modal ───────────────────────────────────────────────────────

function TicketCreateModal({
  topic,
  topics,
  documents,
  topicId,
  onClose,
}: {
  topic?: Topic;
  topics: Topic[];
  documents: Document[];
  topicId: string;
  onClose: () => void;
}) {
  return (
    <TicketModal
      topics={topic ? [topic] : topics}
      documents={documents}
      defaultTopicId={topicId}
      onClose={onClose}
    />
  );

  const { mutateAsync: createTicket, isPending } = useCreateTicket();
  const [title, setTitle] = useState("");
  const [type, setType] = useState("feature");
  const [status, setStatus] = useState("backlog");
  const [priority, setPriority] = useState("medium");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState("");
  const [tags, setTags] = useState("");
  const [acceptanceCriteria, setAcceptanceCriteria] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage("");
    try {
      await createTicket({
        topic_id: topicId,
        title: title.trim(),
        type,
        status,
        priority,
        description: description.trim() || null,
        assignee: assignee.trim() || null,
      });
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Impossible de créer le ticket.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[calc(100vh-2rem)] overflow-y-auto rounded-[28px] border border-line bg-[var(--bg-panel)]p-6 shadow-2xl">
        <div className="sticky top-0 z-10 -mx-6 -mt-6 mb-5 flex items-center justify-between border-b border-line bg-[var(--bg-panel)] px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-ink">Nouveau ticket</h2>
            <p className="mt-1 text-sm text-muted">Chaque zone est organisée verticalement pour une lecture plus nette.</p>
          </div>
          <button onClick={onClose} className="rounded-2xl border border-line bg-[var(--bg-panel)] px-4 py-2 text-sm font-medium text-ink transition hover:bg-[var(--bg-panel-2)]">Fermer</button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <TicketField label="Titre *">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Correction du bug de connexion..." className="w-full rounded-2xl border border-line bg-[var(--bg-panel)] px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100" />
          </TicketField>
          <TicketField label="Description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} placeholder="Décrivez le contexte, le comportement observé, le comportement attendu..." className="w-full resize-none rounded-2xl border border-line bg-[var(--bg-panel)] px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100" />
          </TicketField>
          <div className="space-y-4">
            <TicketField label="Type">
              <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-2xl border border-line bg-[var(--bg-panel)] px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100">
                <option value="feature">Feature</option>
                <option value="bug">Bug</option>
                <option value="task">Task</option>
                <option value="analysis">Analyse</option>
                <option value="test">Recette / Test</option>
              </select>
            </TicketField>
            <TicketField label="Statut">
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded-2xl border border-line bg-[var(--bg-panel)] px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100">
                {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>)}
              </select>
            </TicketField>
            <TicketField label="Priorité">
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full rounded-2xl border border-line bg-[var(--bg-panel)] px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100">
                {ALL_PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p] ?? p}</option>)}
              </select>
            </TicketField>
          </div>
          <div className="space-y-4">
            <TicketField label="Assigné à">
              <input value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Nom ou email" className="w-full rounded-2xl border border-line bg-[var(--bg-panel)] px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100" />
            </TicketField>
            <TicketField label="Tags (virgule)">
              <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="auth, front, urgent..." className="w-full rounded-2xl border border-line bg-[var(--bg-panel)] px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100" />
            </TicketField>
          </div>
          <TicketField label="Critères d'acceptation (1 par ligne)">
            <textarea value={acceptanceCriteria} onChange={(e) => setAcceptanceCriteria(e.target.value)} rows={4} placeholder="Quand... alors..." className="w-full resize-none rounded-2xl border border-line bg-[var(--bg-panel)] px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100" />
          </TicketField>
          {errorMessage && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div>}
          <div className="sticky bottom-0 -mx-6 flex justify-end gap-3 border-t border-line bg-[var(--bg-panel)]px-6 py-4">
            <button type="button" onClick={onClose} className="rounded-2xl border border-line bg-[var(--bg-panel)] px-4 py-3 text-sm font-medium text-ink transition hover:bg-[var(--bg-panel-2)]">Annuler</button>
            <button type="submit" disabled={isPending || !title.trim()} className="rounded-2xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60">{isPending ? "Création..." : "Créer le ticket"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Ticket Detail Meta Row ───────────────────────────────────────────────────

function MetaRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5">
        <span className="text-muted">{icon}</span>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">{label}</p>
      </div>
      <p className="text-sm text-ink">{children}</p>
    </div>
  );
}

// ─── Ticket Detail Modal ──────────────────────────────────────────────────────

function TicketDetailSlideOver({
  ticket,
  onClose,
  onEdit,
}: {
  ticket: Ticket;
  onClose: () => void;
  onEdit: () => void;
}) {
  const { mutate: updateTicket } = useUpdateTicket();

  const handleStatusChange = (newStatus: string) => {
    updateTicket({ id: ticket.id, status: newStatus });
  };

  // Shadow PO comments from ticket_details — items can be strings or {ts, text} objects
  const shadowPoComments = (() => {
    const v = ticket.ticket_details?.shadow_po_comments;
    if (Array.isArray(v)) return v.map((item) =>
      typeof item === "string" ? item : (item?.text ?? JSON.stringify(item))
    );
    if (typeof v === "string" && v) return [v];
    return [];
  })();

  // Pattern fields — exclude internal keys and shadow_po_comments
  const patternFields = Object.entries(ticket.ticket_details ?? {}).filter(
    ([key, val]) =>
      !key.startsWith("_") &&
      key !== "shadow_po_comments" &&
      typeof val === "string" &&
      val,
  );

  const typeLabel =
    ticket.type === "bug" ? "Bug" :
    ticket.type === "feature" ? "Feature" :
    ticket.type === "analysis" ? "Analyse" :
    ticket.type === "test" ? "Recette" : "Task";

  const typeColor =
    ticket.type === "bug" ? "bg-rose-50 text-rose-600 border-rose-200" :
    ticket.type === "feature" ? "bg-brand-50 text-brand-700 border-brand-200" :
    ticket.type === "analysis" ? "bg-brand-100 text-brand-800 border-brand-200" :
    ticket.type === "test" ? "bg-brand-50 text-brand-700 border-brand-200" :
    "bg-[var(--bg-panel-2)] text-[var(--text-muted)] border-[var(--border)]";

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-[var(--overlay)] backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:p-8">
        <div className="flex h-full max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-line bg-[var(--bg-panel)] shadow-2xl">

          {/* ── Header ──────────────────────────────────────────────────────── */}
          <div className="flex flex-shrink-0 items-start justify-between gap-4 border-b border-line px-7 py-5">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-center gap-2">
                <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold", typeColor)}>
                  <TypeIcon type={ticket.type} />
                  {typeLabel}
                </span>
                <span className="font-mono text-[11px] text-muted">{shortId(ticket.id)}</span>
              </div>
              <h2 className="text-3xl font-semibold leading-tight tracking-tight text-ink">{ticket.title}</h2>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              <button
                onClick={onEdit}
                className="rounded-xl border border-line bg-[var(--bg-panel)] p-2 text-muted transition hover:bg-[var(--bg-panel-2)] hover:text-ink"
                title="Modifier"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={onClose}
                className="rounded-xl border border-line bg-[var(--bg-panel)] p-2 text-muted transition hover:bg-[var(--bg-panel-2)] hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* ── Status strip ────────────────────────────────────────────────── */}
          <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-line bg-[var(--bg-panel-2)] px-7 py-3">
            {ALL_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => handleStatusChange(s)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold transition",
                  ticket.status === s
                    ? cn(STATUS_STYLES[s] ?? "bg-[var(--bg-panel-2)] text-[var(--text-muted)]", "shadow-sm ring-2 ring-inset ring-current/20")
                    : "border border-line bg-[var(--bg-panel)] text-[var(--text-muted)] hover:bg-[var(--bg-panel-2)]",
                )}
              >
                {STATUS_LABELS[s] ?? s}
              </button>
            ))}
            <div className="ml-auto">
              <PriorityBadge priority={ticket.priority} />
            </div>
          </div>

          {/* ── Body ────────────────────────────────────────────────────────── */}
          <div className="grid min-h-0 flex-1 gap-0 xl:grid-cols-[minmax(0,1fr)_340px]">

            {/* Left: content */}
            <div className="min-h-0 overflow-y-auto px-7 py-6">

              {/* Description */}
              <section className="rounded-[24px] border border-line bg-[var(--bg-panel-2)] p-5">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
                  Description
                </p>
                <RichTextRenderer value={ticket.description} />
              </section>

              {/* Acceptance criteria */}
              <section className="rounded-[24px] border border-line bg-[var(--bg-panel)]p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
                      Critères d'acceptation
                    </p>
                    <p className="mt-1 text-sm text-muted">Les critères Gherkin sont affichés en cartes.</p>
                  </div>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </div>
                {ticket.acceptance_criteria.length > 0 ? (
                  <AcceptanceCriteriaView criteria={ticket.acceptance_criteria} />
                ) : (
                  <p className="text-sm italic text-muted">Aucun critère d’acceptation renseigné.</p>
                )}
              </section>

              {/* Pattern / ticket_details */}
              {patternFields.length > 0 && (
                <section className="rounded-[24px] border border-line bg-[var(--bg-panel)]p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
                    Informations complémentaires
                  </p>
                  <div className="mt-4 space-y-3">
                    {patternFields.map(([key, value]) => (
                      <div key={key} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel-2)] px-4 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                          {humanizeKey(key)}
                        </p>
                        <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-ink">{String(value)}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Shadow PO activity */}
              {shadowPoComments.length > 0 && (
                <section className="rounded-[24px] border border-brand-100 bg-brand-50/60 p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-brand-500" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-500">
                      Analyse Shadow PO
                    </p>
                  </div>
                  <div className="space-y-3">
                    {shadowPoComments.map((comment, i) => (
                      <div
                        key={i}
                        className="rounded-2xl border border-brand-100 bg-[var(--bg-panel)]px-4 py-3"
                      >
                        <p className="text-sm leading-relaxed text-ink">{comment}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* Right: metadata panel */}
            <aside className="w-64 flex-shrink-0 space-y-5 overflow-y-auto border-l border-line bg-[var(--bg-panel-2)] px-5 py-5 xl:sticky xl:top-0 xl:h-[calc(92vh-1.5rem)] xl:w-[340px]">

              <MetaRow icon={<User className="h-3.5 w-3.5" />} label="Assigné à">
                {ticket.assignee ?? <span className="text-xs italic text-muted">Non assigné</span>}
              </MetaRow>

              <MetaRow icon={<MessageSquareText className="h-3.5 w-3.5" />} label="Reporter">
                {ticket.reporter ?? <span className="text-xs italic text-muted">—</span>}
              </MetaRow>

              {ticket.estimate != null && (
                <MetaRow icon={<Clock className="h-3.5 w-3.5" />} label="Estimation">
                  {ticket.estimate} pts
                </MetaRow>
              )}

              {ticket.due_date && (
                <MetaRow icon={<Calendar className="h-3.5 w-3.5" />} label="Échéance">
                  {new Date(ticket.due_date).toLocaleDateString("fr-FR")}
                </MetaRow>
              )}

              {ticket.tags.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                    Tags
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {ticket.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-[var(--bg-panel-3)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-muted)]"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {ticket.dependencies.length > 0 && (
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <Link2 className="h-3.5 w-3.5 text-muted" />
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                      Dépendances
                    </p>
                  </div>
                  <ul className="space-y-1">
                    {ticket.dependencies.map((dep, i) => (
                      <li key={i} className="text-xs text-ink">{dep}</li>
                    ))}
                  </ul>
                </div>
              )}

              {ticket.linked_document_ids.length > 0 && (
                <MetaRow icon={<FileText className="h-3.5 w-3.5" />} label="Documents liés">
                  {ticket.linked_document_ids.length} document(s)
                </MetaRow>
              )}

              <div className="space-y-2 border-t border-line pt-4">
                {ticket.created_at && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                      Créé le
                    </p>
                    <p className="mt-0.5 text-xs text-ink">
                      {new Date(ticket.created_at).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                )}
                {ticket.updated_at && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                      Mis à jour
                    </p>
                    <p className="mt-0.5 text-xs text-ink">
                      {new Date(ticket.updated_at).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Ticket Edit Slide-Over ───────────────────────────────────────────────────

function TicketEditSlideOver({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  const { mutateAsync: updateTicket, isPending } = useUpdateTicket();
  const [title, setTitle] = useState(ticket.title);
  const [type, setType] = useState(ticket.type);
  const [status, setStatus] = useState(ticket.status);
  const [priority, setPriority] = useState(ticket.priority);
  const [description, setDescription] = useState(ticket.description ?? "");
  const [assignee, setAssignee] = useState(ticket.assignee ?? "");
  const [reporter, setReporter] = useState(ticket.reporter ?? "");
  const [tags, setTags] = useState(ticket.tags.join(", "));
  const [acceptanceCriteria, setAcceptanceCriteria] = useState(ticket.acceptance_criteria.join("\n"));
  const [errorMessage, setErrorMessage] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage("");
    try {
      await updateTicket({
        id: ticket.id,
        title: title.trim(),
        type,
        status,
        priority,
        description: description.trim() || null,
        assignee: assignee.trim() || null,
        reporter: reporter.trim() || null,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        acceptance_criteria: acceptanceCriteria.split("\n").map((t) => t.trim()).filter(Boolean),
      });
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Impossible de mettre à jour le ticket.");
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-[var(--overlay)] backdrop-blur-[2px]" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-2xl flex-col border-l border-line bg-[var(--bg-panel)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-line p-6">
          <div>
            <h2 className="text-lg font-semibold text-ink">Modifier le ticket</h2>
            <p className="mt-1 text-sm text-muted">Les champs sont affichés les uns sous les autres pour faciliter l’édition.</p>
          </div>
          <button onClick={onClose} className="rounded-xl border border-line bg-[var(--bg-panel)] p-2 text-muted transition hover:bg-[var(--bg-panel-2)]"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <form id="ticket-edit-form" onSubmit={submit} className="space-y-4">
            <TicketField label="Titre">
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-2xl border border-line bg-[var(--bg-panel)] px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100" />
            </TicketField>
            <TicketField label="Description">
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} className="w-full resize-none rounded-2xl border border-line bg-[var(--bg-panel)] px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100" />
            </TicketField>
            <div className="space-y-4">
              <TicketField label="Type">
                <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-2xl border border-line bg-[var(--bg-panel)] px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100">
                  {ALL_TYPES.map((t) => <option key={t} value={t}>{t === "bug" ? "Bug" : t === "feature" ? "Feature" : t === "analysis" ? "Analyse" : t === "test" ? "Recette" : "Task"}</option>)}
                </select>
              </TicketField>
              <TicketField label="Statut">
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded-2xl border border-line bg-[var(--bg-panel)] px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100">
                  {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>)}
                </select>
              </TicketField>
              <TicketField label="Priorité">
                <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full rounded-2xl border border-line bg-[var(--bg-panel)] px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100">
                  {ALL_PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p] ?? p}</option>)}
                </select>
              </TicketField>
            </div>
            <div className="space-y-4">
              <TicketField label="Assigné à">
                <input value={assignee} onChange={(e) => setAssignee(e.target.value)} className="w-full rounded-2xl border border-line bg-[var(--bg-panel)] px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100" />
              </TicketField>
              <TicketField label="Reporter">
                <input value={reporter} onChange={(e) => setReporter(e.target.value)} className="w-full rounded-2xl border border-line bg-[var(--bg-panel)] px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100" />
              </TicketField>
            </div>
            <TicketField label="Tags (virgule)">
              <input value={tags} onChange={(e) => setTags(e.target.value)} className="w-full rounded-2xl border border-line bg-[var(--bg-panel)] px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100" />
            </TicketField>
            <TicketField label="Critères d'acceptation (1 par ligne)">
              <textarea value={acceptanceCriteria} onChange={(e) => setAcceptanceCriteria(e.target.value)} rows={4} className="w-full resize-none rounded-2xl border border-line bg-[var(--bg-panel)] px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100" />
            </TicketField>
            {errorMessage && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div>}
          </form>
        </div>
        <div className="flex justify-end gap-3 border-t border-line p-6">
          <button type="button" onClick={onClose} className="rounded-2xl border border-line bg-[var(--bg-panel)] px-4 py-3 text-sm font-medium text-ink transition hover:bg-[var(--bg-panel-2)]">Annuler</button>
          <button type="submit" form="ticket-edit-form" disabled={isPending || !title.trim()} className="rounded-2xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60">{isPending ? "Enregistrement..." : "Enregistrer"}</button>
        </div>
      </aside>
    </>
  );
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function TicketStatsBar({ tickets }: { tickets: Ticket[] }) {
  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const t of tickets) {
      result[t.status] = (result[t.status] ?? 0) + 1;
    }
    return result;
  }, [tickets]);

  const total = tickets.length;
  if (total === 0) return null;

  const doneCount = counts["done"] ?? 0;
  const donePercent = Math.round((doneCount / total) * 100);

  return (
    <div className="flex flex-wrap items-center gap-4">
      {ALL_STATUSES.map((s) =>
        counts[s] ? (
          <div key={s} className="flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", s === "done" ? "bg-brand-600" : s === "blocked" ? "bg-rose-500" : s === "in_progress" ? "bg-amber-500" : s === "review" ? "bg-brand-400" : s === "todo" ? "bg-brand-500" : "bg-[var(--text-muted)]")} />
            <span className="text-xs text-muted">{STATUS_LABELS[s] ?? s}</span>
            <span className="text-xs font-semibold text-ink">{counts[s]}</span>
          </div>
        ) : null,
      )}
      {total > 0 && (
        <div className="ml-auto flex items-center gap-2">
          <div className="h-1.5 w-24 rounded-full bg-[var(--bg-panel-3)]">
            <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${donePercent}%` }} />
          </div>
          <span className="text-xs text-muted">{donePercent}% terminé</span>
        </div>
      )}
    </div>
  );
}

// ─── Topic Context Panel ──────────────────────────────────────────────────────

function TopicContextPanel({ topic, docsCount }: { topic: Topic; docsCount: number }) {
  return (
    <div className="space-y-4">
      {/* Roadmap */}
      <div className="rounded-2xl border border-line bg-[var(--bg-panel)]p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Roadmap</p>
        <p className="mt-2 text-sm font-medium text-ink">
          {topic.roadmap_start_date || topic.roadmap_end_date
            ? `${topic.roadmap_start_date ?? "?"} → ${topic.roadmap_end_date ?? "?"}`
            : <span className="text-muted italic">Non planifié</span>}
        </p>
      </div>

      {/* Risks */}
      {topic.risks.length > 0 && (
        <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-600">Risques</p>
          </div>
          <ul className="space-y-1">
            {topic.risks.map((risk, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-ink">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-rose-400" />
                {risk}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Open questions */}
      {topic.open_questions.length > 0 && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 mb-2">Questions ouvertes</p>
          <ul className="space-y-1">
            {topic.open_questions.map((q, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-ink">
                <span className="mt-0.5 flex-shrink-0 text-amber-400">?</span>
                {q}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Dependencies */}
      {topic.dependencies.length > 0 && (
        <div className="rounded-2xl border border-line bg-[var(--bg-panel)]p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Link2 className="h-3.5 w-3.5 text-muted" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Dépendances</p>
          </div>
          <ul className="space-y-1">
            {topic.dependencies.map((dep, i) => (
              <li key={i} className="text-sm text-ink">{dep}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Documents */}
      <div className="rounded-2xl border border-line bg-[var(--bg-panel)]p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <FileText className="h-3.5 w-3.5 text-muted" />
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Documents liés</p>
        </div>
        <p className="text-sm text-ink">{docsCount > 0 ? `${docsCount} document(s)` : <span className="text-muted italic">Aucun document</span>}</p>
      </div>

      {/* Owner / teams */}
      {(topic.owner || topic.teams.length > 0) && (
        <div className="rounded-2xl border border-line bg-[var(--bg-panel)]p-4 space-y-2">
          {topic.owner && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Owner</p>
              <p className="mt-1 text-sm text-ink">{topic.owner}</p>
            </div>
          )}
          {topic.teams.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Équipes</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {topic.teams.map((team) => <span key={team} className="rounded-full bg-[var(--bg-panel-2)] px-2 py-0.5 text-xs text-[var(--text-muted)]">{team}</span>)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function TopicPage() {
  const navigate = useNavigate();
  const { projectSlug, spaceSlug, topicSlug } = useParams<{ projectSlug: string; spaceSlug: string; topicSlug: string }>();
  const { data: projects = [] } = useProjects();
  const project = useMemo(() => resolveEntityBySlug(projects, projectSlug), [projects, projectSlug]);
  const projectId = project?.id;
  const { data: spaces = [] } = useSpaces(projectId);
  const space = useMemo(() => resolveEntityBySlug(spaces, spaceSlug), [spaces, spaceSlug]);
  const spaceId = space?.id;
  const { data: topics = [] } = useTopics(spaceId);
  const topicRef = useMemo(() => resolveEntityBySlug(topics, topicSlug), [topics, topicSlug]);
  const topicId = topicRef?.id;
  const { data: topic, isLoading: loadingTopic } = useTopic(topicId);
  const { data: topicTickets = [], isLoading: loadingTickets } = useTickets({ topicId });
  const { data: topicDocuments = [], isLoading: loadingDocuments } = useDocuments({ topicId });
  const { mutate: deleteTicket } = useDeleteTicket();

  const [editingTopic, setEditingTopic] = useState(false);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const selectedTicket = useMemo(
    () => topicTickets.find((t) => t.id === selectedTicketId) ?? null,
    [selectedTicketId, topicTickets],
  );

  const editingTicket = useMemo(
    () => topicTickets.find((t) => t.id === editingTicketId) ?? null,
    [editingTicketId, topicTickets],
  );

  const filteredTickets = useMemo(
    () => statusFilter === "all" ? topicTickets : topicTickets.filter((t) => t.status === statusFilter),
    [topicTickets, statusFilter],
  );

  useEffect(() => {
    if (!project || !space || !topicRef) return;
    if (!isLegacyEntitySlug(projectSlug) && !isLegacyEntitySlug(spaceSlug) && !isLegacyEntitySlug(topicSlug)) return;
    navigate(topicPath(project, space, topicRef), { replace: true });
  }, [navigate, project, projectSlug, space, spaceSlug, topicRef, topicSlug]);

  if (loadingTopic || loadingTickets || loadingDocuments) {
    return <PageSkeleton />;
  }

  if (!topic) {
    return <div className="rounded-3xl border border-line bg-[var(--bg-panel)]p-8 text-sm text-muted">Topic introuvable.</div>;
  }

  return (
    <div className="space-y-5">
      {/* Modals */}
      {editingTopic && <TopicEditModal topic={topic} onClose={() => setEditingTopic(false)} />}
      {creatingTicket && topicId && (
        <TicketCreateModal
          topic={topic}
          topics={topics}
          documents={topicDocuments}
          topicId={topicId}
          onClose={() => setCreatingTicket(false)}
        />
      )}
      {selectedTicket && !editingTicketId && (
        <TicketDetailSlideOver
          ticket={selectedTicket}
          onClose={() => setSelectedTicketId(null)}
          onEdit={() => { setEditingTicketId(selectedTicket.id); setSelectedTicketId(null); }}
        />
      )}
      {editingTicket && (
        <TicketEditSlideOver ticket={editingTicket} onClose={() => setEditingTicketId(null)} />
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <TopicHero
        title={topic.title}
        description={topic.description ?? undefined}
        meta={(
          <>
            <span className={cn("badge", topicColorClass(topic.color))}>{topicNatureLabel(topic.topic_nature)}</span>
            <span className={cn("badge", TOPIC_STATUS_STYLES[topic.status] ?? "badge badge-neutral")}>
              {TOPIC_STATUS_LABELS[topic.status] ?? topic.status}
            </span>
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", PRIORITY_STYLES[topic.priority] ?? "bg-[var(--bg-panel-2)] text-[var(--text-muted)]")}>
              <span className={cn("h-1.5 w-1.5 rounded-full", PRIORITY_DOT[topic.priority] ?? "bg-[var(--text-muted)]")} />
              {PRIORITY_LABELS[topic.priority] ?? topic.priority}
            </span>
            {topic.tags.map((tag: string) => (
              <span key={tag} className="badge badge-neutral">#{tag}</span>
            ))}
          </>
        )}
        actions={(
          <>
            <Link
              to={spaceOverviewPath({ id: projectId ?? "", name: projectSlug ?? "" }, { id: spaceId ?? "", name: spaceSlug ?? "" })}
              className="btn-secondary"
            >
              Retour
            </Link>
            <button onClick={() => setEditingTopic(true)} className="btn-secondary">
              <Pencil className="h-3.5 w-3.5" />
              Modifier
            </button>
          </>
        )}
      />

      {/* ── Main content: tickets + context ────────────────────────────────── */}
      <div className="grid gap-5 xl:grid-cols-[1fr_280px]">
        {/* ── Ticket list ──────────────────────────────────────────────────── */}
        <section className="rounded-[28px] border border-line bg-[var(--bg-panel)] p-6 shadow-panel">
          {/* Section header */}
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <MessageSquareText className="h-4 w-4 text-brand-500" />
              <h2 className="text-base font-semibold text-ink">Tickets</h2>
              <span className="rounded-full bg-[var(--bg-panel-2)] px-2 py-0.5 text-xs font-semibold text-[var(--text-muted)]">{topicTickets.length}</span>
            </div>
            <button
              onClick={() => setCreatingTicket(true)}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-brand-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-600"
            >
              <Plus className="h-3.5 w-3.5" />
              Nouveau ticket
            </button>
          </div>

          {/* Stats bar */}
          {topicTickets.length > 0 && (
            <div className="mb-4 rounded-2xl border border-line bg-[var(--bg-panel-2)] px-4 py-3">
              <TicketStatsBar tickets={topicTickets} />
            </div>
          )}

          {/* Filter bar */}
          {topicTickets.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              <button
                onClick={() => setStatusFilter("all")}
                className={cn("rounded-full px-3 py-1 text-xs font-medium transition", statusFilter === "all" ? "bg-brand-500 text-white" : "bg-[var(--bg-panel-2)] text-[var(--text-muted)] hover:bg-[var(--bg-panel-3)]")}
              >
                Tous ({topicTickets.length})
              </button>
              {ALL_STATUSES.map((s) => {
                const count = topicTickets.filter((t) => t.status === s).length;
                if (!count) return null;
                return (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={cn("rounded-full px-3 py-1 text-xs font-medium transition", statusFilter === s ? "bg-brand-500 text-white" : "bg-[var(--bg-panel-2)] text-[var(--text-muted)] hover:bg-[var(--bg-panel-3)]")}
                  >
                    {STATUS_LABELS[s] ?? s} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {/* Ticket table */}
          <div className="overflow-hidden rounded-2xl border border-line">
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg-panel-2)]">
                <tr className="border-b border-line">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted w-10">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Titre</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Priorité</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Assigné</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted w-20"></th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.length > 0 ? (
                  filteredTickets.map((ticket) => (
                    <tr
                      key={ticket.id}
                      className="group border-b border-line transition hover:bg-[var(--bg-panel-2)] cursor-pointer"
                      onClick={() => setSelectedTicketId(ticket.id)}
                    >
                      <td className="px-4 py-3">
                        <span title={ticket.type} className={cn("flex h-6 w-6 items-center justify-center rounded-lg", ticket.type === "bug" ? "bg-rose-50 text-rose-500" : ticket.type === "feature" ? "bg-brand-50 text-brand-500" : ticket.type === "analysis" ? "bg-brand-100 text-brand-700" : ticket.type === "test" ? "bg-brand-50 text-brand-600" : "bg-[var(--bg-panel-2)] text-[var(--text-muted)]")}>
                          <TypeIcon type={ticket.type} />
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-[10px] text-muted flex-shrink-0">{shortId(ticket.id)}</span>
                          <span className="font-medium text-ink truncate">{ticket.title}</span>
                        </div>
                        {ticket.tags.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {ticket.tags.slice(0, 3).map((tag) => (
                              <span key={tag} className="rounded-full bg-[var(--bg-panel-2)] px-1.5 py-0 text-[10px] text-[var(--text-muted)]">#{tag}</span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={ticket.status} /></td>
                      <td className="px-4 py-3"><PriorityBadge priority={ticket.priority} /></td>
                      <td className="px-4 py-3">
                        {ticket.assignee ? (
                          <span className="text-xs text-ink">{ticket.assignee}</span>
                        ) : (
                          <span className="text-xs text-muted italic">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingTicketId(ticket.id); }}
                            className="rounded-lg p-1.5 text-muted hover:bg-[var(--bg-panel-2)] hover:text-ink transition"
                            title="Modifier"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedTicketId(ticket.id); }}
                            className="rounded-lg p-1.5 text-muted hover:bg-[var(--bg-panel-2)] hover:text-ink transition"
                            title="Voir le détail"
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Supprimer le ticket « ${ticket.title} » ?`)) {
                                if (selectedTicketId === ticket.id) setSelectedTicketId(null);
                                if (editingTicketId === ticket.id) setEditingTicketId(null);
                                deleteTicket(ticket.id);
                              }
                            }}
                            className="rounded-lg p-1.5 text-muted hover:bg-rose-50 hover:text-rose-600 transition"
                            title="Supprimer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted">
                      {statusFilter === "all"
                        ? "Aucun ticket lié à ce topic."
                        : `Aucun ticket avec le statut « ${STATUS_LABELS[statusFilter] ?? statusFilter} ».`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        
      </div>
    </div>
  );
}
