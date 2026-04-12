import { FileText, FolderKanban, MessageSquareText, Network, StickyNote } from "lucide-react";
import { SectionCard } from "../../components/ui/section-card";
import { documents, tickets, topics } from "../../data/mock-data";

const ticketColumns = ["Backlog", "Todo", "In Progress", "Review", "Done", "Blocked"] as const;

export function SpacePage() {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-4">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center gap-3 text-white">
            <FolderKanban className="h-5 w-5 text-brand-100" />
            Tracking
          </div>
          <p className="mt-3 text-sm text-slate-400">Backlog, kanban, roadmap, and linked delivery signals.</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center gap-3 text-white">
            <FileText className="h-5 w-5 text-brand-100" />
            Documents
          </div>
          <p className="mt-3 text-sm text-slate-400">Structured knowledge with folders, pages, and rich content.</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center gap-3 text-white">
            <MessageSquareText className="h-5 w-5 text-brand-100" />
            Let's Chat
          </div>
          <p className="mt-3 text-sm text-slate-400">Contextual AI assistance grounded in your project and topic data.</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center gap-3 text-white">
            <Network className="h-5 w-5 text-brand-100" />
            Topic memory
          </div>
          <p className="mt-3 text-sm text-slate-400">Facts, decisions, risks, dependencies, and open questions.</p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <SectionCard title="Kanban overview" subtitle="A first product-facing delivery board aligned with Jira-like workflows.">
          <div className="grid gap-4 xl:grid-cols-3 2xl:grid-cols-6">
            {ticketColumns.map((column) => (
              <div key={column} className="rounded-3xl border border-white/10 bg-slate-950/40 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">{column}</h3>
                  <span className="rounded-full bg-white/5 px-2 py-1 text-xs text-slate-400">
                    {tickets.filter((ticket) => ticket.status === column).length}
                  </span>
                </div>
                <div className="space-y-3">
                  {tickets
                    .filter((ticket) => ticket.status === column)
                    .map((ticket) => (
                      <article key={ticket.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{ticket.id}</p>
                        <h4 className="mt-2 text-sm font-medium text-white">{ticket.title}</h4>
                        <p className="mt-2 text-xs text-slate-400">
                          {ticket.type} · {ticket.priority} · {ticket.topic}
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
              {topics.map((topic) => (
                <div key={topic.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-medium text-white">{topic.title}</h4>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">{topic.status}</span>
                  </div>
                  <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">Priority: {topic.priority}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Documents" subtitle="Confluence-style knowledge spaces tied to delivery context.">
            <div className="space-y-3">
              {documents.map((document) => (
                <div key={document.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center gap-3">
                    <StickyNote className="h-4 w-4 text-brand-100" />
                    <div>
                      <p className="text-sm font-medium text-white">{document.title}</p>
                      <p className="text-xs text-slate-400">{document.type}</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-500">{document.updatedAt}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </section>
    </div>
  );
}
