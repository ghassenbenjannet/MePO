import { useEffect, useMemo } from "react";
import type { KeyboardEvent, RefObject } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { Button } from "../ui/button";

type ChatComposerProps = {
  value: string;
  loading: boolean;
  disabled?: boolean;
  error?: string | null;
  inputRef: RefObject<HTMLTextAreaElement>;
  contextCounts: {
    topics: number;
    tickets: number;
    documents: number;
  };
  onChange: (value: string) => void;
  onSend: () => void;
};

export function ChatComposer({
  value,
  loading,
  disabled = false,
  error,
  inputRef,
  contextCounts,
  onChange,
  onSend,
}: ChatComposerProps) {
  useEffect(() => {
    const element = inputRef.current;
    if (!element) return;
    element.style.height = "0px";
    element.style.height = `${Math.min(element.scrollHeight, 220)}px`;
  }, [inputRef, value]);

  const helperText = useMemo(() => {
    const sources = [
      contextCounts.topics > 0 ? `${contextCounts.topics} topics` : null,
      contextCounts.tickets > 0 ? `${contextCounts.tickets} tickets` : null,
      contextCounts.documents > 0 ? `${contextCounts.documents} documents` : null,
    ].filter(Boolean);

    if (sources.length === 0) {
      return "Posez une question, demandez une synthese ou demandez un plan d action.";
    }
    return `Contexte actif: ${sources.join(" / ")}.`;
  }, [contextCounts.documents, contextCounts.tickets, contextCounts.topics]);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  };

  return (
    <div className="chat-composer-shell">
      {error ? (
        <div className="chat-inline-error" role="status" aria-live="polite">
          <p className="font-semibold text-[var(--text-strong)]">Envoi interrompu</p>
          <p>{error}</p>
        </div>
      ) : null}

      <div className="chat-composer-card">
        <div className="chat-composer-heading">
          <div>
            <p className="chat-composer-eyebrow">Composer</p>
            <p className="chat-composer-caption">{helperText}</p>
          </div>
          <span className="chat-toolbar-pill">
            <Sparkles className="h-3.5 w-3.5" />
            Assistant actif
          </span>
        </div>

        <label className="sr-only" htmlFor="chat-composer-input">
          Saisissez votre message
        </label>
        <textarea
          id="chat-composer-input"
          ref={inputRef}
          rows={3}
          value={value}
          disabled={disabled || loading}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Demandez une synthese, une priorisation, un arbitrage ou une prochaine action..."
          className="chat-composer-input"
        />

        <div className="chat-composer-footer">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)]">
            <span className="chat-toolbar-pill-subtle">Enter pour envoyer</span>
            <span className="chat-toolbar-pill-subtle">Shift + Enter pour une nouvelle ligne</span>
            <span className="chat-toolbar-pill-subtle">{Math.max(value.trim().length, 0)} caracteres</span>
          </div>
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={onSend}
            disabled={disabled || loading || !value.trim()}
            leadingIcon={loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            className="chat-send-button"
          >
            {loading ? "Generation..." : "Envoyer"}
          </Button>
        </div>
      </div>
    </div>
  );
}
