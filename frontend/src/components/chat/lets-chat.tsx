import { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Brain,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Compass,
  Copy,
  FileText,
  HelpCircle,
  History,
  Info,
  Layers,
  Loader2,
  MessageSquare,
  PenTool,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Settings2,
  Sparkles,
  Target,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { api } from "../../lib/api";
import type { Document, Ticket, Topic } from "../../types/domain";
import { LetsChatHeader } from "./lets-chat-header";
import { LetsChatHistoryPanel } from "./lets-chat-history-panel";
import {
  useConversations,
  useCreateConversation,
  useAppendMessages,
  useDeleteConversation,
  type ConversationSummary,
} from "../../hooks/use-conversations";
import { useAuthStore } from "../../stores/auth-store";

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface RelatedObject { kind: string; id: string; label: string }
interface CertaintyBlock { certain: string[]; inferred: string[]; to_confirm: string[] }
interface TopicCandidate { id: string; name: string; nature: string; score: number; score_breakdown: string }
interface TopicResolution {
  match_status: "exact_match" | "possible_matches" | "no_match";
  suggested_topic_id: string | null;
  suggested_topic_name: string | null;
  suggested_topic_nature: string | null;
  candidate_topics: TopicCandidate[];
  top_score: number;
  decision_reason: string;
  context_used: string;
}
interface ProposedAction {
  action_id: string;
  type: string;
  label: string;
  payload: Record<string, unknown>;
  requires_confirmation: boolean;
}
interface GeneratedObject { type: string; label: string; content: Record<string, unknown> }
interface MemoryUpdate   { field: string; content: string }
interface ContextObject  { kind: string; id: string; label: string; content: Record<string, unknown> }

interface KnowledgeDocRef {
  id: string; title: string; document_type: string; openai_file_id: string | null;
}

interface DebugInfo {
  mode_detected: string; confidence: string; reading_line: string; skill: string;
  context_policy: string; objects_injected: number; tokens_estimate: number;
  prompt_summary: string; context_objects: ContextObject[]; knowledge_docs: KnowledgeDocRef[];
  file_ids_sent: string[]; used_responses_api: boolean; raw_llm_response: Record<string, unknown>;
  retrieval_trace?: {
    mode: string;
    final_level: string;
    vector_store_allowed: boolean;
    vector_store_used: boolean;
    steps: Array<{ level: string; used: boolean; reason: string; item_count: number }>;
  };
}

interface ChatMessage {
  id: string; role: "user" | "assistant";
  content?: string;         // user text
  mode?: string;
  understanding?: string;
  related_objects?: RelatedObject[];
  answer_markdown?: string;
  certainty?: CertaintyBlock;
  next_actions?: string[];
  proposed_actions?: ProposedAction[];
  generated_objects?: GeneratedObject[];
  memory_updates?: MemoryUpdate[];
  knowledge_docs_used?: KnowledgeDocRef[];
  context_objects?: ContextObject[];  // always returned from backend for action pickers
  debug?: DebugInfo;
  is_truncated?: boolean;
  full_content_available?: boolean;
  content_chars?: number;
  metadata_chars?: number;
  timestamp: Date;
}

interface PersistedConversationMessage {
  id: string;
  role: string;
  content: string;
  metadata: Record<string, unknown>;
  is_truncated?: boolean;
  full_content_available?: boolean;
  content_chars?: number;
  metadata_chars?: number;
}

interface PersistedConversationDetail {
  messages: PersistedConversationMessage[];
  total_message_count: number;
  loaded_message_count: number;
  has_more: boolean;
  next_offset: number | null;
}

interface LoadedConversationState {
  id: string;
  loadedCount: number;
  totalCount: number;
  hasMore: boolean;
  nextOffset: number | null;
}

interface ConversationPerformanceMetrics {
  loadedMessages: number;
  renderedMessages: number;
  totalPayloadChars: number;
  largestMessageChars: number;
  openDurationMs: number | null;
  initialRenderMs: number | null;
  deferredHeavyBlocks: number;
  heavyConversation: boolean;
  messageRenderCounts: Array<{ id: string; renders: number }>;
}

// ─── Mode config ──────────────────────────────────────────────────────────────

const MODE_CONFIG: Record<string, {
  label: string; icon: React.ElementType;
  color: string; bg: string; border: string; dot: string;
}> = {
  cadrage:               { label: "Cadrage",          icon: Target,    color: "text-brand-700",    bg: "bg-brand-50",    border: "border-brand-200",   dot: "bg-brand-500" },
  impact:                { label: "Impact",            icon: Zap,       color: "text-amber-700",    bg: "bg-amber-50",    border: "border-amber-200",   dot: "bg-amber-500" },
  pilotage:              { label: "Pilotage",          icon: Compass,   color: "text-brand-800",    bg: "bg-brand-100",   border: "border-brand-200",   dot: "bg-brand-600" },
  analyse_fonctionnelle: { label: "Analyse Fonct.",    icon: Search,    color: "text-brand-700",    bg: "bg-brand-50",    border: "border-brand-200",   dot: "bg-brand-500" },
  analyse_technique:     { label: "Analyse Tech.",     icon: Settings2, color: "text-slate-600",   bg: "bg-slate-50",   border: "border-slate-200",  dot: "bg-slate-500" },
  redaction:             { label: "Rédaction",         icon: PenTool,   color: "text-brand-700",    bg: "bg-brand-50",    border: "border-brand-200",   dot: "bg-brand-500" },
  transformation:        { label: "Transformation",    icon: RefreshCw, color: "text-brand-800",    bg: "bg-brand-100",   border: "border-brand-200",   dot: "bg-brand-600" },
  memoire:               { label: "Mémoire",           icon: Brain,     color: "text-brand-700",    bg: "bg-brand-50",    border: "border-brand-200",   dot: "bg-brand-500" },
};

const HISTORY_PAGE_SIZE = 10;
const HEAVY_CONVERSATION_MESSAGE_THRESHOLD = 20;
const HEAVY_CONVERSATION_PAYLOAD_THRESHOLD = 28_000;
const HEAVY_MESSAGE_CHAR_THRESHOLD = 2_500;
const HEAVY_DEBUG_CHAR_THRESHOLD = 4_000;
const VERY_HEAVY_ANSWER_CHAR_THRESHOLD = 6_000;
const HEAVY_PREVIEW_CHARS = 900;
const HEAVY_INITIAL_RENDER_WINDOW = 4;

// ─── Markdown renderer ────────────────────────────────────────────────────────

function parseInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**"))
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        if (part.startsWith("*") && part.endsWith("*"))
          return <em key={i}>{part.slice(1, -1)}</em>;
        if (part.startsWith("`") && part.endsWith("`"))
          return <code key={i}>{part.slice(1, -1)}</code>;
        return part;
      })}
    </>
  );
}

function MarkdownBlock({ content, isLivrable = false }: { content: string; isLivrable?: boolean }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const t = raw.trim();

    if (!t) { i++; continue; }

    // Fenced code block
    if (t.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <pre key={key++}><code>{codeLines.join("\n")}</code></pre>
      );
      i++;
      continue;
    }

    // H1
    if (t.startsWith("# ") && !t.startsWith("## ")) {
      elements.push(<h1 key={key++}>{parseInline(t.slice(2))}</h1>);
      i++; continue;
    }
    // H2
    if (t.startsWith("## ") && !t.startsWith("### ")) {
      elements.push(<h2 key={key++}>{parseInline(t.slice(3))}</h2>);
      i++; continue;
    }
    // H3
    if (t.startsWith("### ")) {
      elements.push(<h3 key={key++}>{parseInline(t.slice(4))}</h3>);
      i++; continue;
    }

    // HR
    if (t.match(/^---+$/) || t.match(/^\*\*\*+$/)) {
      elements.push(<hr key={key++} />);
      i++; continue;
    }

    // Blockquote
    if (t.startsWith("> ")) {
      const bqLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("> ")) {
        bqLines.push(lines[i].trim().slice(2));
        i++;
      }
      elements.push(
        <blockquote key={key++}>{parseInline(bqLines.join(" "))}</blockquote>
      );
      continue;
    }

    // Unordered list
    if (t.match(/^[-*•] /)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trim().match(/^[-*•] /)) {
        items.push(lines[i].trim().replace(/^[-*•] /, ""));
        i++;
      }
      elements.push(
        <ul key={key++}>
          {items.map((item, j) => <li key={j}>{parseInline(item)}</li>)}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (t.match(/^\d+\. /)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trim().match(/^\d+\. /)) {
        items.push(lines[i].trim().replace(/^\d+\. /, ""));
        i++;
      }
      elements.push(
        <ol key={key++}>
          {items.map((item, j) => <li key={j}>{parseInline(item)}</li>)}
        </ol>
      );
      continue;
    }

    // Paragraph — collect until empty line or special line
    const paraLines: string[] = [];
    while (i < lines.length) {
      const pt = lines[i].trim();
      if (!pt) break;
      if (pt.startsWith("#") || pt.startsWith("```") || pt.startsWith("> ") ||
          pt.match(/^[-*•] /) || pt.match(/^\d+\. /) || pt.match(/^---+$/)) break;
      paraLines.push(pt);
      i++;
    }
    if (paraLines.length) {
      elements.push(<p key={key++}>{parseInline(paraLines.join(" "))}</p>);
    }
  }

  return <div className={cn("chat-md", isLivrable && "chat-livrable")}>{elements}</div>;
}

const MemoMarkdownBlock = memo(MarkdownBlock);

