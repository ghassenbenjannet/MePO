import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { List, ListOrdered } from "lucide-react";
import { cn } from "../../lib/utils";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert a plain-text newline-joined string to a Tiptap HTML bullet list. */
export function linesToTiptapHtml(lines: string[]): string {
  const filled = lines.filter(Boolean);
  if (filled.length === 0) return "";
  return `<ul>${filled.map((l) => `<li><p>${l}</p></li>`).join("")}</ul>`;
}

/** Convert plain text to Tiptap paragraph HTML. */
export function textToTiptapHtml(text: string): string {
  if (!text.trim()) return "";
  if (text.trimStart().startsWith("<")) return text;
  return text
    .split("\n")
    .map((line) => `<p>${line || "<br/>"}</p>`)
    .join("");
}

/** Extract an array of text lines from Tiptap HTML (list items or paragraphs). */
export function tiptapHtmlToLines(html: string): string[] {
  if (!html) return [];
  const div = document.createElement("div");
  div.innerHTML = html;
  const items = div.querySelectorAll("li");
  if (items.length > 0) {
    return Array.from(items)
      .map((li) => li.textContent?.trim() ?? "")
      .filter(Boolean);
  }
  const paras = div.querySelectorAll("p");
  if (paras.length > 0) {
    return Array.from(paras)
      .map((p) => p.textContent?.trim() ?? "")
      .filter(Boolean);
  }
  return (div.textContent ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
}

/** Extract plain text from Tiptap HTML. */
export function tiptapHtmlToText(html: string): string {
  if (!html) return "";
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent?.trim() ?? "";
}

// ─── Component ────────────────────────────────────────────────────────────────

interface MiniTiptapProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
}

export function MiniTiptap({
  content,
  onChange,
  placeholder = "Écrire ici…",
  minHeight = "100px",
  className,
}: MiniTiptapProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
    ],
    content,
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  if (!editor) return null;

  return (
    <div className={cn("overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] transition focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/20", className)}>
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-0.5 border-b border-[var(--border)] bg-[var(--bg-panel-2)] px-2 py-1.5">
        <ToolBtn
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Gras"
        >
          <span className="text-[11px] font-bold">B</span>
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italique"
        >
          <span className="text-[11px] italic">I</span>
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Barré"
        >
          <span className="text-[11px] line-through">S</span>
        </ToolBtn>
        <div className="mx-1 h-3 w-px bg-[var(--border)]" />
        <ToolBtn
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Liste à puces"
        >
          <List className="h-3 w-3" />
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Liste numérotée"
        >
          <ListOrdered className="h-3 w-3" />
        </ToolBtn>
      </div>

      {/* ── Content ── */}
      <EditorContent
        editor={editor}
        className="px-3 py-2.5 text-sm text-[var(--text-strong)] [&_.ProseMirror]:outline-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0 [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-[var(--text-muted)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-5 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-5 [&_.ProseMirror_li]:my-0.5"
        style={{ minHeight }}
      />
    </div>
  );
}

function ToolBtn({
  children,
  active,
  onClick,
  title,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "flex h-6 w-6 items-center justify-center rounded text-[var(--text-muted)] transition hover:bg-[var(--bg-panel)] hover:text-[var(--text-strong)]",
        active && "bg-[var(--bg-panel)] text-[var(--text-strong)]",
      )}
    >
      {children}
    </button>
  );
}
