import { useMemo, useState } from "react";
import { FileText, Link2, Loader2, MessageSquareText, Pencil, Sparkles, Ticket as TicketIcon } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useDocuments } from "../../hooks/use-documents";
import { useTickets } from "../../hooks/use-tickets";
import { useTopic, useUpdateTopic } from "../../hooks/use-topics";
import { cn } from "../../lib/utils";
import type { Ticket, Topic } from "../../types/domain";

const TOPIC_COLOR_STYLES: Record<string, string> = {
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
  violet: "bg-violet-50 text-violet-700 border-violet-200",
  cyan: "bg-cyan-50 text-cyan-700 border-cyan-200",
  orange: "bg-orange-50 text-orange-700 border-orange-200",
  lime: "bg-lime-50 text-lime-700 border-lime-200",
  slate: "bg-slate-100 text-slate-700 border-slate-200",
};

const TOPIC_COLOR_OPTIONS = ["indigo", "blue", "emerald", "amber", "rose", "violet", "cyan", "orange", "lime", "slate"];

function topicColorClass(color: string) {
  return TOPIC_COLOR_STYLES[color] ?? TOPIC_COLOR_STYLES.indigo;
}

function topicNatureLabel(nature: string) {
  if (nature === "study") return "Etude / Conception";
  if (nature === "delivery") return "Developpement";
  return "Etude + Developpement";
}

function ticketTypeLabel(type: string) {
  if (type === "bug") return "Bug";
  if (type === "feature") return "Feature";
  if (type === "analysis") return "Analyse";
  if (type === "test") return "Recette / Test";
  return "Task";
}

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
        tags: tags.split(",").map((item) => item.trim()).filter(Boolean),
        risks: risks.split("\n").map((item) => item.trim()).filter(Boolean),
        dependencies: dependencies.split("\n").map((item) => item.trim()).filter(Boolean),
        open_questions: openQuestions.split("\n").map((item) => item.trim()).filter(Boolean),
      });
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Impossible d'enregistrer le topic.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/25 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-[28px] border border-line bg-white p-6 shadow-2xl">
        <h2 className="text-xl font-semibold text-ink">Modifier le topic</h2>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div><label className="mb-2 block text-sm font-medium text-ink">Titre</label><input value={title} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100" /></div>
            <div><label className="mb-2 block text-sm font-medium text-ink">Nature</label><select value={nature} onChange={(event) => setNature(event.target.value)} className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"><option value="study">Etude / Conception</option><option value="delivery">Developpement</option><option value="study_delivery">Etude + Developpement</option></select></div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div><label className="mb-2 block text-sm font-medium text-ink">Statut</label><select value={status} onChange={(event) => setStatus(event.target.value)} className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"><option value="active">Actif</option><option value="blocked">Bloque</option><option value="done">Termine</option></select></div>
            <div><label className="mb-2 block text-sm font-medium text-ink">Priorite</label><select value={priority} onChange={(event) => setPriority(event.target.value)} className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"><option value="low">low</option><option value="medium">medium</option><option value="high">high</option><option value="critical">critical</option></select></div>
            <div>
              <label className="mb-2 block text-sm font-medium text-ink">Couleur</label>
              <div className="flex flex-wrap gap-2 rounded-2xl border border-line bg-slate-50 p-2">
                {TOPIC_COLOR_OPTIONS.map((option) => (
                  <button key={option} type="button" onClick={() => setColor(option)} className={cn("rounded-full border px-2 py-1 text-[10px] font-semibold", topicColorClass(option), color === option ? "ring-2 ring-brand-500" : "")}>{option}</button>
                ))}
              </div>
            </div>
          </div>
          <div><label className="mb-2 block text-sm font-medium text-ink">Description</label><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} className="w-full resize-none rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100" /></div>
          <div className="grid gap-4 md:grid-cols-2">
            <div><label className="mb-2 block text-sm font-medium text-ink">Tags</label><textarea value={tags} onChange={(event) => setTags(event.target.value)} rows={3} className="w-full resize-none rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100" /></div>
            <div><label className="mb-2 block text-sm font-medium text-ink">Risques</label><textarea value={risks} onChange={(event) => setRisks(event.target.value)} rows={3} className="w-full resize-none rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100" /></div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div><label className="mb-2 block text-sm font-medium text-ink">Dependances</label><textarea value={dependencies} onChange={(event) => setDependencies(event.target.value)} rows={3} className="w-full resize-none rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100" /></div>
            <div><label className="mb-2 block text-sm font-medium text-ink">Questions ouvertes</label><textarea value={openQuestions} onChange={(event) => setOpenQuestions(event.target.value)} rows={3} className="w-full resize-none rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100" /></div>
          </div>
          {errorMessage ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div> : null}
          <div className="flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium text-ink transition hover:bg-slate-50">Annuler</button><button type="submit" disabled={isPending || !title.trim()} className="rounded-2xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60">{isPending ? "Enregistrement..." : "Enregistrer"}</button></div>
        </form>
      </div>
    </div>
  );
}

