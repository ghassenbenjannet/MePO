import { FileText, FolderKanban, MessageSquareText, Network, StickyNote } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "../../components/ui/page-header";
import { SectionCard } from "../../components/ui/section-card";
import { documents, tickets, topics } from "../../data/mock-data";

const ticketColumns = ["Backlog", "Todo", "In Progress", "Review", "Done", "Blocked"] as const;

export function SpacePage() {
  const { projectId, spaceId } = useParams();
  const scopedTopics = topics.filter((topic) => topic.spaceId === spaceId);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Space hub"
        title="S1 2026"
        description="The main PO work hub: follow execution, connect documentation, and use contextual AI without leaving the space."
        actions={
          <>
            <button className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium text-ink">New ticket</button>
            <button className="rounded-2xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white">Open Let's Chat</button>
          </>
        }
      />

      <section className="grid gap-4 xl:grid-cols-4">
        <div className="rounded-[28px] border border-line bg-white p-5 shadow-panel">
          <div className="flex items-center gap-3 text-ink">
            <FolderKanban className="h-5 w-5 text-brand-600" />
            Tracking
          </div>
          <p className="mt-3 text-sm text-muted">Backlog, kanban, roadmap, and linked delivery signals.</p>
        </div>
        <div className="rounded-[28px] border border-line bg-white p-5 shadow-panel">
          <div className="flex items-center gap-3 text-ink">
            <FileText className="h-5 w-5 text-brand-600" />
            Documents
          </div>
          <p className="mt-3 text-sm text-muted">Structured knowledge with folders, pages, and rich content.</p>
        </div>
        <div className="rounded-[28px] border border-line bg-white p-5 shadow-panel">
          <div className="flex items-center gap-3 text-ink">
            <MessageSquareText className="h-5 w-5 text-brand-600" />
            Let's Chat
          </div>
          <p className="mt-3 text-sm text-muted">Contextual AI assistance grounded in your project and topic data.</p>
        </div>
        <div className="rounded-[28px] border border-line bg-white p-5 shadow-panel">
          <div className="flex items-center gap-3 text-ink">
            <Network className="h-5 w-5 text-brand-600" />
            Topic memory
          </div>
          <p className="mt-3 text-sm text-muted">Facts, decisions, risks, dependencies, and open questions.</p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <SectionCard title="Kanban overview" subtitle="A productive backlog view aligned with real PO execution patterns.">
          <div className="grid gap-4 xl:grid-cols-3 2xl:grid-cols-6">
            {ticketColumns.map((column) => (
              <div key={column} className="rounded-3xl border border-line bg-slate-50 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-ink">{column}</h3>
                  <span className="rounded-full bg-white px-2 py-1 text-xs text-muted">
                    {tickets.filter((ticket) => ticket.status === column).length}
                  </span>
                </div>
                <div className="space-y-3">
                  {tickets
                    .filter((ticket) => ticket.status === column)
                    .map((ticket) => (
                      <article key={ticket.id} className="rounded-2xl border border-line bg-white p-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted">{ticket.id}</p>
                        <h4 className="mt-2 text-sm font-medium text-ink">{ticket.title}</h4>
                        <p className="mt-2 text-xs text-muted">
                          {ticket.type} - {ticket.priority} - {ticket.topic}
                        </p>
                      </article>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Topics" subtitle="Structured subjects that connect delivery, docs, and AI memory.">
            <div className="space-y-3">
              {scopedTopics.map((topic) => (
                <Link
                  key={topic.id}
                  to={`/projects/${projectId}/spaces/${spaceId}/topics/${topic.id}`}
                  className="block rounded-2xl border border-line bg-slate-50 p-4 transition hover:border-brand-200"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-medium text-ink">{topic.title}</h4>
                    <span className="rounded-full bg-brand-50 px-3 py-1 text-xs text-brand-600">{topic.status}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted">{topic.description}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.2em] text-muted">Priority: {topic.priority}</p>
                </Link>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Documents" subtitle="Confluence-style knowledge spaces tied to delivery context.">
            <div className="space-y-3">
              {documents.map((document) => (
                <div key={document.id} className="flex items-center justify-between rounded-2xl border border-line bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    <StickyNote className="h-4 w-4 text-brand-600" />
                    <div>
                      <p className="text-sm font-medium text-ink">{document.title}</p>
                      <p className="text-xs text-muted">{document.type}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted">{document.updatedAt}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </section>
    </div>
  );
}
