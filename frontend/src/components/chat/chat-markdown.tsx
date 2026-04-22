import { memo, useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Check, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { cn } from "../../lib/utils";

type MarkdownBlock =
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; content: string }
  | { type: "paragraph"; content: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "quote"; content: string }
  | { type: "divider" }
  | { type: "code"; content: string; language?: string };

type MarkdownSection = {
  id: string;
  title?: string;
  blocks: MarkdownBlock[];
  emphasis?: "intro" | "section";
};

function parseInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\[[^\]]+\]\([^)]+\))/g);
  return parts
    .filter(Boolean)
    .map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("*") && part.endsWith("*")) {
        return <em key={index}>{part.slice(1, -1)}</em>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return <code key={index}>{part.slice(1, -1)}</code>;
      }
      const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        return <a key={index} href={linkMatch[2]} target="_blank" rel="noreferrer" className="text-brand-600 underline hover:text-brand-800">{linkMatch[1]}</a>;
      }
      return <span key={index}>{part}</span>;
    });
}

function tokenizeMarkdown(content: string): MarkdownBlock[] {
  const lines = content
    .split("\n")
    .map((line) => line.replace(/\r/g, ""))
    .filter((line, index, all) => !(line.trim() === "" && all[index - 1]?.trim() === ""));

  const blocks: MarkdownBlock[] = [];
  let cursor = 0;

  while (cursor < lines.length) {
    const raw = lines[cursor] ?? "";
    const line = raw.trim();

    if (!line) {
      cursor += 1;
      continue;
    }

    const codeFence = line.match(/^```([\w-]+)?/);
    if (codeFence) {
      const codeLines: string[] = [];
      const language = codeFence[1]?.trim();
      cursor += 1;
      while (cursor < lines.length) {
        const current = lines[cursor] ?? "";
        if (current.trim().startsWith("```")) {
          cursor += 1;
          break;
        }
        codeLines.push(current);
        cursor += 1;
      }
      blocks.push({
        type: "code",
        language,
        content: codeLines.join("\n"),
      });
      continue;
    }

    {
      const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
      if (headingMatch) {
        const level = headingMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6;
        blocks.push({ type: "heading", level, content: headingMatch[2].trim() });
        cursor += 1;
        continue;
      }
    }

    if (line === "---" || line === "***") {
      blocks.push({ type: "divider" });
      cursor += 1;
      continue;
    }

    if (line.startsWith(">")) {
      const quoteLines: string[] = [];
      while (cursor < lines.length) {
        const current = (lines[cursor] ?? "").trim();
        if (!current.startsWith(">")) break;
        quoteLines.push(current.replace(/^>\s?/, ""));
        cursor += 1;
      }
      blocks.push({ type: "quote", content: quoteLines.join(" ") });
      continue;
    }

    if (/^[-*+] /.test(line)) {
      const items: string[] = [];
      while (cursor < lines.length) {
        const current = (lines[cursor] ?? "").trim();
        if (!/^[-*+] /.test(current)) break;
        items.push(current.replace(/^[-*+] /, "").trim());
        cursor += 1;
      }
      blocks.push({ type: "list", ordered: false, items });
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (cursor < lines.length) {
        const current = (lines[cursor] ?? "").trim();
        if (!/^\d+\.\s/.test(current)) break;
        items.push(current.replace(/^\d+\.\s/, "").trim());
        cursor += 1;
      }
      blocks.push({ type: "list", ordered: true, items });
      continue;
    }

    const paragraphLines = [line];
    cursor += 1;
    while (cursor < lines.length) {
      const current = (lines[cursor] ?? "").trim();
      if (!current) break;
      if (
        current.startsWith("#")
        || current.startsWith(">")
        || current.startsWith("```")
        || /^[-*+] /.test(current)
        || /^\d+\.\s/.test(current)
        || current === "---"
        || current === "***"
      ) {
        break;
      }
      paragraphLines.push(current);
      cursor += 1;
    }
    blocks.push({ type: "paragraph", content: paragraphLines.join("\n") });
  }

  return blocks;
}