export function TopicPage() {
  const { projectId, spaceId, topicId } = useParams<{ projectId: string; spaceId: string; topicId: string }>();
  const { data: topic, isLoading: loadingTopic } = useTopic(topicId);
  const { data: topicTickets = [], isLoading: loadingTickets } = useTickets({ topicId });
  const { data: topicDocuments = [], isLoading: loadingDocuments } = useDocuments({ topicId });
  const [editingTopic, setEditingTopic] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const selectedTicket = useMemo(
    () => topicTickets.find((ticket) => ticket.id === selectedTicketId) ?? topicTickets[0] ?? null,
    [selectedTicketId, topicTickets],
  );

  if (loadingTopic || loadingTickets || loadingDocuments) {
    return <div className="flex items-center justify-center py-20 text-muted"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Chargement du topic...</div>;
  }

  if (!topic) {
    return <div className="rounded-3xl border border-line bg-white p-8 text-sm text-muted">Topic introuvable.</div>;
  }

  return (
    <div className="space-y-6">
      {editingTopic ? <TopicEditModal topic={topic} onClose={() => setEditingTopic(false)} /> : null}

      <section className="rounded-[32px] border border-line bg-white p-8 shadow-panel">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-4xl">
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-brand-600">Topic</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-ink">{topic.title}</h1>
              <span className={cn("rounded-full border px-3 py-1 text-xs font-semibold", topicColorClass(topic.color))}>{topicNatureLabel(topic.topic_nature)}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{topic.status}</span>
            </div>
            <p className="mt-3 text-sm leading-7 text-muted">{topic.description || "Le topic remplace l'epic et centralise tickets, documents, artefacts, memoire et IA."}</p>
            {topic.tags.length > 0 ? <div className="mt-4 flex flex-wrap gap-2">{topic.tags.map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">#{tag}</span>)}</div> : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to={`/projects/${projectId}/spaces/${spaceId}`} className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium text-ink transition hover:bg-slate-50">Retour a l'espace</Link>
            <button onClick={() => setEditingTopic(true)} className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium text-ink transition hover:bg-slate-50"><Pencil className="mr-2 inline h-4 w-4" />Modifier</button>
            <button className="rounded-2xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-600">Analyser avec l'IA</button>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-[28px] border border-line bg-white p-6 shadow-panel">
          <h2 className="text-lg font-semibold text-ink">Apercu du topic</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-line bg-slate-50 p-4"><p className="text-xs uppercase tracking-[0.2em] text-muted">Priorite</p><p className="mt-2 text-lg font-semibold text-ink">{topic.priority}</p></div>
            <div className="rounded-3xl border border-line bg-slate-50 p-4"><p className="text-xs uppercase tracking-[0.2em] text-muted">Roadmap</p><p className="mt-2 text-sm font-semibold text-ink">{topic.roadmap_start_date || topic.roadmap_end_date ? `${topic.roadmap_start_date ?? "?"} -> ${topic.roadmap_end_date ?? "?"}` : "Non planifie"}</p></div>
            <div className="rounded-3xl border border-line bg-slate-50 p-4"><p className="text-xs uppercase tracking-[0.2em] text-muted">Risques</p><p className="mt-2 text-sm text-ink">{topic.risks.length > 0 ? topic.risks.join(", ") : "Aucun risque saisi"}</p></div>
            <div className="rounded-3xl border border-line bg-slate-50 p-4"><p className="text-xs uppercase tracking-[0.2em] text-muted">Questions ouvertes</p><p className="mt-2 text-sm text-ink">{topic.open_questions.length > 0 ? topic.open_questions.join(", ") : "Aucune question ouverte"}</p></div>
          </div>
        </section>

        <section className="rounded-[28px] border border-line bg-white p-6 shadow-panel">
          <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-brand-500" /><h2 className="text-lg font-semibold text-ink">Memoire & contexte</h2></div>
          <div className="mt-5 space-y-3">
            <div className="rounded-2xl border border-line bg-slate-50 p-4"><p className="text-xs uppercase tracking-[0.2em] text-muted">Dependances</p><p className="mt-2 text-sm text-ink">{topic.dependencies.length > 0 ? topic.dependencies.join(", ") : "Aucune dependance renseignee"}</p></div>
            <div className="rounded-2xl border border-line bg-slate-50 p-4"><p className="text-xs uppercase tracking-[0.2em] text-muted">Documentation</p><p className="mt-2 text-sm text-ink">Un topic et tout type de ticket peuvent etre relies a une documentation.</p></div>
            <div className="rounded-2xl border border-line bg-slate-50 p-4"><p className="text-xs uppercase tracking-[0.2em] text-muted">Documents lies</p><p className="mt-2 text-sm text-ink">{topicDocuments.length} document(s)</p></div>
          </div>
        </section>
      </div>

      <section className="rounded-[28px] border border-line bg-white p-6 shadow-panel">
        <div className="mb-4 flex items-center gap-2"><TicketIcon className="h-4 w-4 text-brand-500" /><h2 className="text-lg font-semibold text-ink">Tickets associes</h2></div>
        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="overflow-hidden rounded-2xl border border-line">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="border-b border-line">
                  {["ID", "Type", "Titre", "Statut", "Priorite"].map((header) => <th key={header} className="px-4 py-3 text-left text-xs font-semibold text-muted">{header}</th>)}
                </tr>
              </thead>
              <tbody>
                {topicTickets.length > 0 ? topicTickets.map((ticket) => (
                  <tr key={ticket.id} onClick={() => setSelectedTicketId(ticket.id)} className={cn("cursor-pointer border-b border-line transition hover:bg-slate-50", selectedTicket?.id === ticket.id && "bg-brand-50/50")}>
                    <td className="px-4 py-3 font-mono text-xs text-muted">{ticket.id}</td>
                    <td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700">{ticketTypeLabel(ticket.type)}</span></td>
                    <td className="px-4 py-3 font-medium text-ink">{ticket.title}</td>
                    <td className="px-4 py-3 text-muted">{ticket.status}</td>
                    <td className="px-4 py-3 text-muted">{ticket.priority}</td>
                  </tr>
                )) : <tr><td colSpan={5} className="px-4 py-6 text-sm text-muted">Aucun ticket lie a ce topic.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="rounded-[24px] border border-line bg-slate-50 p-4">
            <div className="flex items-center gap-2"><MessageSquareText className="h-4 w-4 text-brand-500" /><h3 className="text-base font-semibold text-ink">Detail ticket</h3></div>
            {selectedTicket ? (
              <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_0.9fr]">
                <div className="space-y-4 rounded-2xl border border-line bg-white p-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted">{selectedTicket.id}</p>
                    <h4 className="mt-2 text-lg font-semibold text-ink">{selectedTicket.title}</h4>
                    <p className="mt-3 text-sm leading-6 text-muted">{selectedTicket.description || "Aucune description pour ce ticket."}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted">Criteres d'acceptation</p>
                    <ul className="mt-2 space-y-1 text-sm text-ink">
                      {selectedTicket.acceptance_criteria.length > 0 ? selectedTicket.acceptance_criteria.map((item) => <li key={item}>• {item}</li>) : <li>Aucun critere</li>}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted">Pattern</p>
                    <div className="mt-2 space-y-2 text-sm text-ink">
                      {Object.entries(selectedTicket.ticket_details ?? {}).filter(([, value]) => typeof value === "string" && value).map(([key, value]) => (
                        <div key={key} className="rounded-xl border border-line bg-slate-50 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{key.replaceAll("_", " ")}</p>
                          <p className="mt-1 whitespace-pre-wrap">{String(value)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <aside className="space-y-3">
                  <div className="rounded-2xl border border-line bg-white p-4"><p className="text-xs uppercase tracking-[0.2em] text-muted">Configuration</p><p className="mt-2 text-sm text-ink">{ticketTypeLabel(selectedTicket.type)}</p><p className="mt-2 text-sm text-muted">Statut: {selectedTicket.status}</p><p className="mt-2 text-sm text-muted">Priorite: {selectedTicket.priority}</p><p className="mt-2 text-sm text-muted">Assignee: {selectedTicket.assignee ?? "Non assigne"}</p><p className="mt-2 text-sm text-muted">Reporter: {selectedTicket.reporter ?? "Non renseigne"}</p></div>
                  <div className="rounded-2xl border border-line bg-white p-4"><p className="text-xs uppercase tracking-[0.2em] text-muted">Tags</p><div className="mt-2 flex flex-wrap gap-2">{selectedTicket.tags.length > 0 ? selectedTicket.tags.map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">#{tag}</span>) : <span className="text-sm text-muted">Aucun tag</span>}</div></div>
                  <div className="rounded-2xl border border-line bg-white p-4"><p className="text-xs uppercase tracking-[0.2em] text-muted">Documentation liee</p><p className="mt-2 text-sm text-muted">{selectedTicket.linked_document_ids.length} document(s) lie(s)</p></div>
                </aside>
              </div>
            ) : <p className="mt-4 text-sm text-muted">Selectionne une ligne pour afficher le detail du ticket.</p>}
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-line bg-white p-6 shadow-panel">
        <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-brand-500" /><h2 className="text-lg font-semibold text-ink">Documents lies</h2></div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {topicDocuments.length > 0 ? topicDocuments.map((document) => <div key={document.id} className="rounded-2xl border border-line bg-slate-50 p-4"><p className="text-sm font-semibold text-ink">{document.title}</p><p className="mt-2 text-xs text-muted">Mis a jour {document.updated_at ? new Date(document.updated_at).toLocaleDateString("fr-FR") : "recemment"}</p></div>) : <div className="rounded-2xl border border-dashed border-line bg-slate-50 p-5 text-sm text-muted">Aucun document lie a ce topic.</div>}
        </div>
      </section>

      <section className="rounded-[28px] border border-line bg-white p-6 shadow-panel">
        <div className="flex items-center gap-2"><Link2 className="h-4 w-4 text-brand-500" /><h2 className="text-lg font-semibold text-ink">Navigation transverse</h2></div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-line bg-slate-50 p-4 text-sm text-ink"><div className="font-semibold">Roadmap par topic</div><p className="mt-2 text-muted">Le topic construit la roadmap macro, les tickets portent l'execution micro.</p></div>
          <div className="rounded-2xl border border-line bg-slate-50 p-4 text-sm text-ink"><div className="font-semibold">Documents filtrables</div><p className="mt-2 text-muted">Les documents sont consultables globalement ou filtres par topic.</p></div>
          <div className="rounded-2xl border border-line bg-slate-50 p-4 text-sm text-ink"><div className="font-semibold">IA centree contexte</div><p className="mt-2 text-muted">Le topic sert de conteneur documentaire, de pilotage et de contexte IA.</p></div>
        </div>
      </section>
    </div>
  );
}