function HeavyMarkdownReader({
  content,
  isLivrable = false,
}: {
  content: string;
  isLivrable?: boolean;
}) {
  const chunks = useMemo(() => splitMarkdownIntoChunks(content), [content]);
  const [visibleChunkCount, setVisibleChunkCount] = useState(1);
  const visibleChunks = useMemo(
    () => chunks.slice(0, visibleChunkCount),
    [chunks, visibleChunkCount],
  );

  useEffect(() => {
    setVisibleChunkCount(1);
  }, [content]);

  return (
    <div className="space-y-3">
      {visibleChunks.map((chunk, index) => (
        <div key={`${index}-${chunk.length}`} className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3">
          <MemoMarkdownBlock content={chunk} isLivrable={isLivrable} />
        </div>
      ))}
      {visibleChunkCount < chunks.length && (
        <div className="flex justify-start">
          <button
            onClick={() => startTransition(() => setVisibleChunkCount((count) => Math.min(chunks.length, count + 1)))}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-[var(--text-muted)] transition hover:border-slate-300 hover:text-[var(--text-strong)]"
          >
            <ChevronDown className="h-3 w-3" />
            Charger la section suivante
            <span className="text-[10px] text-[var(--text-xmuted)]">
              ({visibleChunkCount}/{chunks.length})
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

const MemoHeavyMarkdownReader = memo(HeavyMarkdownReader);

function safeSerializedLength(value: unknown): number {
  try {
    return JSON.stringify(value)?.length ?? 0;
  } catch {
    return 0;
  }
}

function getPersistedMessagePayloadChars(message: PersistedConversationMessage): number {
  return (message.content?.length ?? 0) + safeSerializedLength(message.metadata);
}

function getChatMessagePayloadChars(message: ChatMessage): number {
  if (typeof message.content_chars === "number" && typeof message.metadata_chars === "number") {
    return message.content_chars + message.metadata_chars;
  }
  return (
    (message.content?.length ?? 0) +
    (message.answer_markdown?.length ?? 0) +
    (message.understanding?.length ?? 0) +
    safeSerializedLength(message.related_objects) +
    safeSerializedLength(message.certainty) +
    safeSerializedLength(message.next_actions) +
    safeSerializedLength(message.proposed_actions) +
    safeSerializedLength(message.generated_objects) +
    safeSerializedLength(message.memory_updates) +
    safeSerializedLength(message.knowledge_docs_used) +
    safeSerializedLength(message.context_objects) +
    safeSerializedLength(message.debug)
  );
}

function buildCompactTextPreview(text: string, limit: number = HEAVY_PREVIEW_CHARS): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  const clipped = normalized.slice(0, limit).trimEnd();
  const boundary = clipped.lastIndexOf(" ");
  const preview = boundary > 200 ? clipped.slice(0, boundary) : clipped;
  return `${preview}…`;
}

function normalizeMarkdownForDisplay(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/([^\n])\s(#{1,6}\s)/g, "$1\n\n$2")
    .replace(/([^\n])\s(>\s)/g, "$1\n$2")
    .replace(/([^\n])\s([-*â€¢]\s)/g, "$1\n$2")
    .replace(/([^\n])\s(\d+\.\s)/g, "$1\n$2")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildMarkdownPreviewContent(text: string, maxChars: number = 1400, maxLines: number = 18): string {
  const lines = text.split("\n");
  const preview: string[] = [];
  let chars = 0;
  let lineCount = 0;
  let inCodeBlock = false;
  let insertedCodePlaceholder = false;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (trimmed.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      if (inCodeBlock && !insertedCodePlaceholder) {
        preview.push("> Bloc technique masque dans l'aperçu");
        insertedCodePlaceholder = true;
        lineCount += 1;
      }
      continue;
    }

    if (inCodeBlock) continue;

    const line = rawLine.length > 240 ? `${rawLine.slice(0, 240).trimEnd()}…` : rawLine;
    if (chars + line.length > maxChars || lineCount >= maxLines) break;

    preview.push(line);
    chars += line.length;
    lineCount += 1;
  }

  if (chars < text.length) {
    preview.push("", "_Aperçu tronqué. Ouvre le contenu complet pour la suite._");
  }

  return preview.join("\n").trim();
}

function buildReadableFullText(text: string): string {
  return text
    .replace(/^```[^\n]*$/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getAssistantHeavyProfile(message: ChatMessage) {
  const answerText = message.answer_markdown ?? message.content ?? "";
  const generatedObjectsChars = safeSerializedLength(message.generated_objects);
  const debugChars = safeSerializedLength(message.debug);
  const answerHeavy = answerText.length >= HEAVY_MESSAGE_CHAR_THRESHOLD;
  const payloadHeavy =
    generatedObjectsChars >= HEAVY_MESSAGE_CHAR_THRESHOLD ||
    debugChars >= HEAVY_DEBUG_CHAR_THRESHOLD;

  return {
    answerChars: answerText.length,
    answerHeavy,
    payloadHeavy,
    requiresPlainReader: answerText.length >= VERY_HEAVY_ANSWER_CHAR_THRESHOLD,
    anyHeavy: answerHeavy || payloadHeavy,
  };
}

function splitMarkdownIntoChunks(text: string, maxChars: number = 1800, maxLines: number = 24): string[] {
  const lines = text.split("\n");
  const chunks: string[] = [];
  let current: string[] = [];
  let charCount = 0;
  let lineCount = 0;

  for (const line of lines) {
    const nextChars = charCount + line.length + 1;
    const nextLines = lineCount + 1;
    if (current.length > 0 && (nextChars > maxChars || nextLines > maxLines)) {
      chunks.push(current.join("\n").trim());
      current = [];
      charCount = 0;
      lineCount = 0;
    }
    current.push(line);
    charCount += line.length + 1;
    lineCount += 1;
  }

  if (current.length > 0) {
    chunks.push(current.join("\n").trim());
  }

  return chunks.filter(Boolean);
}

function sanitizeUnderstandingText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  if (!text) return undefined;
  const looksLikeSerializedObject =
    (text.startsWith("{") && text.endsWith("}")) ||
    text.includes("'certain':") ||
    text.includes('"certain":') ||
    text.includes("'inferred':") ||
    text.includes('"inferred":') ||
    text.includes("'to_confirm':") ||
    text.includes('"to_confirm":');
  if (looksLikeSerializedObject) return undefined;
  return text;
}

function isHeavyAssistantMessage(message: ChatMessage): boolean {
  return getAssistantHeavyProfile(message).anyHeavy;
}

function isHeavyUserMessage(message: ChatMessage): boolean {
  return (message.content?.length ?? 0) >= HEAVY_MESSAGE_CHAR_THRESHOLD;
}

// ─── Mode badge ───────────────────────────────────────────────────────────────

function ModeBadge({ mode }: { mode: string }) {
  const cfg = MODE_CONFIG[mode];
  if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
      cfg.color, cfg.bg, cfg.border
    )}>
      <Icon className="h-3 w-3 flex-shrink-0" />
      {cfg.label}
    </span>
  );
}

// ─── Related objects ──────────────────────────────────────────────────────────

const KIND_COLOR: Record<string, string> = {
  ticket:   "bg-brand-50 text-brand-700 border-brand-200",
  topic:    "bg-brand-100 text-brand-800 border-brand-200",
  document: "bg-slate-50 text-slate-700 border-slate-200",
  memory:   "bg-amber-50 text-amber-700 border-amber-200",
  knowledge_doc: "bg-brand-50 text-brand-700 border-brand-200",
};

function RelatedObjectChips({ objects }: { objects: RelatedObject[] }) {
  if (!objects.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Layers className="h-3 w-3 flex-shrink-0 text-[var(--text-xmuted)]" />
      {objects.map((ro, i) => (
        <span
          key={i}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium",
            KIND_COLOR[ro.kind] ?? "bg-slate-50 text-slate-700 border-slate-200"
          )}
        >
          <span className="opacity-60">{ro.kind}</span>
          <span className="h-2.5 w-px bg-current opacity-30" />
          {ro.label}
        </span>
      ))}
    </div>
  );
}

// ─── Certainty panel ──────────────────────────────────────────────────────────

function CertaintyPanel({ certainty }: { certainty: CertaintyBlock }) {
  const { certain, inferred, to_confirm } = certainty;
  const total = certain.length + inferred.length + to_confirm.length;
  if (!total) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 overflow-hidden">
      <div className="flex items-center gap-1.5 border-b border-slate-100 px-3 py-2">
        <Info className="h-3 w-3 text-[var(--text-xmuted)]" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-xmuted)]">
          Certitude
        </span>
      </div>
      <div className="divide-y divide-slate-100">
        {certain.length > 0 && (
          <div className="px-3 py-2.5">
            <div className="mb-1.5 flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3 text-emerald-500 flex-shrink-0" />
              <span className="text-[10px] font-semibold text-emerald-700">Certain</span>
            </div>
            <ul className="space-y-1">
              {certain.map((s, i) => (
                <li key={i} className="text-xs leading-relaxed text-[var(--text)] pl-4.5">
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
        {inferred.length > 0 && (
          <div className="px-3 py-2.5">
            <div className="mb-1.5 flex items-center gap-1.5">
              <HelpCircle className="h-3 w-3 text-amber-500 flex-shrink-0" />
              <span className="text-[10px] font-semibold text-amber-700">Déduit</span>
            </div>
            <ul className="space-y-1">
              {inferred.map((s, i) => (
                <li key={i} className="text-xs leading-relaxed text-[var(--text)] pl-4.5">
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
        {to_confirm.length > 0 && (
          <div className="px-3 py-2.5">
            <div className="mb-1.5 flex items-center gap-1.5">
              <AlertCircle className="h-3 w-3 text-brand-500 flex-shrink-0" />
              <span className="text-[10px] font-semibold text-brand-700">À confirmer</span>
            </div>
            <ul className="space-y-1">
              {to_confirm.map((s, i) => (
                <li key={i} className="text-xs leading-relaxed text-[var(--text)] pl-4.5">
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Next actions ─────────────────────────────────────────────────────────────

function NextActionsPanel({ actions }: { actions: string[] }) {
  if (!actions.length) return null;
  return (
    <div className="rounded-xl border border-brand-100 bg-brand-50/40 px-3 py-3">
      <div className="mb-2 flex items-center gap-1.5">
        <ArrowRight className="h-3 w-3 text-brand-500 flex-shrink-0" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-brand-600">
          Prochaines actions
        </span>
      </div>
      <ol className="space-y-1.5 pl-0">
        {actions.map((action, i) => (
          <li key={i} className="flex items-start gap-2.5 text-xs text-[var(--text-strong)]">
            <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-600">
              {i + 1}
            </span>
            <span className="leading-relaxed">{action}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ─── Proposed action card ─────────────────────────────────────────────────────

const ACTION_TYPE_LABEL: Record<string, string> = {
  create_ticket:                    "Créer ticket",
  create_document:                  "Créer document",
  add_comment:                      "Ajouter commentaire",
  create_artifact:                  "Sauvegarder artefact",
  update_memory:                    "Mettre à jour mémoire",
  create_topic_then_ticket:         "Nouveau topic + ticket",
  select_topic_then_create_ticket:  "Choisir topic → ticket",
  select_ticket_then_add_comment:   "Choisir ticket → commenter",
};

// ─── Resolution helpers ────────────────────────────────────────────────────────

interface TicketResolution {
  match_status: "found_duplicate" | "found_similar" | "not_found";
  suggested_ticket_id: string | null;
  suggested_ticket_title: string | null;
  suggested_ticket_type: string | null;
  suggested_ticket_priority: string | null;
  duplicate_score: number;
  decision_reason: string;
}

function TopicChip({ resolution }: { resolution: TopicResolution }) {
  const { match_status, suggested_topic_name, context_used } = resolution;

  if (match_status === "exact_match" && suggested_topic_name) {
    const isActive = context_used?.includes("active_topic");
    return (
      <span className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
        isActive
          ? "border-brand-200 bg-brand-50 text-brand-700"
          : "border-brand-200 bg-brand-100 text-brand-800",
      )}>
        <Layers className="h-3 w-3 flex-shrink-0" />
        {suggested_topic_name}
        {isActive && <span className="ml-0.5 opacity-60">(actif)</span>}
      </span>
    );
  }
  if (match_status === "possible_matches" && suggested_topic_name) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-medium text-orange-700">
        <HelpCircle className="h-3 w-3 flex-shrink-0" />
        Sélectionner un topic
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
      <Layers className="h-3 w-3 flex-shrink-0" />
      Nouveau topic
    </span>
  );
}

// ─── Duplicate ticket warning ──────────────────────────────────────────────────

function DuplicateWarning({
  ticketRes,
  onCommentInstead,
}: {
  ticketRes: TicketResolution;
  onCommentInstead: () => void;
}) {
  if (ticketRes.match_status === "not_found") return null;
  const isDuplicate = ticketRes.match_status === "found_duplicate";
  return (
    <div className={cn(
      "mt-2 rounded-lg border px-3 py-2 text-[11px]",
      isDuplicate
        ? "border-red-200 bg-red-50"
        : "border-amber-200 bg-amber-50",
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-1.5">
          <AlertCircle className={cn(
            "mt-0.5 h-3.5 w-3.5 flex-shrink-0",
            isDuplicate ? "text-red-500" : "text-amber-500",
          )} />
          <div>
            <span className={cn(
              "font-semibold",
              isDuplicate ? "text-red-700" : "text-amber-700",
            )}>
              {isDuplicate ? "Ticket similaire détecté" : "Ticket proche existant"}
            </span>
            <p className={cn(
              "mt-0.5 leading-relaxed",
              isDuplicate ? "text-red-600" : "text-amber-600",
            )}>
              {ticketRes.suggested_ticket_title}
              <span className="ml-1.5 opacity-70">(score={ticketRes.duplicate_score})</span>
            </p>
          </div>
        </div>
        {isDuplicate && (
          <button
            onClick={onCommentInstead}
            className="flex-shrink-0 rounded-md bg-white border border-red-200 px-2 py-1 text-[10px] font-semibold text-red-600 transition hover:bg-red-100"
          >
            Commenter à la place
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Topic selector panel ─────────────────────────────────────────────────────

function TopicSelectorPanel({
  resolution,
  selectedId,
  onSelect,
}: {
  resolution: TopicResolution;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { candidate_topics, suggested_topic_name, suggested_topic_id } = resolution;
  // Always show suggested first if not in candidates
  const allCandidates = candidate_topics.length
    ? candidate_topics
    : suggested_topic_id && suggested_topic_name
      ? [{ id: suggested_topic_id, name: suggested_topic_name, nature: resolution.suggested_topic_nature ?? "", score: resolution.top_score, score_breakdown: "" }]
      : [];

  if (!allCandidates.length) return null;

  return (
    <div className="mt-2 rounded-lg border border-orange-200 bg-orange-50/50 p-2 space-y-1">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-orange-700">
        Choisir le topic cible
      </p>
      {allCandidates.map(c => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          className={cn(
            "w-full flex items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs transition",
            selectedId === c.id
              ? "bg-brand-100 text-brand-700 font-semibold border border-brand-300"
              : "bg-white border border-transparent hover:border-slate-200 text-[var(--text)]",
          )}
        >
          <span className="flex items-center gap-1.5">
            <Layers className="h-3 w-3 flex-shrink-0 text-brand-400" />
            <span>{c.name}</span>
          </span>
          <div className="flex items-center gap-2">
            {c.score > 0 && (
              <span className="text-[10px] text-[var(--text-xmuted)]">score {c.score}</span>
            )}
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] text-[var(--text-xmuted)]">{c.nature}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Ticket selector panel (for select_ticket_then_add_comment) ───────────────

function TicketSelectorPanel({
  tickets,
  selectedId,
  onSelect,
}: {
  tickets: ContextObject[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (!tickets.length) return (
    <p className="mt-2 text-[10px] text-[var(--text-xmuted)] italic">
      Aucun ticket dans le contexte — ouvre un topic d'abord pour voir les tickets disponibles.
    </p>
  );
  return (
    <div className="mt-2 rounded-lg border border-brand-200 bg-brand-50/50 p-2 space-y-1">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-brand-700">
        Choisir le ticket à commenter
      </p>
      {tickets.map(t => (
        <button
          key={t.id}
          onClick={() => onSelect(t.id)}
          className={cn(
            "w-full flex items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs transition",
            selectedId === t.id
              ? "bg-brand-100 text-brand-700 font-semibold border border-brand-300"
              : "bg-white border border-transparent hover:border-slate-200 text-[var(--text)]",
          )}
        >
          <span className="flex items-center gap-1.5 min-w-0">
            <FileText className="h-3 w-3 flex-shrink-0 text-brand-400" />
            <span className="truncate">{t.label}</span>
          </span>
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            {typeof t.content.status === "string" && t.content.status.length > 0 && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] text-[var(--text-xmuted)]">
                {t.content.status}
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Resolution debug panel ───────────────────────────────────────────────────

function ResolutionDebug({
  resolution,
  ticketRes,
}: {
  resolution: TopicResolution;
  ticketRes?: TicketResolution;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-1.5">
      <button
        onClick={() => setOpen(p => !p)}
        className="flex items-center gap-1 text-[10px] text-[var(--text-xmuted)] hover:text-[var(--text-muted)] transition"
      >
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        Résolution {open ? "▲" : "▼"}
      </button>
      {open && (
        <div className="mt-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2.5 space-y-2 text-[10px] font-mono text-[var(--text-muted)]">
          {/* Topic resolution */}
          <div>
            <span className="font-sans font-semibold text-[var(--text-strong)] not-italic">Topic</span>
            <div className="mt-1 space-y-0.5">
              <div><span className="text-[var(--text-xmuted)]">status:</span> <span className={cn(
                "font-semibold",
                resolution.match_status === "exact_match" ? "text-emerald-600" :
                resolution.match_status === "possible_matches" ? "text-orange-600" : "text-red-600"
              )}>{resolution.match_status}</span></div>
              {resolution.suggested_topic_name && (
                <div><span className="text-[var(--text-xmuted)]">topic:</span> {resolution.suggested_topic_name}</div>
              )}
              <div><span className="text-[var(--text-xmuted)]">score:</span> {resolution.top_score}</div>
              <div><span className="text-[var(--text-xmuted)]">contexte:</span> {resolution.context_used || "—"}</div>
              <div className="break-words"><span className="text-[var(--text-xmuted)]">raison:</span> {resolution.decision_reason || "—"}</div>
              {resolution.candidate_topics.length > 0 && (
                <div>
                  <span className="text-[var(--text-xmuted)]">candidats:</span>
                  <ul className="mt-0.5 list-none pl-2 space-y-0.5">
                    {resolution.candidate_topics.map(c => (
                      <li key={c.id}>• {c.name} (score={c.score}) {c.score_breakdown && `— ${c.score_breakdown}`}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
          {/* Ticket resolution */}
          {ticketRes && (
            <div className="border-t border-slate-200 pt-2">
              <span className="font-sans font-semibold text-[var(--text-strong)]">Ticket dupliqué</span>
              <div className="mt-1 space-y-0.5">
                <div><span className="text-[var(--text-xmuted)]">status:</span> <span className={cn(
                  "font-semibold",
                  ticketRes.match_status === "found_duplicate" ? "text-red-600" :
                  ticketRes.match_status === "found_similar" ? "text-amber-600" : "text-emerald-600"
                )}>{ticketRes.match_status}</span></div>
                {ticketRes.suggested_ticket_title && (
                  <div><span className="text-[var(--text-xmuted)]">ticket:</span> {ticketRes.suggested_ticket_title}</div>
                )}
                <div><span className="text-[var(--text-xmuted)]">score:</span> {ticketRes.duplicate_score}</div>
                <div className="break-words"><span className="text-[var(--text-xmuted)]">raison:</span> {ticketRes.decision_reason || "—"}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ProposedActionCard ────────────────────────────────────────────────────────

function ProposedActionCard({
  action, index,
  onExecute, onDismiss,
  isExecuted, isDismissed,
  contextObjects,
}: {
  action: ProposedAction; index: number;
  onExecute: (overridePayload?: Record<string, unknown>) => void;
  onDismiss: () => void;
  isExecuted: boolean; isDismissed: boolean;
  contextObjects?: ContextObject[];
}) {
  const resolution   = action.payload._resolution as TopicResolution | undefined;
  const ticketRes    = action.payload._ticket_resolution as TicketResolution | undefined;
  const isDuplAlt    = action.payload._is_duplicate_alternative as boolean | undefined;

  const needsTopicPick   = action.type === "select_topic_then_create_ticket";
  const needsTicketPick  = action.type === "select_ticket_then_add_comment";
  const isNewTopic       = action.type === "create_topic_then_ticket";
  const isDuplicate      = ticketRes?.match_status === "found_duplicate";
  const isSimilar        = ticketRes?.match_status === "found_similar";

  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(
    resolution?.suggested_topic_id ?? null
  );
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState<string>(
    (action.payload.comment as string) || ""
  );

  // Tickets available in context for the ticket picker
  const contextTickets = (contextObjects ?? []).filter(o => o.kind === "ticket");

  if (isDismissed) return null;
  const typeLabel = ACTION_TYPE_LABEL[action.type] ?? action.type;

  function handleValidate() {
    const extra: Record<string, unknown> = {};
    if (needsTopicPick && selectedTopicId) extra.selected_topic_id = selectedTopicId;
    if (needsTicketPick) {
      extra.selected_ticket_id = selectedTicketId;
      extra.comment = commentText;
    }
    onExecute(Object.keys(extra).length ? { ...action.payload, ...extra } : undefined);
  }

  function handleCommentInstead() {
    if (!ticketRes?.suggested_ticket_id) return;
    onExecute({
      ...action.payload,
      _override_action_type: "add_comment",
      ticket_id: ticketRes.suggested_ticket_id,
    });
  }

  const canValidate =
    (!needsTopicPick || !!selectedTopicId) &&
    (!needsTicketPick || (!!selectedTicketId && !!commentText.trim()));

  // Distinct styling for duplicate-alternative card
  if (isDuplAlt) {
    return (
      <div className={cn(
        "rounded-xl border transition-all duration-200 overflow-hidden",
        isExecuted ? "border-emerald-200 bg-emerald-50" : "border-brand-200 bg-brand-50/40 hover:bg-brand-50",
      )}>
        <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
          <div className="flex items-start gap-2">
            <MessageSquare className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-brand-500" />
            <div>
              <p className="text-xs font-semibold text-brand-800">{action.label}</p>
              <p className="mt-0.5 text-[10px] text-brand-600">Alternative — évite le doublon</p>
            </div>
          </div>
          {isExecuted ? (
            <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
              <Check className="h-3 w-3" />Exécuté
            </span>
          ) : (
            <div className="flex items-center gap-1.5">
              <button onClick={handleValidate} className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-brand-600 active:scale-95">
                <Check className="h-3 w-3" />Valider
              </button>
              <button onClick={onDismiss} className="flex h-7 w-7 items-center justify-center rounded-lg border border-brand-200 text-brand-400 transition hover:border-brand-300">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "rounded-xl border transition-all duration-200 overflow-hidden",
      isExecuted ? "border-emerald-200 bg-emerald-50" :
      isDuplicate ? "border-red-200 bg-white shadow-sm" :
      isSimilar   ? "border-amber-200 bg-white shadow-sm" :
                    "border-slate-200 bg-white shadow-sm hover:border-brand-200 hover:shadow-md",
    )}>
      {/* ── Main row ── */}
      <div className="flex items-start justify-between gap-3 px-3.5 py-2.5">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-brand-100 text-[10px] font-bold text-brand-600">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className={cn(
              "text-xs font-semibold leading-tight",
              isExecuted ? "text-emerald-700 line-through" : "text-[var(--text-strong)]",
            )}>
              {action.label}
            </p>

            {/* Sub-line: type label + topic chip */}
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-[var(--text-xmuted)]">{typeLabel}</span>
              {resolution && <TopicChip resolution={resolution} />}
            </div>

            {/* What will be created */}
            {isNewTopic && resolution?.suggested_topic_name && (
              <p className="mt-1 text-[10px] text-amber-600">
                Crée le topic «&thinsp;{resolution.suggested_topic_name}&thinsp;» puis un ticket
              </p>
            )}
            {needsTopicPick && (
              <p className="mt-1 text-[10px] text-orange-600">
                Sélectionne un topic ci-dessous, puis crée le ticket
              </p>
            )}
            {needsTicketPick && (
              <p className="mt-1 text-[10px] text-brand-700">
                Choisir un ticket ci-dessous et rédiger le commentaire
              </p>
            )}
            {!isNewTopic && !needsTopicPick && resolution?.match_status === "exact_match" && resolution.suggested_topic_name && (
              <p className="mt-1 text-[10px] text-[var(--text-xmuted)]">
                Crée dans le topic «&thinsp;{resolution.suggested_topic_name}&thinsp;»
              </p>
            )}

            {/* Duplicate / similar ticket warning */}
            {ticketRes && (isDuplicate || isSimilar) && !isExecuted && (
              <DuplicateWarning
                ticketRes={ticketRes}
                onCommentInstead={handleCommentInstead}
              />
            )}

            {/* Debug panel */}
            {resolution && !isExecuted && (
              <ResolutionDebug resolution={resolution} ticketRes={ticketRes} />
            )}
          </div>
        </div>

        {/* Action buttons */}
        {isExecuted ? (
          <span className="flex flex-shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            <Check className="h-3 w-3" />Exécuté
          </span>
        ) : (
          <div className="flex flex-shrink-0 items-center gap-1.5 pt-0.5">
            <button
              onClick={handleValidate}
              disabled={!canValidate}
              title={!canValidate ? "Choisir un topic d'abord" : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition active:scale-95",
                canValidate ? "bg-brand-500 hover:bg-brand-600" : "cursor-not-allowed bg-brand-300",
              )}
            >
              <Check className="h-3 w-3" />
              Valider
            </button>
            <button
              onClick={onDismiss}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-[var(--text-xmuted)] transition hover:border-slate-300 hover:text-[var(--text-muted)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ── Topic selector panel ── */}
      {needsTopicPick && !isExecuted && resolution && (
        <div className="border-t border-orange-100 px-3.5 pb-3">
          <TopicSelectorPanel
            resolution={resolution}
            selectedId={selectedTopicId}
            onSelect={setSelectedTopicId}
          />
        </div>
      )}

      {/* ── Ticket + comment selector panel (select_ticket_then_add_comment) ── */}
      {needsTicketPick && !isExecuted && (
        <div className="border-t border-brand-100 px-3.5 pb-3 space-y-2">
          <TicketSelectorPanel
            tickets={contextTickets}
            selectedId={selectedTicketId}
            onSelect={setSelectedTicketId}
          />
          {/* Editable comment */}
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-brand-700">
              Commentaire à ajouter
            </p>
            <textarea
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              rows={3}
              placeholder="Saisir le commentaire à ajouter au ticket…"
              className="w-full resize-none rounded-lg border border-brand-200 bg-white px-3 py-2 text-xs text-[var(--text)] placeholder:text-[var(--text-xmuted)] focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-300"
            />
          </div>
          {!selectedTicketId && (
            <p className="text-[10px] text-brand-600 italic">
              Sélectionne un ticket pour activer la validation.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Generated object card ────────────────────────────────────────────────────

function GeneratedObjectCard({ obj }: { obj: GeneratedObject }) {
  const [expanded, setExpanded] = useState(false);
  const hasContent = Object.keys(obj.content).length > 0;
  const contentJson = useMemo(
    () => (expanded && hasContent ? JSON.stringify(obj.content, null, 2) : ""),
    [expanded, hasContent, obj.content],
  );

  return (
    <div className="overflow-hidden rounded-xl border border-brand-100 bg-brand-50/30">
      <div className="flex items-center justify-between px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-brand-500 flex-shrink-0" />
          <p className="text-xs font-semibold text-[var(--text-strong)]">{obj.label}</p>
          <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-medium text-brand-600">
            {obj.type}
          </span>
        </div>
        {hasContent && (
          <button
            onClick={() => setExpanded(p => !p)}
            className="rounded-md p-1 text-[var(--text-xmuted)] transition hover:bg-brand-100 hover:text-brand-600"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
      {expanded && hasContent && (
        <div className="border-t border-brand-100 bg-white/80 px-3.5 py-2.5">
          <pre className="overflow-x-auto font-mono text-[10px] text-[var(--text-muted)] leading-relaxed">
            {contentJson}
          </pre>
        </div>
      )}
    </div>
  );
}

const MemoGeneratedObjectCard = memo(GeneratedObjectCard);

// ─── Memory updates panel ─────────────────────────────────────────────────────

function MemoryUpdatesPanel({ updates }: { updates: MemoryUpdate[] }) {
  if (!updates.length) return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/40 px-3 py-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Brain className="h-3 w-3 text-amber-500 flex-shrink-0" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-700">
          Mémoire
        </span>
      </div>
      <div className="space-y-1.5">
        {updates.map((mu, i) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            <span className="mt-0.5 rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 flex-shrink-0">
              {mu.field}
            </span>
            <span className="leading-relaxed text-[var(--text)]">{mu.content}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── User bubble ──────────────────────────────────────────────────────────────

function UserBubble({
  msg,
  heavyConversationMode = false,
  isLoadingFullContent = false,
  onRequestFullContent,
}: {
  msg: ChatMessage;
  heavyConversationMode?: boolean;
  isLoadingFullContent?: boolean;
  onRequestFullContent?: (messageId: string) => void;
}) {
  const content = msg.content ?? "";
  const timestamp = msg.timestamp;
  const isLong = content.length > 200;
  const isHeavy = heavyConversationMode && ((msg.content_chars ?? content.length) >= HEAVY_MESSAGE_CHAR_THRESHOLD || !!msg.is_truncated);
  const [expanded, setExpanded] = useState(false);
  const preview = useMemo(() => buildCompactTextPreview(content), [content]);

  return (
    <div
      className="flex justify-end animate-fade-in"
      style={{ contentVisibility: "auto", containIntrinsicSize: "240px" }}
    >
      <div className="flex max-w-[72%] flex-col items-end gap-2">
        <div className="flex items-center gap-2 pr-1">
          <span className="rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
            Toi
          </span>
          <span className="text-[10px] text-[var(--text-xmuted)]">
            {timestamp.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        <div className="relative overflow-hidden rounded-[24px] rounded-tr-md border border-brand-500/25 bg-gradient-to-br from-brand-400 via-brand-500 to-brand-800 px-5 py-4 shadow-[0_16px_36px_rgba(148,121,14,0.24)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_35%)]" />
          <p className={cn(
            "relative whitespace-pre-wrap break-words text-sm leading-7 text-white",
            isLong && !expanded && "line-clamp-4",
          )}>
            {isHeavy && !expanded ? preview : content}
          </p>
          {isLong && (
            <button
              onClick={() => {
                if (!expanded && msg.full_content_available && msg.is_truncated) {
                  onRequestFullContent?.(msg.id);
                }
                setExpanded((p) => !p);
              }}
              disabled={isLoadingFullContent}
              className="relative mt-2 flex items-center gap-1 text-[11px] font-medium text-brand-100 transition hover:text-white disabled:opacity-70"
            >
              {isLoadingFullContent ? <Loader2 className="h-3 w-3 animate-spin" /> : expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? "Réduire" : "Voir tout"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const MemoUserBubble = memo(UserBubble);

// ─── Assistant card ───────────────────────────────────────────────────────────

function AssistantCard({
  msg,
  onExecuteAction,
  showConfidence = true,
  showSuggestions = true,
  heavyConversationMode = false,
  isHeavyExpanded = false,
  isLoadingFullContent = false,
  onToggleHeavyContent,
  onRequestFullContent,
  onRenderMetric,
}: {
  msg: ChatMessage;
  onExecuteAction: (action: ProposedAction, overridePayload?: Record<string, unknown>) => void;
  showConfidence?: boolean;
  showSuggestions?: boolean;
  heavyConversationMode?: boolean;
  isHeavyExpanded?: boolean;
  isLoadingFullContent?: boolean;
  onToggleHeavyContent?: (messageId: string) => void;
  onRequestFullContent?: (messageId: string) => void;
  onRenderMetric?: (messageId: string) => void;
}) {
  const [executedActions, setExecutedActions] = useState<Set<number>>(new Set());
  const [dismissedActions, setDismissedActions] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);
  const [forceRichRender, setForceRichRender] = useState(false);

  const isLivrable = msg.mode === "redaction" && !!msg.answer_markdown?.includes("##");
  const answerText = msg.answer_markdown ?? msg.content ?? "";
  const normalizedAnswerText = useMemo(
    () => normalizeMarkdownForDisplay(answerText),
    [answerText],
  );
  const heavyProfile = useMemo(
    () => getAssistantHeavyProfile(msg),
    [msg],
  );
  const useCompactRendering = heavyConversationMode && heavyProfile.answerHeavy && !isHeavyExpanded;
  const previewMarkdown = useMemo(
    () => buildMarkdownPreviewContent(normalizedAnswerText),
    [normalizedAnswerText],
  );
  const readableFullText = useMemo(
    () => buildReadableFullText(normalizedAnswerText),
    [normalizedAnswerText],
  );
  const usePlainExpandedRendering =
    heavyConversationMode &&
    heavyProfile.answerHeavy &&
    heavyProfile.requiresPlainReader &&
    isHeavyExpanded &&
    !forceRichRender;

  useEffect(() => {
    onRenderMetric?.(msg.id);
  }, [msg.id, onRenderMetric]);

  function copyAnswer() {
    navigator.clipboard.writeText(answerText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const hasSections = !!(
    (showConfidence && msg.certainty && (msg.certainty.certain.length + msg.certainty.inferred.length + msg.certainty.to_confirm.length) > 0) ||
    (msg.next_actions?.length) ||
    (showSuggestions && msg.proposed_actions?.length) ||
    (msg.generated_objects?.length) ||
    (msg.memory_updates?.length)
  );

  return (
    <div
      className="animate-slide-up"
      style={{ contentVisibility: "auto", containIntrinsicSize: "520px" }}
    >
      <div className="overflow-hidden rounded-[28px] border border-slate-200/90 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
        <div className="border-b border-slate-100 bg-[linear-gradient(135deg,rgba(215,179,16,0.12),rgba(215,179,16,0.04)_42%,rgba(255,255,255,0.98))] px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-[11px] font-bold text-white shadow-sm">
                SP
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-[var(--text-strong)]">Shadow PO</span>
                  {msg.mode && <ModeBadge mode={msg.mode} />}
                  {msg.knowledge_docs_used && msg.knowledge_docs_used.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[10px] font-semibold text-brand-700">
                      <Search className="h-3 w-3" />
                      {msg.knowledge_docs_used.length} source{msg.knowledge_docs_used.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                {msg.understanding && (
                  <p className="max-w-3xl text-sm leading-relaxed text-[var(--text-muted)]">
                    {msg.understanding}
                  </p>
                )}
                {msg.related_objects && msg.related_objects.length > 0 && (
                  <RelatedObjectChips objects={msg.related_objects} />
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[var(--text-xmuted)]">
                {msg.timestamp.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <button
                onClick={copyAnswer}
                title="Copier la réponse"
                className={cn(
                  "flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[10px] font-medium transition",
                  copied
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white/80 text-[var(--text-xmuted)] hover:border-slate-300 hover:text-[var(--text-muted)]"
                )}
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copié" : "Copier"}
              </button>
            </div>
          </div>
        </div>

        <div className="px-5 py-5">
          {answerText && (
            <div className={cn(
              "rounded-[24px] border px-5 py-5",
              isLivrable
                ? "border-brand-100 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(244,247,255,0.72))]"
                : "border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.95),rgba(255,255,255,1))]",
            )}>
              {useCompactRendering ? (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/50 px-3.5 py-2.5 text-[11px] font-medium text-amber-700">
                    Contenu lourd differe au premier affichage pour garder l'ouverture fluide.
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3">
                    <MemoMarkdownBlock content={previewMarkdown} isLivrable={isLivrable} />
                  </div>
                  <button
                    onClick={() => {
                      if (msg.full_content_available && msg.is_truncated) {
                        onRequestFullContent?.(msg.id);
                      }
                      setForceRichRender(false);
                      startTransition(() => {
                        onToggleHeavyContent?.(msg.id);
                      });
                    }}
                    disabled={isLoadingFullContent}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-[var(--text-muted)] transition hover:border-slate-300 hover:text-[var(--text-strong)]"
                  >
                    {isLoadingFullContent ? <Loader2 className="h-3 w-3 animate-spin" /> : <ChevronDown className="h-3 w-3" />}
                    Charger le contenu complet
                  </button>
                </div>
              ) : usePlainExpandedRendering ? (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/50 px-3.5 py-2.5 text-[11px] font-medium text-amber-700">
                    Mode lecture leger active pour ce contenu tres volumineux.
                  </div>
                  <div className="whitespace-pre-wrap break-words rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-[var(--text-strong)]">
                    {readableFullText}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => startTransition(() => setForceRichRender(true))}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-[var(--text-muted)] transition hover:border-slate-300 hover:text-[var(--text-strong)]"
                    >
                      <Sparkles className="h-3 w-3" />
                      Essayer le rendu riche
                    </button>
                    <button
                      onClick={() => {
                        setForceRichRender(false);
                        startTransition(() => {
                          onToggleHeavyContent?.(msg.id);
                        });
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-[var(--text-muted)] transition hover:border-slate-300 hover:text-[var(--text-strong)]"
                    >
                      <ChevronUp className="h-3 w-3" />
                      Replier
                    </button>
                  </div>
                </div>
              ) : heavyConversationMode && heavyProfile.answerHeavy && isHeavyExpanded ? (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-brand-200 bg-brand-50/60 px-3.5 py-2.5 text-[11px] font-medium text-brand-700">
                    Lecture progressive active pour garder une ouverture fluide sur les longs contenus.
                  </div>
                  <MemoHeavyMarkdownReader content={normalizedAnswerText} isLivrable={isLivrable} />
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        setForceRichRender(false);
                        startTransition(() => {
                          onToggleHeavyContent?.(msg.id);
                        });
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-[var(--text-muted)] transition hover:border-slate-300 hover:text-[var(--text-strong)]"
                    >
                      <ChevronUp className="h-3 w-3" />
                      Replier
                    </button>
                  </div>
                </div>
              ) : (
                <MemoMarkdownBlock content={normalizedAnswerText} isLivrable={isLivrable} />
              )}
            </div>
          )}

          {msg.knowledge_docs_used && msg.knowledge_docs_used.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {msg.knowledge_docs_used.map(doc => (
                <span key={doc.id} className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-[10px] font-semibold text-brand-700">
                  <FileText className="h-3 w-3" />
                  {doc.title}
                </span>
              ))}
            </div>
          )}

          {hasSections && (
            <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_320px]">
              <div className="space-y-3.5">
                {msg.next_actions && msg.next_actions.length > 0 && (
                  <NextActionsPanel actions={msg.next_actions} />
                )}

                {msg.proposed_actions && msg.proposed_actions.length > 0 && showSuggestions && (
                  <div className="rounded-[22px] border border-brand-100 bg-brand-50/40 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-brand-500 flex-shrink-0" />
                      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-600">
                        Actions proposées
                      </span>
                    </div>
                    <div className="space-y-2">
                      {msg.proposed_actions.map((action, i) => (
                        <ProposedActionCard
                          key={i}
                          action={action}
                          index={i}
                          isExecuted={executedActions.has(i)}
                          isDismissed={dismissedActions.has(i)}
                          contextObjects={msg.context_objects ?? msg.debug?.context_objects ?? []}
                          onExecute={(overridePayload) => {
                            setExecutedActions(prev => new Set([...prev, i]));
                            onExecuteAction(action, overridePayload);
                          }}
                          onDismiss={() => setDismissedActions(prev => new Set([...prev, i]))}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {msg.generated_objects && msg.generated_objects.length > 0 && (
                  <div className="space-y-2">
                    {msg.generated_objects.map((obj, i) => (
                      <MemoGeneratedObjectCard key={i} obj={obj} />
                    ))}
                  </div>
                )}

                {msg.memory_updates && msg.memory_updates.length > 0 && (
                  <MemoryUpdatesPanel updates={msg.memory_updates} />
                )}
              </div>

              <div className="space-y-3">
                {msg.certainty && showConfidence && <CertaintyPanel certainty={msg.certainty} />}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const MemoAssistantCard = memo(AssistantCard, (prev, next) => (
  prev.msg === next.msg &&
  prev.showConfidence === next.showConfidence &&
  prev.showSuggestions === next.showSuggestions &&
  prev.heavyConversationMode === next.heavyConversationMode &&
  prev.isHeavyExpanded === next.isHeavyExpanded &&
  prev.isLoadingFullContent === next.isLoadingFullContent &&
  prev.onExecuteAction === next.onExecuteAction &&
  prev.onToggleHeavyContent === next.onToggleHeavyContent &&
  prev.onRequestFullContent === next.onRequestFullContent &&
  prev.onRenderMetric === next.onRenderMetric
));

// ─── Thinking indicator ───────────────────────────────────────────────────────

function ThinkingCard() {
  return (
    <div className="animate-fade-in">
      <div className="inline-flex items-center gap-3 rounded-[22px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-[10px] font-bold text-white">
          SP
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold text-[var(--text-strong)]">Analyse en cours</p>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[var(--text-muted)]">Shadow Core structure la réponse</span>
            <div className="flex gap-1">
              <div className="thinking-dot h-1.5 w-1.5 rounded-full bg-brand-400" />
              <div className="thinking-dot h-1.5 w-1.5 rounded-full bg-brand-400" />
              <div className="thinking-dot h-1.5 w-1.5 rounded-full bg-brand-400" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Quick chips ──────────────────────────────────────────────────────────────

const QUICK_CHIPS = [
  { label: "Tickets bloqués ?",       msg: "Analyse les tickets bloqués et les blocages en cours" },
  { label: "Backlog prioritaire",      msg: "Résume le backlog prioritaire et les prochaines actions" },
  { label: "Risques du sprint",        msg: "Identifie les risques et dépendances du sprint en cours" },
  { label: "Rédige un plan recette",   msg: "Génère un plan de recette pour ce topic" },
  { label: "Questions ouvertes",       msg: "Liste les open questions et points à clarifier" },
];

function QuickChips({ onSelect }: { onSelect: (msg: string) => void }) {
  return (
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {QUICK_CHIPS.map(chip => (
        <button
          key={chip.label}
          onClick={() => onSelect(chip.msg)}
          className="group flex items-center justify-between rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-brand-200 hover:bg-brand-50/60"
        >
          <div>
            <p className="text-sm font-semibold text-[var(--text-strong)]">{chip.label}</p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">{chip.msg}</p>
          </div>
          <span className="ml-3 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-[var(--text-muted)] transition group-hover:bg-brand-100 group-hover:text-brand-700">
            <ChevronRight className="h-4 w-4" />
          </span>
        </button>
      ))}
    </div>
  );
}

// ─── Empty / welcome ──────────────────────────────────────────────────────────

function WelcomeState({
  spaceName, topicCount, ticketCount, onSelect,
}: {
  spaceName: string; topicCount: number; ticketCount: number;
  onSelect: (msg: string) => void;
}) {
  return (
    <div className="mx-auto max-w-4xl space-y-5 py-6">
      <div className="overflow-hidden rounded-[30px] border border-[var(--chat-thread-border)] bg-[linear-gradient(135deg,rgba(183,217,76,0.12),rgba(183,217,76,0.03)_40%,rgba(255,255,255,0.98))] p-7 shadow-[var(--shadow-md)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,var(--brand),var(--brand-dark))] text-lg font-bold text-[var(--text-strong)] shadow-[var(--shadow-sm)]">
              SP
            </div>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--brand-dark)]">Copilote produit</p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-[-0.04em] text-[var(--text-strong)]">Travaillez dans le contexte actif</h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-[var(--text-muted)]">
              Pose une question, demande une analyse ou fais rédiger un livrable à partir des objets MePO déjà actifs.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "Espace", value: spaceName },
              { label: "Topics", value: String(topicCount) },
              { label: "Tickets", value: String(ticketCount) },
            ].map((item) => (
              <div key={item.label} className="rounded-[20px] border border-[rgba(255,255,255,0.75)] bg-[rgba(255,255,255,0.9)] px-4 py-3.5 shadow-[var(--shadow-xs)] backdrop-blur">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-xmuted)]">{item.label}</p>
                <p className="mt-2 text-lg font-bold text-[var(--text-strong)]">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-[26px] border border-[var(--border)] bg-[var(--bg-panel-3)] p-5 shadow-[var(--shadow-sm)]">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-dark)]">Suggestions</p>
            <h3 className="mt-2 font-display text-xl font-bold tracking-[-0.04em] text-[var(--text-strong)]">Démarrer depuis un besoin concret</h3>
            <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
              Analyse, rédaction et transformation dans le même écran, sans bruit supplémentaire.
            </p>
          </div>
          <span className="rounded-full border border-[var(--border)] bg-[var(--bg-panel)] px-3 py-1.5 text-[10px] font-semibold text-[var(--text-muted)]">
            {spaceName}
          </span>
        </div>
        <div className="mt-5">
          <QuickChips onSelect={onSelect} />
        </div>
      </div>
    </div>
  );
}

// ─── Input bar ────────────────────────────────────────────────────────────────

function InputBar({
  value, onChange, onSend, loading, contextLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: (text: string) => void;
  loading: boolean;
  contextLabel: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend(value);
    }
  }

  return (
    <div className="border-t border-[var(--border-subtle)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(247,245,239,0.98))] px-5 pb-5 pt-4">
      {contextLabel && (
        <div className="mb-2 flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-panel-3)] px-3 py-1 text-[10px] font-semibold text-[var(--text-muted)] shadow-[var(--shadow-xs)]">
            <Layers className="h-3 w-3" />
            {contextLabel}
          </span>
        </div>
      )}

      <div className="rounded-[28px] border border-[var(--chat-thread-border)] bg-[var(--bg-panel-3)] p-3 shadow-[var(--shadow-sm)] transition-all focus-within:border-[rgba(183,217,76,0.28)] focus-within:ring-4 focus-within:ring-[rgba(183,217,76,0.14)]">
        <div className="flex items-start gap-3">
          <div className="mt-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-[var(--brand-light)] text-[var(--brand-dark)]">
            <Brain className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-xmuted)]">Demande</p>
            <textarea
              ref={ref}
              rows={1}
              value={value}
              onChange={e => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onInput={e => {
                const t = e.currentTarget;
                t.style.height = "auto";
                t.style.height = Math.min(t.scrollHeight, 160) + "px";
              }}
              placeholder="Décris le besoin, le livrable ou la décision attendue…"
              disabled={loading}
              className="mt-2 flex-1 resize-none bg-transparent text-sm leading-7 text-[var(--text-strong)] outline-none placeholder:text-[var(--text-xmuted)] disabled:opacity-60"
              style={{ maxHeight: 160 }}
            />
          </div>
          <button
            onClick={() => onSend(value)}
            disabled={!value.trim() || loading}
            className="mt-1 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-[var(--sidebar-bg)] text-[var(--sidebar-text)] shadow-[var(--shadow-xs)] transition hover:bg-[var(--sidebar-panel)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Send className="h-4 w-4" />
            }
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] px-1 pt-3">
          <span className="rounded-full bg-[var(--bg-panel)] px-2.5 py-1 text-[10px] font-medium text-[var(--text-muted)]">
            Entrée pour envoyer • Shift+Entrée pour une ligne
          </span>
          <p className="text-[10px] text-[var(--text-xmuted)]">Actions toujours soumises à validation</p>
        </div>
      </div>
    </div>
  );
}

// ─── Context sidebar ──────────────────────────────────────────────────────────

function ContextSidebar({
  spaceName, projectId, topics, tickets, documents,
  contextObjects, lastDebug, debugMode, onToggleDebug, conversationPerf,
}: {
  spaceName: string; projectId: string;
  topics: Topic[]; tickets: Ticket[]; documents: Document[];
  contextObjects: ContextObject[];
  lastDebug: DebugInfo | null;
  debugMode: boolean;
  onToggleDebug: () => void;
  conversationPerf: ConversationPerformanceMetrics | null;
}) {
  const [showRaw, setShowRaw] = useState(false);
  const blocked = tickets.filter(t => t.status === "blocked");
  const rawJson = useMemo(
    () => (showRaw && lastDebug ? JSON.stringify(lastDebug.raw_llm_response, null, 2) : ""),
    [showRaw, lastDebug],
  );

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto xl:sticky xl:top-0">
      <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-brand-500 flex-shrink-0" />
          <p className="text-xs font-bold text-[var(--text-strong)]">Contexte</p>
        </div>
        <div className="space-y-2.5">
          {[
            { label: "Espace",    val: spaceName },
            { label: "Topics",   val: `${topics.length}` },
            { label: "Tickets",  val: `${tickets.length}` },
            { label: "Docs",     val: `${documents.length}` },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-xmuted)]">{row.label}</p>
              <p className="text-xs font-semibold text-[var(--text-strong)]">{row.val}</p>
            </div>
          ))}
        </div>
      </div>

      {blocked.length > 0 && (
        <div className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-xmuted)]">Signal</p>
          <div className="flex items-center gap-2 rounded-lg bg-red-50 px-2.5 py-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-red-500 flex-shrink-0" />
            <p className="text-xs font-medium text-red-700">{blocked.length} bloque{blocked.length > 1 ? "s" : ""}</p>
          </div>
        </div>
      )}

      {contextObjects.length > 0 && (
        <div className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-xmuted)]">
            Injecte ({contextObjects.length})
          </p>
          <div className="space-y-1">
            {contextObjects.slice(0, 8).map((obj, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className={cn(
                  "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase flex-shrink-0",
                  KIND_COLOR[obj.kind]?.replace("border-", "").replace("bg-", "bg-").split(" ")[0] + " " +
                  (KIND_COLOR[obj.kind]?.split(" ")[1] ?? "text-slate-600")
                )}>
                  {obj.kind.slice(0, 3)}
                </span>
                <p className="truncate text-[10px] text-[var(--text-muted)]">{obj.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={onToggleDebug}
        className={cn(
          "flex items-center justify-between rounded-[20px] border px-3 py-2.5 text-xs font-medium transition",
          debugMode
            ? "border-brand-200 bg-brand-50 text-brand-700"
            : "border-slate-200 bg-white text-[var(--text-muted)] hover:text-[var(--text-strong)]"
        )}
      >
        <div className="flex items-center gap-1.5">
          <Settings2 className="h-3.5 w-3.5" />
          Debug
        </div>
        {debugMode ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {debugMode && lastDebug && (
        <div className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm text-[11px] space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-[var(--text-strong)]">Debug</span>
            {lastDebug.used_responses_api && (
              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[9px] font-bold text-brand-800">
                Responses API
              </span>
            )}
          </div>
          {[
            { k: "Skill",   v: lastDebug.skill },
            { k: "Mode",    v: lastDebug.mode_detected },
            { k: "Policy",  v: lastDebug.context_policy },
            { k: "Objets",  v: `${lastDebug.objects_injected} · ~${lastDebug.tokens_estimate} tok` },
            { k: "Confiance", v: `${lastDebug.confidence} — ${lastDebug.reading_line}` },
          ].map(row => (
            <div key={row.k}>
              <p className="text-[9px] font-semibold uppercase tracking-widest text-[var(--text-xmuted)]">{row.k}</p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-[var(--text-muted)]">{row.v}</p>
            </div>
          ))}
          {lastDebug.knowledge_docs.length > 0 && (
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-widest text-[var(--text-xmuted)] mb-1">
                Docs KB ({lastDebug.knowledge_docs.length})
              </p>
              {lastDebug.knowledge_docs.map(doc => (
                <p key={doc.id} className="text-[10px] text-[var(--text-muted)]">• {doc.title}</p>
              ))}
            </div>
          )}
          {lastDebug.retrieval_trace && (
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-widest text-[var(--text-xmuted)] mb-1">
                Retrieval ({lastDebug.retrieval_trace.final_level})
              </p>
              <div className="space-y-1">
                {lastDebug.retrieval_trace.steps.map((step) => (
                  <div key={step.level} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                    <p className="text-[10px] font-semibold text-[var(--text-strong)]">
                      {step.level} · {step.used ? "used" : "skipped"} · {step.item_count}
                    </p>
                    <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{step.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div>
            <button
              onClick={() => setShowRaw(p => !p)}
              className="flex items-center gap-1 text-[10px] text-[var(--text-xmuted)] hover:text-[var(--text-strong)] transition"
            >
              {showRaw ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              Réponse LLM brute
            </button>
            {showRaw && (
              <pre className="mt-1.5 max-h-40 overflow-auto rounded-lg bg-slate-50 p-2 font-mono text-[9px] text-[var(--text-muted)] border border-slate-200">
                {rawJson}
              </pre>
            )}
          </div>
        </div>
      )}

      {debugMode && conversationPerf && (
        <div className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm text-[11px] space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-[var(--text-strong)]">Perf conversation</span>
            {conversationPerf.heavyConversation && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-700">
                heavy safe
              </span>
            )}
          </div>
          {[
            { k: "Messages", v: `${conversationPerf.loadedMessages} charges / ${conversationPerf.renderedMessages} rendus` },
            { k: "Payload", v: `${conversationPerf.totalPayloadChars.toLocaleString("fr-FR")} chars` },
            { k: "Plus gros msg", v: `${conversationPerf.largestMessageChars.toLocaleString("fr-FR")} chars` },
            { k: "Ouverture", v: conversationPerf.openDurationMs != null ? `${conversationPerf.openDurationMs.toFixed(1)} ms` : "n/a" },
            { k: "Render initial", v: conversationPerf.initialRenderMs != null ? `${conversationPerf.initialRenderMs.toFixed(1)} ms` : "n/a" },
            { k: "Blocs differes", v: `${conversationPerf.deferredHeavyBlocks}` },
          ].map((row) => (
            <div key={row.k}>
              <p className="text-[9px] font-semibold uppercase tracking-widest text-[var(--text-xmuted)]">{row.k}</p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-[var(--text-muted)]">{row.v}</p>
            </div>
          ))}
          {conversationPerf.messageRenderCounts.length > 0 && (
            <div>
              <p className="mb-1 text-[9px] font-semibold uppercase tracking-widest text-[var(--text-xmuted)]">
                Rerenders messages
              </p>
              <div className="space-y-1">
                {conversationPerf.messageRenderCounts.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-2 py-1">
                    <span className="truncate text-[10px] text-[var(--text-muted)]">{item.id.slice(0, 8)}</span>
                    <span className="text-[10px] font-semibold text-[var(--text-strong)]">{item.renders}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main LetsChat ────────────────────────────────────────────────────────────

interface LetsChatProps {
  spaceId: string;
  spaceName: string;
  projectId: string;
  topicId?: string;       // active topic — sent to LLM for topic-first context
  topics: Topic[];
  tickets: Ticket[];
  documents: Document[];
}

// ─── History entry ────────────────────────────────────────────────────────────

interface HistoryEntry { role: "user" | "assistant"; content: string }

const MAX_HISTORY = 10   // last 10 messages sent to the LLM (5 exchanges)
const HIST_PREVIEW = 800 // chars of assistant answer kept in history

/** Build the assistant history entry from an AI response. */
function buildAssistantHistoryContent(data: {
  mode?: string; understanding?: string; answer_markdown?: string;
}): string {
  const mode = data.mode ? `[Mode: ${data.mode}] ` : "";
  const cleanUnderstanding = sanitizeUnderstandingText(data.understanding);
  const understanding = cleanUnderstanding ? `${cleanUnderstanding}\n` : "";
  const answer = buildCompactTextPreview(
    buildReadableFullText(normalizeMarkdownForDisplay(data.answer_markdown ?? "")),
    HIST_PREVIEW,
  );
  return `${mode}${understanding}${answer}`;
}

function trimPersistedText(value: unknown, limit: number): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length <= limit) return text;
  const clipped = text.slice(0, limit).trimEnd();
  const boundary = clipped.lastIndexOf(" ");
  return `${(boundary > 120 ? clipped.slice(0, boundary) : clipped).trimEnd()}…`;
}

function buildAssistantConversationMetadata(data: Record<string, unknown>) {
  const certainty = typeof data.certainty === "object" && data.certainty !== null
    ? data.certainty as Record<string, unknown>
    : null;
  const relatedObjects = Array.isArray(data.related_objects)
    ? data.related_objects
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .map((item) => ({
          kind: String(item.kind ?? item.type ?? "").trim(),
          id: String(item.id ?? "").trim(),
          label: String(item.label ?? item.title ?? "").trim(),
        }))
        .filter((item) => item.kind && item.id && item.label)
        .slice(0, 8)
    : [];
  const knowledgeDocs = Array.isArray(data.knowledge_docs_used)
    ? data.knowledge_docs_used
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .map((item) => ({
          id: String(item.id ?? "").trim(),
          title: String(item.title ?? "").trim(),
          document_type: String(item.document_type ?? "").trim(),
          openai_file_id: item.openai_file_id ?? null,
        }))
        .filter((item) => item.id && item.title)
        .slice(0, 6)
    : [];
  const generatedObjects = Array.isArray(data.generated_objects)
    ? data.generated_objects
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .map((item) => ({
          type: String(item.type ?? "").trim(),
          label: String(item.label ?? "").trim(),
          content: typeof item.content === "object" && item.content !== null ? item.content : {},
        }))
        .filter((item) => item.type && item.label)
        .slice(0, 4)
    : [];

  return {
    mode: typeof data.mode === "string" ? data.mode : undefined,
    understanding: trimPersistedText(sanitizeUnderstandingText(data.understanding), 1000),
    answer_markdown: trimPersistedText(data.answer_markdown, 12000),
    certainty: certainty
      ? {
          certain: Array.isArray(certainty.certain) ? certainty.certain.slice(0, 4) : [],
          inferred: Array.isArray(certainty.inferred) ? certainty.inferred.slice(0, 4) : [],
          to_confirm: Array.isArray(certainty.to_confirm) ? certainty.to_confirm.slice(0, 4) : [],
        }
      : undefined,
    next_actions: Array.isArray(data.next_actions) ? data.next_actions.slice(0, 4) : [],
    related_objects: relatedObjects,
    knowledge_docs_used: knowledgeDocs,
    generated_objects: generatedObjects,
  };
}

function messageFromPersisted(m: PersistedConversationMessage): ChatMessage {
  if (m.role === "user") {
    return {
      id: m.id,
      role: "user",
      content: m.content,
      is_truncated: m.is_truncated ?? false,
      full_content_available: m.full_content_available ?? false,
      content_chars: m.content_chars,
      metadata_chars: m.metadata_chars,
      timestamp: new Date(),
    };
  }
  const meta = m.metadata ?? {};
  return {
    id: m.id,
    role: "assistant",
    mode: meta.mode as string | undefined,
    understanding: sanitizeUnderstandingText(meta.understanding),
    related_objects: (meta.related_objects as ChatMessage["related_objects"]) ?? [],
    answer_markdown: (meta.answer_markdown as string) ?? m.content,
    certainty: meta.certainty as ChatMessage["certainty"],
    next_actions: (meta.next_actions as string[]) ?? [],
    proposed_actions: [],
    generated_objects: (meta.generated_objects as ChatMessage["generated_objects"]) ?? [],
    memory_updates: [],
    knowledge_docs_used: (meta.knowledge_docs_used as ChatMessage["knowledge_docs_used"]) ?? [],
    context_objects: [],
    is_truncated: m.is_truncated ?? false,
    full_content_available: m.full_content_available ?? false,
    content_chars: m.content_chars,
    metadata_chars: m.metadata_chars,
    timestamp: new Date(),
  };
}

function buildHistoryEntriesFromMessages(messages: ChatMessage[]): HistoryEntry[] {
  return messages
    .slice(-MAX_HISTORY)
    .map((msg) => ({
      role: msg.role,
      content:
        msg.role === "assistant"
          ? buildAssistantHistoryContent({
              mode: msg.mode,
              understanding: msg.understanding,
              answer_markdown: msg.answer_markdown,
            })
          : (msg.content ?? ""),
    }));
}

function mergeLoadedMessages(
  olderMessages: ChatMessage[],
  currentMessages: ChatMessage[],
): ChatMessage[] {
  const seen = new Set<string>();
  const merged: ChatMessage[] = [];
  for (const message of [...olderMessages, ...currentMessages]) {
    if (seen.has(message.id)) continue;
    seen.add(message.id);
    merged.push(message);
  }
  return merged;
}

function loadedConversationStateFromDetail(
  id: string,
  detail: PersistedConversationDetail,
): LoadedConversationState {
  return {
    id,
    loadedCount: detail.loaded_message_count,
    totalCount: detail.total_message_count,
    hasMore: detail.has_more,
    nextOffset: detail.next_offset,
  };
}

export function LetsChat({ spaceId, spaceName, projectId, topicId, topics, tickets, documents }: LetsChatProps) {
  const [messages, setMessages]                 = useState<ChatMessage[]>([]);
  const [conversationHistory, setHistory]       = useState<HistoryEntry[]>([]);
  const [input, setInput]                       = useState("");
  const [loading, setLoading]                   = useState(false);
  const [contextObjects, setContextObjects]     = useState<ContextObject[]>([]);
  const [lastDebug, setLastDebug]               = useState<DebugInfo | null>(null);
  const [debugMode, setDebugMode]               = useState(false);
  const [convId, setConvId]                     = useState<string | null>(null);
  const [showHistory, setShowHistory]           = useState(false);
  const [historyLoadingId, setHistoryLoadingId] = useState<string | null>(null);
  const [loadedConversation, setLoadedConversation] = useState<LoadedConversationState | null>(null);
  const [expandedHeavyMessageIds, setExpandedHeavyMessageIds] = useState<Set<string>>(new Set());
  const [loadingFullMessageIds, setLoadingFullMessageIds] = useState<Set<string>>(new Set());
  const [openDurationMs, setOpenDurationMs] = useState<number | null>(null);
  const [initialRenderMs, setInitialRenderMs] = useState<number | null>(null);
  const [perfTick, setPerfTick] = useState(0);
  const [visibleMessageCount, setVisibleMessageCount] = useState<number>(HISTORY_PAGE_SIZE);
  const scrollRef = useRef<HTMLDivElement>(null);
  const conversationOpenStartRef = useRef<number | null>(null);
  const conversationRenderStartRef = useRef<number | null>(null);
  const messageRenderCountsRef = useRef<Record<string, number>>({});
  const perfTickScheduledRef = useRef(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  const loadingFullMessageIdsRef = useRef<Set<string>>(new Set());

  const { data: pastConversations = [], refetch: refetchConversations } = useConversations(spaceId, projectId);
  const createConversation = useCreateConversation();
  const appendMessages     = useAppendMessages();
  const deleteConversation = useDeleteConversation();

  // ── User AI preferences ────────────────────────────────────────────────────
  const aiPrefsRaw = useAuthStore((s) => s.user?.ai_preferences) ?? {};
  const aiPrefs = aiPrefsRaw as Record<string, unknown>;
  const prefShowConfidence  = (aiPrefs.confidence_labels as boolean)  ?? true;
  const prefShowSuggestions = (aiPrefs.show_suggestions  as boolean)  ?? true;
  const prefResponseStyle   = (aiPrefs.response_style    as string)   ?? "balanced";
  // "detail_level" is the canonical key (was "verbosity" pre-v2 — keep fallback)
  const prefDetailLevel     = (aiPrefs.detail_level      as string)   ?? (aiPrefs.verbosity as string) ?? "normal";

  const hasMessages = messages.some(m => m.role === "user");

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    loadingFullMessageIdsRef.current = loadingFullMessageIds;
  }, [loadingFullMessageIds]);
  const totalPayloadChars = useMemo(
    () => messages.reduce((sum, message) => sum + getChatMessagePayloadChars(message), 0),
    [messages],
  );
  const largestMessageChars = useMemo(
    () => messages.reduce((max, message) => Math.max(max, getChatMessagePayloadChars(message)), 0),
    [messages],
  );
  const heavyConversationMode = useMemo(
    () =>
      messages.length >= HEAVY_CONVERSATION_MESSAGE_THRESHOLD ||
      totalPayloadChars >= HEAVY_CONVERSATION_PAYLOAD_THRESHOLD ||
      largestMessageChars >= HEAVY_MESSAGE_CHAR_THRESHOLD,
    [messages.length, totalPayloadChars, largestMessageChars],
  );
  const deferredHeavyBlocks = useMemo(
    () => messages.filter((message) => message.role === "assistant" && isHeavyAssistantMessage(message) && !expandedHeavyMessageIds.has(message.id)).length,
    [messages, expandedHeavyMessageIds],
  );
  const effectiveVisibleMessageCount = heavyConversationMode
    ? Math.min(messages.length, Math.max(visibleMessageCount, HEAVY_INITIAL_RENDER_WINDOW))
    : messages.length;
  const visibleMessages = useMemo(
    () => messages.slice(Math.max(0, messages.length - effectiveVisibleMessageCount)),
    [messages, effectiveVisibleMessageCount],
  );
  const conversationPerf = useMemo<ConversationPerformanceMetrics>(() => {
    const messageRenderCounts = Object.entries(messageRenderCountsRef.current)
      .sort((a, b) => b[1] - a[1])
      .map(([id, renders]) => ({ id, renders }));
    return {
      loadedMessages: messages.length,
      renderedMessages: visibleMessages.length,
      totalPayloadChars,
      largestMessageChars,
      openDurationMs,
      initialRenderMs,
      deferredHeavyBlocks,
      heavyConversation: heavyConversationMode,
      messageRenderCounts,
    };
  }, [messages.length, visibleMessages.length, totalPayloadChars, largestMessageChars, openDurationMs, initialRenderMs, deferredHeavyBlocks, heavyConversationMode, perfTick]);

  // Context label for input bar
  const contextLabel = [
    spaceName,
    topics.length ? `${topics.length} topics` : null,
    tickets.length ? `${tickets.length} tickets` : null,
  ].filter(Boolean).join(" · ");

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    if (conversationRenderStartRef.current == null) return;
    const startedAt = conversationRenderStartRef.current;
    const raf = window.requestAnimationFrame(() => {
      setInitialRenderMs(performance.now() - startedAt);
      conversationRenderStartRef.current = null;
    });
    return () => window.cancelAnimationFrame(raf);
  }, [messages]);

  const toggleHeavyMessage = useCallback((messageId: string) => {
    startTransition(() => {
      setExpandedHeavyMessageIds((prev) => {
        const next = new Set(prev);
        if (next.has(messageId)) next.delete(messageId);
        else next.add(messageId);
        return next;
      });
    });
  }, []);

  const ensureFullMessageLoaded = useCallback(async (messageId: string) => {
    if (!convId) return;
    const target = messagesRef.current.find((message) => message.id === messageId);
    if (!target || !target.full_content_available || !target.is_truncated) return;
    if (loadingFullMessageIdsRef.current.has(messageId)) return;

    setLoadingFullMessageIds((prev) => new Set(prev).add(messageId));
    try {
      const fullMessage = await fetchConversationMessage(convId, messageId);
      const rebuilt = messageFromPersisted(fullMessage);
      setMessages((prev) => prev.map((message) => (message.id === messageId ? rebuilt : message)));
    } catch {
      /* ignore on-demand load error */
    } finally {
      setLoadingFullMessageIds((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
    }
  }, [convId]);

  const trackMessageRender = useCallback((messageId: string) => {
    messageRenderCountsRef.current[messageId] = (messageRenderCountsRef.current[messageId] ?? 0) + 1;
    if (!perfTickScheduledRef.current) {
      perfTickScheduledRef.current = true;
      window.requestAnimationFrame(() => {
        perfTickScheduledRef.current = false;
        setPerfTick((value) => value + 1);
      });
    }
  }, []);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(), role: "user",
      content: trimmed, timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput("");

    // Snapshot history to send (before we add this turn)
    const historyToSend = conversationHistory.slice(-MAX_HISTORY);

    setLoading(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          space_id: spaceId,
          project_id: projectId,
          topic_id: topicId ?? null,
          debug: debugMode,
          conversation_history: historyToSend,
          response_style: prefResponseStyle,
          detail_level: prefDetailLevel,
          show_confidence: prefShowConfidence,
          show_suggestions: prefShowSuggestions,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail ?? `HTTP ${res.status}`);

      const aiMsg: ChatMessage = {
        id: crypto.randomUUID(), role: "assistant",
        mode: data.mode,
        understanding: sanitizeUnderstandingText(data.understanding),
        related_objects: data.related_objects ?? [],
        answer_markdown: data.answer_markdown,
        certainty: data.certainty,
        next_actions: data.next_actions ?? [],
        proposed_actions: data.proposed_actions ?? [],
        generated_objects: data.generated_objects ?? [],
        memory_updates: data.memory_updates ?? [],
        knowledge_docs_used: data.knowledge_docs_used ?? [],
        context_objects: data.context_objects ?? [],
        debug: data.debug ?? undefined,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMsg]);
      setLoadedConversation((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          loadedCount: prev.loadedCount + 2,
          totalCount: prev.totalCount + 2,
        };
      });

      // Append this exchange to conversation history (sent to LLM on next turn)
      setHistory(prev => [
        ...prev,
        { role: "user" as const, content: trimmed },
        { role: "assistant" as const, content: buildAssistantHistoryContent(data) },
      ].slice(-MAX_HISTORY));

      if (data.context_objects?.length) setContextObjects(data.context_objects);
      else if (data.debug?.context_objects?.length) setContextObjects(data.debug.context_objects);
      if (data.debug) setLastDebug(data.debug);

      // ── Persist conversation to DB ──────────────────────────────────────────
      const assistantSummary = buildAssistantHistoryContent(data);
      const persistedAssistantMetadata = buildAssistantConversationMetadata(data as Record<string, unknown>);
      if (!convId) {
        // First exchange → create conversation
        try {
          const conv = await createConversation.mutateAsync({
            space_id: spaceId,
            project_id: projectId,
            topic_id: topicId,
            title: trimmed.slice(0, 80),
            messages: [
              { role: "user", content: trimmed, metadata: {} },
              { role: "assistant", content: assistantSummary, metadata: persistedAssistantMetadata },
            ],
          });
          setConvId(conv.id);
          setLoadedConversation({
            id: conv.id,
            loadedCount: conv.loaded_message_count ?? 2,
            totalCount: conv.total_message_count ?? 2,
            hasMore: conv.has_more ?? false,
            nextOffset: conv.next_offset ?? null,
          });
        } catch { /* persistence non-bloquante */ }
      } else {
        // Subsequent exchanges → append
        try {
          await appendMessages.mutateAsync({
            convId,
            messages: [
              { role: "user", content: trimmed, metadata: {} },
              { role: "assistant", content: assistantSummary, metadata: persistedAssistantMetadata },
            ],
          });
        } catch { /* persistence non-bloquante */ }
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Erreur inconnue";
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(), role: "assistant",
        answer_markdown: `**Erreur Shadow Core**\n\n${detail}`,
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchConversationPage(convIdToLoad: string, offset: number): Promise<PersistedConversationDetail> {
    return api.get<PersistedConversationDetail>(
      `/api/ai/conversations/${convIdToLoad}?limit=${HISTORY_PAGE_SIZE}&offset=${offset}`,
    );
  }

  async function fetchConversationMessage(convIdToLoad: string, messageId: string): Promise<PersistedConversationMessage> {
    return api.get<PersistedConversationMessage>(
      `/api/ai/conversations/${convIdToLoad}/messages/${messageId}`,
    );
  }

  // Load an existing conversation from history
  function loadConversation(conv: ConversationSummary) {
    setShowHistory(false);
    setHistoryLoadingId(conv.id);
    conversationOpenStartRef.current = performance.now();
    fetchConversationPage(conv.id, 0)
      .then((detail) => {
        const rebuilt = detail.messages.map(messageFromPersisted);
        const startedAt = conversationOpenStartRef.current;
        const rebuiltPayloadChars = rebuilt.reduce((sum, message) => sum + getChatMessagePayloadChars(message), 0);
        const rebuiltLargestMessageChars = rebuilt.reduce(
          (max, message) => Math.max(max, getChatMessagePayloadChars(message)),
          0,
        );
        const rebuiltIsHeavy =
          rebuilt.length >= HEAVY_CONVERSATION_MESSAGE_THRESHOLD ||
          rebuiltPayloadChars >= HEAVY_CONVERSATION_PAYLOAD_THRESHOLD ||
          rebuiltLargestMessageChars >= HEAVY_MESSAGE_CHAR_THRESHOLD;
        setMessages(rebuilt);
        setHistory(buildHistoryEntriesFromMessages(rebuilt));
        setConvId(conv.id);
        setLoadedConversation(loadedConversationStateFromDetail(conv.id, detail));
        setExpandedHeavyMessageIds(new Set());
        setLoadingFullMessageIds(new Set());
        setVisibleMessageCount(rebuiltIsHeavy ? Math.min(rebuilt.length, HEAVY_INITIAL_RENDER_WINDOW) : rebuilt.length);
        messageRenderCountsRef.current = {};
        setContextObjects([]);
        setLastDebug(null);
        setOpenDurationMs(startedAt != null ? performance.now() - startedAt : null);
        conversationRenderStartRef.current = performance.now();
      })
      .catch(() => { /* ignore load error */ })
      .finally(() => {
        conversationOpenStartRef.current = null;
        setHistoryLoadingId(null);
      });
  }

  async function loadMoreConversationMessages() {
    if (!loadedConversation?.hasMore || loadedConversation.nextOffset == null || historyLoadingId) return;
    setHistoryLoadingId(loadedConversation.id);
    try {
      const detail = await fetchConversationPage(loadedConversation.id, loadedConversation.nextOffset);
      const olderMessages = detail.messages.map(messageFromPersisted);
      setMessages((prev) => {
        const merged = mergeLoadedMessages(olderMessages, prev);
        setHistory(buildHistoryEntriesFromMessages(merged));
        return merged;
      });
      setVisibleMessageCount((prev) => prev + detail.loaded_message_count);
      setLoadedConversation((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          loadedCount: Math.min(prev.totalCount, prev.loadedCount + detail.loaded_message_count),
          hasMore: detail.has_more,
          nextOffset: detail.next_offset,
        };
      });
    } catch {
      /* ignore load error */
    } finally {
      setHistoryLoadingId(null);
    }
  }

  const handleExecuteAction = useCallback(async (action: ProposedAction, overridePayload?: Record<string, unknown>) => {
    try {
      // Strip internal resolution metadata before sending to backend
      const rawPayload = overridePayload ?? action.payload ?? {};
      const {
        _resolution: _r,
        _ticket_resolution: _tr,
        _is_duplicate_alternative: _da,
        _for_action_label: _fal,
        _override_action_type,
        ...cleanPayload
      } = rawPayload as Record<string, unknown>;
      void _r; void _tr; void _da; void _fal;

      // Allow "comment instead" path to override action type
      const effectiveType = (_override_action_type as string | undefined) ?? action.type;

      const res = await fetch("/api/ai/actions/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action_id: action.action_id,
          action_type: effectiveType, confirmed: true, space_id: spaceId, project_id: projectId,
          payload: cleanPayload,
        }),
      });
      const data = await res.json();
      let statusMsg: string;
      if (data.success) {
        const obj = data.created_object as Record<string, unknown> | null | undefined;
        const lines: string[] = [`**Action exécutée**\n\n${data.message}`];
        if (obj) {
          // Ticket creation
          if (obj.ticket_id ?? obj.id) {
            const ticketTitle = (obj.ticket_title ?? obj.title) as string | undefined;
            const ticketType  = (obj.type) as string | undefined;
            if (ticketTitle) lines.push(`\n**Ticket créé :** ${ticketTitle}${ticketType ? ` _(${ticketType})_` : ""}`);
            if (obj.topic_title) lines.push(`**Topic :** ${obj.topic_title as string}`);
          }
          // Document / artifact creation
          if ((obj.type === "page" || effectiveType.includes("document") || effectiveType.includes("artifact")) && obj.title) {
            lines.push(`\n**Document créé :** ${obj.title as string}`);
          }
          // Comment
          if (effectiveType === "add_comment" || effectiveType === "select_ticket_then_add_comment") {
            const preview = obj.comment as string | undefined;
            if (preview) lines.push(`\n_Commentaire :_ ${preview.slice(0, 100)}${preview.length > 100 ? "…" : ""}`);
          }
        }
        statusMsg = lines.join("\n");
      } else {
        statusMsg = `**Échec de l'action**\n\n${data.message}`;
      }
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(), role: "assistant",
        answer_markdown: statusMsg, timestamp: new Date(),
      }]);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Erreur inconnue";
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(), role: "assistant",
        answer_markdown: `**Erreur exécution**\n\n${detail}`, timestamp: new Date(),
      }]);
    }
  }, [projectId, spaceId]);

  function resetChat() {
    setMessages([]);
    setHistory([]);
    setContextObjects([]);
    setLastDebug(null);
    setConvId(null);
    setLoadedConversation(null);
    setExpandedHeavyMessageIds(new Set());
    setLoadingFullMessageIds(new Set());
    setVisibleMessageCount(HISTORY_PAGE_SIZE);
    setOpenDurationMs(null);
    setInitialRenderMs(null);
    messageRenderCountsRef.current = {};
    setShowHistory(false);
  }

  return (
    <div className="grid h-full gap-5 xl:grid-cols-[minmax(0,1fr)_300px]" style={{ height: "calc(100vh - 190px)", minHeight: 560, maxHeight: 820 }}>
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-[32px] border border-[var(--chat-thread-border)] bg-[linear-gradient(180deg,rgba(252,251,247,0.98),rgba(255,255,255,0.98))] shadow-[var(--shadow-md)]">
        <LetsChatHeader
          exchangeCount={Math.floor(conversationHistory.length / 2)}
          showHistory={showHistory}
          onToggleHistory={() => {
            setShowHistory((previous) => !previous);
            refetchConversations();
          }}
          onReset={resetChat}
        />

        {showHistory ? (
          <LetsChatHistoryPanel
            conversations={pastConversations}
            activeConversationId={convId}
            loadingConversationId={historyLoadingId}
            onClose={() => setShowHistory(false)}
            onLoadConversation={loadConversation}
            onDeleteConversation={(conversation) => {
              deleteConversation.mutate(conversation.id);
              if (convId === conversation.id) resetChat();
            }}
          />
        ) : null}

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(183,217,76,0.07),transparent_34%),linear-gradient(180deg,rgba(247,245,239,0.75),rgba(255,255,255,0.98))] px-6 py-6"
          style={{ scrollBehavior: "auto" }}
        >
          {!hasMessages ? (
            <WelcomeState
              spaceName={spaceName}
              topicCount={topics.length}
              ticketCount={tickets.length}
              onSelect={sendMessage}
            />
          ) : (
            <div className="mx-auto max-w-6xl space-y-6">
              {loadedConversation?.id === convId && loadedConversation.hasMore && (
                <div className="flex justify-center">
                  <button
                    onClick={loadMoreConversationMessages}
                    disabled={historyLoadingId === loadedConversation.id}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-xs font-medium text-[var(--text-muted)] shadow-sm transition hover:border-slate-300 hover:text-[var(--text-strong)] disabled:cursor-wait disabled:opacity-60"
                  >
                    {historyLoadingId === loadedConversation.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ChevronUp className="h-3.5 w-3.5" />
                    )}
                    Voir 10 messages précédents
                    <span className="text-[10px] text-[var(--text-xmuted)]">
                      ({loadedConversation.loadedCount}/{loadedConversation.totalCount})
                    </span>
                  </button>
                </div>
              )}
              {heavyConversationMode && visibleMessages.length < messages.length && (
                <div className="flex justify-center">
                  <button
                    onClick={() => setVisibleMessageCount((prev) => Math.min(messages.length, prev + HEAVY_INITIAL_RENDER_WINDOW))}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-xs font-medium text-[var(--text-muted)] shadow-sm transition hover:border-slate-300 hover:text-[var(--text-strong)]"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                    Afficher plus de messages déjà chargés
                    <span className="text-[10px] text-[var(--text-xmuted)]">
                      ({visibleMessages.length}/{messages.length})
                    </span>
                  </button>
                </div>
              )}
              {visibleMessages.map(msg => (
                msg.role === "user"
                  ? <MemoUserBubble
                      key={msg.id}
                      msg={msg}
                      heavyConversationMode={heavyConversationMode}
                      isLoadingFullContent={loadingFullMessageIds.has(msg.id)}
                      onRequestFullContent={ensureFullMessageLoaded}
                    />
                  : <MemoAssistantCard
                      key={msg.id}
                      msg={msg}
                      onExecuteAction={handleExecuteAction}
                      showConfidence={prefShowConfidence}
                      showSuggestions={prefShowSuggestions}
                      heavyConversationMode={heavyConversationMode}
                      isHeavyExpanded={expandedHeavyMessageIds.has(msg.id)}
                      isLoadingFullContent={loadingFullMessageIds.has(msg.id)}
                      onToggleHeavyContent={toggleHeavyMessage}
                      onRequestFullContent={ensureFullMessageLoaded}
                      onRenderMetric={debugMode ? trackMessageRender : undefined}
                    />
              ))}
              {loading && <ThinkingCard />}
            </div>
          )}
        </div>

        <div className="flex-shrink-0">
          <InputBar
            value={input}
            onChange={setInput}
            onSend={sendMessage}
            loading={loading}
            contextLabel={contextLabel}
          />
        </div>
      </div>

      <div className="min-h-0 xl:w-[300px]">
        <ContextSidebar
          spaceName={spaceName}
          projectId={projectId}
          topics={topics}
          tickets={tickets}
          documents={documents}
          contextObjects={contextObjects}
          lastDebug={lastDebug}
          debugMode={debugMode}
          onToggleDebug={() => setDebugMode(p => !p)}
          conversationPerf={conversationPerf}
        />
      </div>
    </div>
  );
}
