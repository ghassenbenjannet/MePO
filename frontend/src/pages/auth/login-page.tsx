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

  const [email, setEmail]           = useState("ghassenbenjannet1@gmail.com");
  const [password, setPassword]     = useState("ShadowPO123");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPw, setShowPw]         = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

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
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-body)] px-4 py-12">
      <div className="grid w-full max-w-5xl gap-5 lg:grid-cols-[1.35fr_1fr]">

        {/* ── Left: brand / pitch ─────────────────────────────────── */}
        <section
          className="relative flex flex-col justify-between overflow-hidden rounded-3xl p-10 text-white shadow-brand"
          style={{ background: "linear-gradient(135deg, #4338ca 0%, #4f46e5 45%, #6366f1 100%)" }}
        >
          {/* Subtle grid overlay */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,.4) 1px, transparent 1px),
                                linear-gradient(90deg, rgba(255,255,255,.4) 1px, transparent 1px)`,
              backgroundSize: "32px 32px",
            }}
          />
          {/* Glow blob */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />

          <div className="relative">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                <Layers className="h-5 w-5 text-white" />
              </div>
              <span className="text-sm font-semibold text-white/90">Shadow PO AI</span>
            </div>

            <h1 className="mt-10 font-display text-4xl font-extrabold leading-tight tracking-tight">
              MePO
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              Gestion produit, documentation et assistant IA dans une seule interface.
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

        {/* ── Right: login form ────────────────────────────────────── */}
        <section className="flex flex-col justify-center rounded-3xl border border-[var(--border)] bg-[var(--bg-panel)] p-8 shadow-sm">
          <div>
            <p className="panel-eyebrow">Connexion</p>
            <h2 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-[var(--text-strong)]">
              Bon retour 👋
            </h2>
            <p className="mt-1.5 text-sm text-[var(--text-muted)]">
              Accédez à votre environnement de travail.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            {error && (
              <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-600">
                {error}
              </div>
            )}

            <div>
              <label className="label">Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="prenom.nom@entreprise.fr"
                className="input"
              />
            </div>

            <div>
              <label className="label">Mot de passe</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] transition hover:text-[var(--text-strong)]"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-[var(--text-muted)]">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-[var(--border)] accent-brand-600"
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
              className="btn-primary w-full justify-center py-3 disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Connexion…" : "Se connecter"}
            </button>
          </form>

          {/* Demo credentials hint */}
          <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] px-4 py-3">
            <p className="text-[11px] text-[var(--text-muted)]">
              <span className="font-semibold text-[var(--text-strong)]">Démo :</span>{" "}
              <span className="font-mono text-brand-600">ghassenbenjannet1@gmail.com</span>{" "}
              /{" "}
              <span className="font-mono text-brand-600">ShadowPO123</span>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
