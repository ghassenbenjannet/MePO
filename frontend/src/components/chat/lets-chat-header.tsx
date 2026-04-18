import { History, MessageSquare, RotateCcw } from "lucide-react";
import { cn } from "../../lib/utils";

export function LetsChatHeader({
  exchangeCount,
  showHistory,
  onToggleHistory,
  onReset,
}: {
  exchangeCount: number;
  showHistory: boolean;
  onToggleHistory: () => void;
  onReset: () => void;
}) {
  return (
    <div className="border-b border-[var(--border-subtle)] bg-[linear-gradient(135deg,rgba(183,217,76,0.12),rgba(183,217,76,0.03)_40%,rgba(255,255,255,0.98))] px-6 py-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,var(--brand),var(--brand-dark))] text-sm font-bold text-[var(--text-strong)] shadow-[var(--shadow-xs)]">
              SP
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--brand-dark)]">
                Copilote produit
              </p>
              <h2 className="mt-1 font-display text-[1.3rem] font-bold tracking-[-0.04em] text-[var(--text-strong)]">
                Espace de travail conversationnel
              </h2>
            </div>
            <span className="flex h-2.5 w-2.5 rounded-full bg-[var(--brand)]" title="Actif" />
          </div>

          <p className="mt-3 max-w-xl text-sm leading-7 text-[var(--text-muted)]">
            Analyse, cadrage, rédaction et arbitrage dans le contexte actif, avec une lecture plus calme et une mémoire utile.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {exchangeCount > 0 ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(183,217,76,0.24)] bg-[var(--brand-light)] px-3 py-1.5 text-[11px] font-semibold text-[var(--brand-dark)]"
              title="Mémoire de conversation active"
            >
              <MessageSquare className="h-3 w-3" />
              {exchangeCount} échange{exchangeCount > 1 ? "s" : ""}
            </span>
          ) : null}

          <button
            type="button"
            onClick={onToggleHistory}
            className={cn(
              "flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-[11px] font-medium transition",
              showHistory
                ? "border-[rgba(183,217,76,0.32)] bg-[var(--brand-light)] text-[var(--brand-dark)]"
                : "border-[var(--border)] bg-[var(--bg-panel-3)] text-[var(--text-muted)] hover:border-[rgba(183,217,76,0.26)] hover:text-[var(--text-strong)]",
            )}
            title="Historique des conversations"
          >
            <History className="h-3 w-3" />
            Historique
          </button>

          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1.5 rounded-2xl border border-[var(--border)] bg-[var(--bg-panel-3)] px-3 py-2 text-[11px] font-medium text-[var(--text-muted)] transition hover:border-[rgba(235,140,135,0.28)] hover:text-[var(--text-strong)]"
            title="Réinitialiser la conversation et effacer la mémoire"
          >
            <RotateCcw className="h-3 w-3" />
            Réinitialiser
          </button>
        </div>
      </div>
    </div>
  );
}
