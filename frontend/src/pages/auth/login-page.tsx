export function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[32px] border border-line bg-white p-10 shadow-panel">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-brand-600">Shadow PO AI</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-ink">
            Product operations, documentation, and contextual AI in one clear workspace.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-muted">
            Replace fragmented Jira and Confluence habits with a single PO cockpit focused on structure,
            delivery clarity, and actionable AI.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              ["Suivi", "Backlog, kanban, roadmap, and topic-based execution."],
              ["Documents", "Clear documentation linked to delivery context."],
              ["Let's Chat", "Minimal, disciplined AI oriented toward outputs."],
            ].map(([title, text]) => (
              <div key={title} className="rounded-3xl border border-line bg-slate-50 p-4">
                <h2 className="text-sm font-semibold text-ink">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[32px] border border-line bg-white p-8 shadow-panel">
          <h2 className="text-2xl font-semibold text-ink">Se connecter</h2>
          <p className="mt-2 text-sm text-muted">Accede a ton dernier projet ou au dashboard.</p>
          <form className="mt-8 space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">Email</span>
              <input
                type="email"
                placeholder="prenom.nom@entreprise.fr"
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">Mot de passe</span>
              <input
                type="password"
                placeholder="Minimum 8 caracteres"
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
              />
            </label>
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-muted">
                <input type="checkbox" className="h-4 w-4 rounded border-line" />
                Se souvenir de moi
              </label>
              <a href="/" className="font-medium text-brand-600">
                Mot de passe oublie
              </a>
            </div>
            <button className="w-full rounded-2xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-600">
              Se connecter
            </button>
            <button className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium text-ink transition hover:bg-slate-50">
              Creer un compte
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
