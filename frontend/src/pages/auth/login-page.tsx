import { Eye, EyeOff, Layers, Loader2, Sparkles, Zap } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../../lib/api";
import { useAuthStore } from "../../stores/auth-store";

const FEATURES = [
  { icon: Layers,   label: "Suivi",       desc: "Backlog · Kanban · Roadmap" },
  { icon: Sparkles, label: "Let's Chat",  desc: "IA contextuelle · Shadow Core" },
  { icon: Zap,      label: "Documents",   desc: "Pages · Mermaid · Wiki" },
];

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [email, setEmail]         = useState("meryem.ghass@example.com");
  const [password, setPassword]   = useState("ShadowPO123");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPw, setShowPw]       = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password, rememberMe);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Identifiants incorrects");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="grid w-full max-w-5xl gap-5 lg:grid-cols-[1.35fr_1fr]">

        {/* ── Left: brand / pitch ────────────────────────────────────── */}
        <section className="relative flex flex-col justify-between overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 p-10 text-white shadow-lg">
          {/* subtle grid bg */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,.4) 1px, transparent 1px),
                                linear-gradient(90deg, rgba(255,255,255,.4) 1px, transparent 1px)`,
              backgroundSize: "32px 32px",
            }}
          />

          <div className="relative">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
                <Layers className="h-5 w-5 text-white" />
              </div>
              <span className="text-sm font-semibold text-white/90">Shadow PO AI</span>
            </div>

            <h1 className="mt-10 text-3xl font-bold leading-tight tracking-tight">
              Le cockpit IA du<br />
              Product Owner moderne.
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-white/70">
              Suivi, documentation et IA contextuelle dans un seul workspace — sans jongler entre Jira, Confluence et ChatGPT.
            </p>
          </div>

          <div className="relative mt-10 grid grid-cols-3 gap-3">
            {FEATURES.map((f) => (
              <div
                key={f.label}
                className="flex flex-col gap-2.5 rounded-2xl bg-white/10 p-4 backdrop-blur-sm"
              >
                <f.icon className="h-4 w-4 text-white/80" />
                <div>
                  <p className="text-xs font-semibold text-white">{f.label}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-white/60">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Right: login form ────────────────────────────────────────── */}
        <section className="flex flex-col justify-center rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-ink">Connexion</h2>
            <p className="mt-1 text-sm text-muted">Accédez à votre workspace PO.</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {error && (
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-muted">
                Email
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="prenom.nom@entreprise.fr"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-muted">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-11 text-sm text-ink outline-none transition focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted transition hover:text-ink"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-brand-500"
                />
                Se souvenir de moi
              </label>
              <button type="button" className="text-xs font-medium text-brand-600 transition hover:text-brand-700">
                Mot de passe oublié
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Connexion…" : "Se connecter"}
            </button>
          </form>

          <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-[11px] text-muted">
              <span className="font-semibold text-ink">Démo :</span>{" "}
              <span className="font-mono">meryem.ghass@example.com</span>{" "}
              /{" "}
              <span className="font-mono">ShadowPO123</span>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