function groupBlocksIntoSections(blocks: MarkdownBlock[]): MarkdownSection[] {
  if (!blocks.length) return [];

  const sections: MarkdownSection[] = [];
  let pending: MarkdownSection = { id: "intro", blocks: [], emphasis: "intro" };

  blocks.forEach((block, index) => {
    if (block.type === "heading" && block.level <= 2) {
      if (pending.blocks.length > 0 || pending.title) {
        sections.push(pending);
      }
      pending = {
        id: `section-${index}`,
        title: block.content,
        blocks: [],
        emphasis: sections.length === 0 ? "intro" : "section",
      };
      return;
    }
    pending.blocks.push(block);
  });

  if (pending.blocks.length > 0 || pending.title) {
    sections.push(pending);
  }

  return sections.length > 0 ? sections : [{ id: "content", blocks, emphasis: "intro" }];
}

function MarkdownBlockView({ block }: { block: MarkdownBlock }) {
  if (block.type === "heading") {
    const headingClass = block.level <= 2
      ? "chat-response-subtitle font-semibold"
      : block.level === 3
        ? "chat-response-subtitle"
        : "text-[13px] font-semibold text-neutral-700 mt-1";
    if (block.level === 1) return <h1 className={headingClass}>{block.content}</h1>;
    if (block.level === 2) return <h2 className={headingClass}>{block.content}</h2>;
    if (block.level === 3) return <h3 className={headingClass}>{block.content}</h3>;
    if (block.level === 4) return <h4 className={headingClass}>{block.content}</h4>;
    if (block.level === 5) return <h5 className={headingClass}>{block.content}</h5>;
    return <h6 className={headingClass}>{block.content}</h6>;
  }

  if (block.type === "paragraph") {
    const lines = block.content.split("\n");
    return (
      <p className="chat-message-prose">
        {lines.map((line, i) => (
          <span key={i}>
            {parseInline(line)}
            {i < lines.length - 1 && <br />}
          </span>
        ))}
      </p>
    );
  }

  if (block.type === "quote") {
    return <blockquote className="chat-quote-block">{parseInline(block.content)}</blockquote>;
  }

  if (block.type === "divider") {
    return <hr className="chat-response-divider" />;
  }

  if (block.type === "list") {
    const ListTag = block.ordered ? "ol" : "ul";
    return (
      <ListTag className={cn("chat-message-list", block.ordered ? "list-decimal" : "list-disc")}>
        {block.items.map((item, index) => (
          <li key={`${item}-${index}`} className="chat-message-list-item">
            {parseInline(item)}
          </li>
        ))}
      </ListTag>
    );
  }

  return <CodeBlock content={block.content} language={block.language} />;
}

function CodeBlock({ content, language }: { content: string; language?: string }) {
  const lines = useMemo(() => content.split("\n"), [content]);
  const isLong = lines.length > 14;
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const visibleLines = isLong && !expanded ? lines.slice(0, 14) : lines;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }, [content]);

  return (
    <div className="chat-code-shell">
      <div className="chat-code-toolbar">
        <div className="flex items-center gap-2">
          <span className="chat-code-dot bg-brand-400" />
          <span className="chat-code-dot bg-emerald-400" />
          <span className="chat-code-dot bg-orange-400" />
          <span className="chat-code-language">{language || "code"}</span>
        </div>
        <div className="flex items-center gap-2">
          {isLong ? (
            <button
              type="button"
              onClick={() => setExpanded((current) => !current)}
              className="chat-code-action"
            >
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {expanded ? "Replier" : `Afficher ${lines.length} lignes`}
            </button>
          ) : null}
          <button type="button" onClick={() => void handleCopy()} className="chat-code-action">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copie" : "Copier"}
          </button>
        </div>
      </div>
      <pre className="chat-code-body">
        <code>{visibleLines.join("\n")}</code>
      </pre>
    </div>
  );
}

export const ChatMarkdown = memo(function ChatMarkdown({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const blocks = useMemo(() => tokenizeMarkdown(content), [content]);
  const sections = useMemo(() => groupBlocksIntoSections(blocks), [blocks]);

  return (
    <div className={cn("space-y-4", className)}>
      {sections.map((section, index) => (
        <section
          key={section.id}
          className={cn(
            "chat-response-section",
            section.emphasis === "intro" && index === 0 && "chat-response-section-intro",
          )}
        >
          {section.title ? (
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="chat-response-title">{section.title}</h2>
              <span className="chat-section-chip">{index === 0 ? "Resume" : `Section ${index + 1}`}</span>
            </div>
          ) : null}
          <div className="space-y-3">
            {section.blocks.map((block, blockIndex) => (
              <MarkdownBlockView key={`${section.id}-${block.type}-${blockIndex}`} block={block} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
});
