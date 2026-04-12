import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Layers, Loader2 } from "lucide-react";
import { useAuthStore } from "../../stores/auth-store";
import { ApiError } from "../../lib/api";

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState("meryem.ghass@example.com");
  const [password, setPassword] = useState("ShadowPO123");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password, rememberMe);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-body)] px-6 py-12">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1.2fr_0.8fr]">

        {/* Left — brand pitch */}
        <section className="flex flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-10">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500">
                <Layers className="h-5 w-5 text-white" />
              </div>
              <span className="text-sm font-semibold text-[var(--text-strong)]">Shadow PO AI</span>
            </div>
            <h1 className="mt-8 text-3xl font-bold leading-tight text-[var(--text-strong)]">
              Suivi, documentation et IA contextuelle dans un seul workspace PO.
            </h1>
            <p className="mt-4 text-sm leading-7 text-[var(--text-muted)]">
              Remplace les onglets Jira + Confluence + ChatGPT par un cockpit unifié qui centralise
              ton contexte produit et le transmet intelligemment à l'IA.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-3 gap-3">
            {[
              { label: "Suivi", desc: "Backlog · Kanban · Roadmap" },
              { label: "Documents", desc: "Pages · Mermaid · Wiki" },
              { label: "Let's Chat", desc: "IA contextuelle · Shadow PO" },
            ].map((f) => (
              <div
                key={f.label}
                className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] p-4"
              >
                <p className="text-xs font-semibold text-brand-500">{f.label}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Right — login form */}
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-8">
          <h2 className="text-xl font-bold text-[var(--text-strong)]">Se connecter</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Accède à ton workspace PO.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            {error && (
              <div className="rounded-lg border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
                {error}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="prenom.nom@entreprise.fr"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 py-2.5 text-sm text-[var(--text-strong)] outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 py-2.5 pr-10 text-sm text-[var(--text-strong)] outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-strong)]"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text-muted)]">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-[var(--border)] accent-brand-500"
                />
                Se souvenir de moi
              </label>
              <button type="button" className="text-xs font-medium text-brand-500 hover:underline">
                Mot de passe oublié
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Connexion…" : "Se connecter"}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-[var(--text-muted)]">
            Identifiants de démonstration :{" "}
            <span className="font-mono text-brand-500">meryem.ghass@example.com / ShadowPO123</span>
          </p>
        </section>
      </div>
    </div>
  );
}
