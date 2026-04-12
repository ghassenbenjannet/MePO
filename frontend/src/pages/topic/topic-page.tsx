import { Link, useParams } from "react-router-dom";
import { PageHeader } from "../../components/ui/page-header";
import { SectionCard } from "../../components/ui/section-card";
import { documents, tickets, topics } from "../../data/mock-data";

export function TopicPage() {
  const { projectId, spaceId, topicId } = useParams();
  const topic = topics.find((item) => item.id === topicId);
  const topicTickets = tickets.filter((ticket) => ticket.topicId === topicId);
  const topicDocuments = documents.filter((document) => document.topicId === topicId);

  if (!topic) {
    return <div className="rounded-3xl border border-line bg-panel p-8 text-sm text-muted">Topic introuvable.</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Topic workspace"
        title={topic.title}
        description={topic.description}
        actions={
          <>
            <Link
              to={`/projects/${projectId}/spaces/${spaceId}`}
              className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium text-ink transition hover:bg-slate-50"
            >
              Retour a l'espace
            </Link>
            <button className="rounded-2xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-600">
              Analyser avec l'IA
            </button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard title="Overview" subtitle="Execution, decisions, and topic-linked material in one place.">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-line bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Status</p>
              <p className="mt-2 text-lg font-semibold text-ink">{topic.status}</p>
            </div>
            <div className="rounded-3xl border border-line bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Priority</p>
              <p className="mt-2 text-lg font-semibold text-ink">{topic.priority}</p>
            </div>
            <div className="rounded-3xl border border-line bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Owner</p>
              <p className="mt-2 text-lg font-semibold text-ink">{topic.owner}</p>
            </div>
            <div className="rounded-3xl border border-line bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Linked assets</p>
              <p className="mt-2 text-lg font-semibold text-ink">{topicTickets.length} tickets / {topicDocuments.length} documents</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Topic memory" subtitle="Visible, editable, and AI-usable memory with human validation.">
          <div className="space-y-3">
            {[
              ["Faits", "Le sujet impacte habilitations, parcours de saisie et non-regression."],
              ["Decisions", "Le topic porte la coordination backlog, docs et IA."],
              ["Risques", "Risque d'ecarts entre regles legacy et cadrage cible."],
              ["Dependances", "Synchronisation identites, habilitations, import des etablissements."],
              ["Questions ouvertes", "Quel mapping final pour les commentaires historiques ?"],
            ].map(([title, text]) => (
              <div key={title} className="rounded-2xl border border-line bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted">{title}</p>
                <p className="mt-2 text-sm leading-6 text-ink">{text}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Tickets lies" subtitle="Backlog elements directly connected to the topic.">
          <div className="space-y-3">
            {topicTickets.map((ticket) => (
              <div key={ticket.id} className="rounded-2xl border border-line bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted">{ticket.id}</p>
                    <h3 className="mt-2 text-sm font-semibold text-ink">{ticket.title}</h3>
                  </div>
                  <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-600">{ticket.status}</span>
                </div>
                <p className="mt-3 text-sm text-muted">{ticket.type} - {ticket.priority} - {ticket.assignee}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Documents lies" subtitle="Knowledge and delivery support attached to the topic.">
          <div className="space-y-3">
            {topicDocuments.map((document) => (
              <div key={document.id} className="rounded-2xl border border-line bg-white p-4">
                <p className="text-sm font-semibold text-ink">{document.title}</p>
                <p className="mt-2 text-xs text-muted">{document.type} - Updated {document.updatedAt}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
