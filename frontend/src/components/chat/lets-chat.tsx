import { useState, useRef, useEffect } from "react";
import {
  AlertCircle,
  Brain,
  Check,
  CheckCircle2,
  ChevronRight,
  Compass,
  Copy,
  Info,
  Loader2,
  PenTool,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Settings2,
  Sparkles,
  Target,
  X,
  Zap,
} from "lucide-react";
import { cn } from "../../lib/utils";
import type { Document, Ticket, Topic } from "../../types/domain";

// ─── Mode meta ────────────────────────────────────────────────────────────────

type ModeMeta = { label: string; icon: React.ElementType; colorCls: string; bgCls: string };

const MODE_META: Record<string, ModeMeta> = {
  cadrage: { label: "Cadrage", icon: Target, colorCls: "text-blue-500", bgCls: "bg-blue-500/10" },
  impact: { label: "Impact", icon: Zap, colorCls: "text-orange-500", bgCls: "bg-orange-500/10" },
  pilotage: { label: "Pilotage", icon: Compass, colorCls: "text-emerald-500", bgCls: "bg-emerald-500/10" },
  analyse_fonctionnelle: { label: "Analyse Fonct.", icon: Search, colorCls: "text-purple-500", bgCls: "bg-purple-500/10" },
  analyse_technique: { label: "Analyse Tech.", icon: Settings2, colorCls: "text-slate-500", bgCls: "bg-slate-500/10" },
  redaction: { label: "Rédaction", icon: PenTool, colorCls: "text-teal-500", bgCls: "bg-teal-500/10" },
  transformation: { label: "Transformation", icon: RefreshCw, colorCls: "text-pink-500", bgCls: "bg-pink-500/10" },
  memoire: { label: "Mémoire", icon: Brain, colorCls: "text-amber-500", bgCls: "bg-amber-500/10" },
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface Evidence {
  label: string;
  confidence: "certain" | "inferred" | "to_confirm";
}

interface ActionSuggestion {
  type: string;
  label: string;
  requires_confirmation: boolean;
}

interface ContextSource {
  kind: string;
  label: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode?: string;
  evidence?: Evidence[];
  suggestions?: ActionSuggestion[];
  timestamp: Date;
}

// ─── Quick suggestions ────────────────────────────────────────────────────────

const QUICK_CHIPS = [
  "Analyse les tickets bloqués",
  "Résume le backlog prioritaire",
  "Identifie les risques du sprint",
  "Génère un plan de recette",
  "Dresse la liste des open questions",
];

// ─── Confidence badge ─────────────────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: Evidence["confidence"] }) {
  if (confidence === "certain")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-2.5 w-2.5" />certain
      </span>
    );
  if (confidence === "inferred")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
        <Info className="h-2.5 w-2.5" />inféré
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
      <AlertCircle className="h-2.5 w-2.5" />à confirmer
    </span>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  onConfirmAction,
}: {
  msg: ChatMessage;
  onConfirmAction: (type: string, label: string) => void;
}) {
  const [confirmedActions, setConfirmedActions] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const mode = msg.mode ? MODE_META[msg.mode] : null;

  function copyText() {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-brand-500 px-4 py-3 shadow-sm">
          <p className="text-sm leading-relaxed text-white">{msg.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      {/* Avatar */}
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 text-[11px] font-bold text-white shadow-sm">
        SP
      </div>

      <div className="min-w-0 flex-1">
        {/* Mode badge */}
        {mode && (
          <div
            className={cn(
              "mb-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
              mode.bgCls,
              mode.colorCls,
            )}
          >
            <mode.icon className="h-3 w-3" />
            {mode.label}
          </div>
        )}

        {/* Message */}
        <div className="rounded-2xl rounded-tl-sm bg-[var(--bg-panel-2)] px-4 py-3 shadow-sm">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-strong)]">
            {msg.content}
          </p>
        </div>

        {/* Evidence */}
        {msg.evidence && msg.evidence.length > 0 && (
          <div className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Évidences
            </p>
            <div className="space-y-1.5">
              {msg.evidence.map((ev, i) => (
                <div key={i} className="flex items-start gap-2">
                  <ConfidenceBadge confidence={ev.confidence} />
                  <p className="text-xs leading-relaxed text-[var(--text-strong)]">{ev.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action proposals */}
        {msg.suggestions && msg.suggestions.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {msg.suggestions.map((s) => {
              const isConfirmed = confirmedActions.has(s.type);
              return (
                <div
                  key={s.type}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-xl border px-3 py-2 transition",
                    isConfirmed
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-[var(--border)] bg-[var(--bg-panel)]",
                  )}
                >
                  <span
                    className={cn(
                      "text-xs font-medium",
                      isConfirmed
                        ? "line-through text-emerald-600 dark:text-emerald-400"
                        : "text-[var(--text-strong)]",
                    )}
                  >
                    {s.label}
                  </span>
                  {!isConfirmed ? (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => {
                          setConfirmedActions((prev) => new Set([...prev, s.type]));
                          onConfirmAction(s.type, s.label);
                        }}
                        className="flex items-center gap-1 rounded-lg bg-brand-500 px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-brand-600"
                      >
                        <Check className="h-3 w-3" />
                        Valider
                      </button>
                      <button className="flex items-center rounded-lg border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--text-muted)] transition hover:text-[var(--text-strong)]">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                      <Check className="h-3 w-3" />
                      Validé
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Copy button */}
        <button
          onClick={copyText}
          className="mt-1.5 flex items-center gap-1 text-[10px] text-[var(--text-muted)] transition hover:text-[var(--text-strong)]"
        >
          <Copy className="h-2.5 w-2.5" />
          {copied ? "Copié !" : "Copier"}
        </button>
      </div>
    </div>
  );
}

// ─── Main LetsChat component ──────────────────────────────────────────────────

interface LetsChatProps {
  spaceId: string;
  spaceName: string;
  projectId: string;
  topics: Topic[];
  tickets: Ticket[];
  documents: Document[];
}

export function LetsChat({
  spaceId,
  spaceName,
  projectId,
  topics,
  tickets,
  documents,
}: LetsChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [contextSources, setContextSources] = useState<ContextSource[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const blockedCount = tickets.filter((t) => t.status === "blocked").length;
  const backlogCount = tickets.filter((t) => t.status === "backlog").length;

  // Welcome message on mount
  useEffect(() => {
    const parts: string[] = [
      `Bonjour ! Je suis Shadow PO, ton assistant IA intégré.`,
      `J'ai accès à ${topics.length} topic${topics.length !== 1 ? "s" : ""} et ${tickets.length} ticket${tickets.length !== 1 ? "s" : ""} sur l'espace "${spaceName}".`,
    ];
    if (blockedCount > 0) parts.push(`⚠️ ${blockedCount} ticket${blockedCount > 1 ? "s" : ""} bloqué${blockedCount > 1 ? "s" : ""} — nécessite une attention.`);
    if (backlogCount > 0) parts.push(`📋 ${backlogCount} ticket${backlogCount > 1 ? "s" : ""} en backlog à prioriser.`);
    parts.push(`Que veux-tu accomplir ?`);
    setMessages([{ id: "welcome", role: "assistant", content: parts.join("\n"), timestamp: new Date() }]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    setLoading(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          space_id: spaceId,
          project_id: projectId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail ?? `HTTP ${res.status}`);

      const aiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.message,
        mode: data.mode,
        evidence: data.evidence,
        suggestions: data.suggestions,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMsg]);
      if (data.context_used?.length) setContextSources(data.context_used);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Erreur inconnue";
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `⚠️ Shadow Core — ${detail}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleConfirmAction(type: string, label: string) {
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Action "${label}" enregistrée. Je prépare l'exécution...`,
        timestamp: new Date(),
      },
    ]);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function resetChat() {
    setMessages([
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Conversation réinitialisée. Que puis-je faire pour toi sur "${spaceName}" ?`,
        timestamp: new Date(),
      },
    ]);
    setContextSources([]);
  }

  const blockedTickets = tickets.filter((t) => t.status === "blocked");

  return (
    <div className="flex gap-4" style={{ height: "calc(100vh - 230px)", minHeight: 500 }}>
      {/* ── Main chat area ── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 text-[11px] font-bold text-white">
              SP
            </div>
            <span className="text-sm font-semibold text-[var(--text-strong)]">Let's Chat</span>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              actif
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={resetChat}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition hover:text-[var(--text-strong)]"
              title="Réinitialiser"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto p-4">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} onConfirmAction={handleConfirmAction} />
          ))}

          {/* Quick chips — only before first user message */}
          {messages.length === 1 && !loading && (
            <div className="flex flex-wrap gap-2 pl-11">
              {QUICK_CHIPS.map((chip) => (
                <button
                  key={chip}
                  onClick={() => sendMessage(chip)}
                  className="rounded-full border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition hover:border-brand-500/50 hover:text-brand-500"
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          {/* Typing indicator */}
          {loading && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 text-[11px] font-bold text-white">
                SP
              </div>
              <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm bg-[var(--bg-panel-2)] px-4 py-3 shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin text-brand-500" />
                <span className="text-sm text-[var(--text-muted)]">Shadow Core réfléchit…</span>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-[var(--border)] p-3">
          <div className="flex items-end gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 py-2 transition focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = "auto";
                t.style.height = Math.min(t.scrollHeight, 120) + "px";
              }}
              placeholder="Dis-moi ce que tu veux analyser ou créer… (Entrée pour envoyer)"
              className="flex-1 resize-none bg-transparent text-sm text-[var(--text-strong)] outline-none placeholder:text-[var(--text-muted)]"
              style={{ maxHeight: 120 }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="btn-primary flex-shrink-0 disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-[var(--text-muted)]">
            Entrée pour envoyer · Shift+Entrée pour nouvelle ligne · Shadow Core v0.1
          </p>
        </div>
      </div>

      {/* ── Context sidebar ── */}
      <div className="w-60 flex-shrink-0 space-y-3 overflow-y-auto">
        {/* Active context */}
        <div className="card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-brand-500" />
            <p className="text-xs font-bold text-[var(--text-strong)]">Contexte actif</p>
          </div>
          <div className="space-y-2.5">
            {[
              { label: "Espace", value: spaceName },
              { label: "Topics", value: `${topics.length} actif${topics.length !== 1 ? "s" : ""}` },
              { label: "Tickets", value: `${tickets.length} total` },
              { label: "Documents", value: `${documents.length}` },
            ].map((row) => (
              <div key={row.label}>
                <p className="section-title">{row.label}</p>
                <p className="mt-0.5 text-xs font-medium text-[var(--text-strong)]">{row.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Attention points */}
        {(blockedTickets.length > 0 || backlogCount > 0) && (
          <div className="card p-4">
            <p className="mb-2 text-xs font-bold text-[var(--text-strong)]">Points d'attention</p>
            <div className="space-y-2">
              {blockedTickets.length > 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-red-500/5 p-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {blockedTickets.length} bloqué{blockedTickets.length > 1 ? "s" : ""}
                  </p>
                </div>
              )}
              {backlogCount > 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-amber-500/5 p-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    {backlogCount} en backlog
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Topics list */}
        {topics.length > 0 && (
          <div className="card p-4">
            <p className="mb-2 text-xs font-bold text-[var(--text-strong)]">Topics</p>
            <div className="space-y-1.5">
              {topics.slice(0, 6).map((t) => (
                <div key={t.id} className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-500/50" />
                  <p className="truncate text-xs text-[var(--text-muted)]">{t.title}</p>
                </div>
              ))}
              {topics.length > 6 && (
                <p className="text-[10px] text-[var(--text-muted)]">+{topics.length - 6} autres</p>
              )}
            </div>
          </div>
        )}

        {/* Context sources from last response */}
        {contextSources.length > 0 && (
          <div className="card p-4">
            <p className="mb-2 text-xs font-bold text-[var(--text-strong)]">Sources utilisées</p>
            <div className="space-y-1.5">
              {contextSources.map((s, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <ChevronRight className="mt-0.5 h-3 w-3 flex-shrink-0 text-brand-500" />
                  <p className="text-xs text-[var(--text-muted)]">
                    <span className="font-medium text-brand-500">{s.kind}</span> · {s.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modes reference */}
        <div className="card p-4">
          <p className="mb-2 text-xs font-bold text-[var(--text-strong)]">Modes IA</p>
          <div className="space-y-1.5">
            {Object.entries(MODE_META).map(([, m]) => (
              <div key={m.label} className="flex items-center gap-2">
                <m.icon className={cn("h-3 w-3 flex-shrink-0", m.colorCls)} />
                <p className="text-xs text-[var(--text-muted)]">{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
