import {
  type ChangeEvent,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { EditorContent, ReactRenderer, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import CodeBlock from "@tiptap/extension-code-block";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { Extension, Mark, Node, mergeAttributes } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import {
  AlertCircle,
  AlertTriangle,
  Bold,
  CheckCircle,
  CheckSquare,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Minus,
  Quote,
  Strikethrough,
  Table as TableIcon,
  XCircle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowLeft,
  Trash2,
  Columns,
  Rows,
  FileStack,
  Sparkles,
  ListTree,
  BookOpenText,
  Highlighter,
  ImagePlus,
  Palette,
} from "lucide-react";
import { cn } from "../../lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type CalloutType = "note" | "warning" | "success" | "error";

interface SlashCommand {
  title: string;
  description: string;
  icon: React.ElementType;
  group: string;
  keywords: string[];
  action: (props: { editor: ReturnType<typeof useEditor> extends null ? never : NonNullable<ReturnType<typeof useEditor>>; range: { from: number; to: number } }) => void;
}

const TEXT_COLOR_OPTIONS = [
  { label: "Défaut", value: null, swatch: "#334155" },
  { label: "Violet", value: "#8B5CF6", swatch: "#8B5CF6" },
  { label: "Bleu", value: "#3B82F6", swatch: "#3B82F6" },
  { label: "Vert", value: "#10B981", swatch: "#10B981" },
  { label: "Jaune", value: "#CA8A04", swatch: "#FACC15" },
] as const;

const TEXT_BACKGROUND_OPTIONS = [
  { label: "Aucun fond", value: null, swatch: "#FFFFFF" },
  { label: "Violet", value: "rgba(139, 92, 246, 0.18)", swatch: "#8B5CF6" },
  { label: "Bleu", value: "rgba(59, 130, 246, 0.18)", swatch: "#3B82F6" },
  { label: "Vert", value: "rgba(16, 185, 129, 0.18)", swatch: "#10B981" },
  { label: "Jaune", value: "rgba(250, 204, 21, 0.22)", swatch: "#FACC15" },
] as const;

// ─── Slash Commands list ──────────────────────────────────────────────────────

const SLASH_COMMANDS: SlashCommand[] = [
  // Titres
  {
    title: "Titre 1",
    description: "Grand titre de section",
    icon: Heading1,
    group: "Mise en forme",
    keywords: ["h1", "heading", "titre", "grand"],
    action: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run(),
  },
  {
    title: "Titre 2",
    description: "Titre de sous-section",
    icon: Heading2,
    group: "Mise en forme",
    keywords: ["h2", "heading", "titre", "sous"],
    action: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run(),
  },
  {
    title: "Titre 3",
    description: "Petit titre",
    icon: Heading3,
    group: "Mise en forme",
    keywords: ["h3", "heading", "titre", "petit"],
    action: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 3 }).run(),
  },
  // Listes
  {
    title: "Liste à puces",
    description: "Liste non ordonnée",
    icon: List,
    group: "Listes",
    keywords: ["ul", "bullet", "liste", "puces"],
    action: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: "Liste numérotée",
    description: "Liste ordonnée avec numéros",
    icon: ListOrdered,
    group: "Listes",
    keywords: ["ol", "ordered", "liste", "numero", "numéroté"],
    action: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: "Tâches",
    description: "Liste de cases à cocher",
    icon: CheckSquare,
    group: "Listes",
    keywords: ["todo", "task", "tache", "checkbox", "check"],
    action: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  // Blocs
  {
    title: "Citation",
    description: "Bloc de citation ou note",
    icon: Quote,
    group: "Blocs",
    keywords: ["quote", "blockquote", "citation"],
    action: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setBlockquote().run(),
  },
  {
    title: "Bloc de code",
    description: "Code avec coloration syntaxique",
    icon: Code,
    group: "Blocs",
    keywords: ["code", "pre", "snippet", "code block"],
    action: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setCodeBlock().run(),
  },
  {
    title: "Tableau",
    description: "Tableau 3 colonnes × 3 lignes",
    icon: TableIcon,
    group: "Blocs",
    keywords: ["table", "tableau", "grid"],
    action: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run(),
  },
  {
    title: "Séparateur",
    description: "Ligne horizontale de séparation",
    icon: Minus,
    group: "Blocs",
    keywords: ["hr", "separateur", "divider", "ligne"],
    action: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
  // Callouts
  {
    title: "Note",
    description: "Information complémentaire (bleu)",
    icon: AlertCircle,
    group: "Callouts",
    keywords: ["note", "info", "callout", "bleu"],
    action: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({ type: "callout", attrs: { type: "note" }, content: [{ type: "paragraph" }] })
        .run(),
  },
  {
    title: "Attention",
    description: "Point de vigilance (orange)",
    icon: AlertTriangle,
    group: "Callouts",
    keywords: ["warning", "attention", "warn", "orange", "vigilance"],
    action: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({ type: "callout", attrs: { type: "warning" }, content: [{ type: "paragraph" }] })
        .run(),
  },
  {
    title: "OK / Validé",
    description: "Comportement validé (vert)",
    icon: CheckCircle,
    group: "Callouts",
    keywords: ["ok", "success", "valide", "vert", "done"],
    action: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({ type: "callout", attrs: { type: "success" }, content: [{ type: "paragraph" }] })
        .run(),
  },
  {
    title: "KO / Anomalie",
    description: "Non conforme ou bloquant (rouge)",
    icon: XCircle,
    group: "Callouts",
    keywords: ["ko", "error", "anomalie", "rouge", "erreur"],
    action: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({ type: "callout", attrs: { type: "error" }, content: [{ type: "paragraph" }] })
        .run(),
  },
];

function filterCommands(query: string) {
  if (!query) return SLASH_COMMANDS;
  const q = query.toLowerCase();
  return SLASH_COMMANDS.filter(
    (cmd) =>
      cmd.title.toLowerCase().includes(q) ||
      cmd.description.toLowerCase().includes(q) ||
      cmd.keywords.some((k) => k.includes(q)),
  );
}

// ─── Command List component (keyboard-navigable) ──────────────────────────────

interface CommandListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface CommandListProps {
  items: SlashCommand[];
  command: (item: SlashCommand) => void;
}

const CommandList = forwardRef<CommandListRef, CommandListProps>(({ items, command }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => setSelectedIndex(0), [items]);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  useImperativeHandle(ref, () => ({
    onKeyDown({ event }) {
      if (event.key === "ArrowUp") {
        setSelectedIndex((i) => (i - 1 + items.length) % items.length);
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelectedIndex((i) => (i + 1) % items.length);
        return true;
      }
      if (event.key === "Enter") {
        if (items[selectedIndex]) command(items[selectedIndex]);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur">
        <p className="text-xs text-[var(--text-muted)]">Aucun résultat</p>
      </div>
    );
  }

  // Group by category
  const groups = Array.from(new Set(items.map((i) => i.group)));

  return (
    <div className="max-h-80 min-w-[320px] overflow-y-auto rounded-[22px] border border-slate-200 bg-white/95 py-2 shadow-[0_24px_60px_rgba(15,23,42,0.16)] backdrop-blur">
      {groups.map((group) => {
        const groupItems = items.filter((i) => i.group === group);
        return (
          <div key={group}>
            <p className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              {group}
            </p>
            {groupItems.map((item) => {
              const globalIndex = items.indexOf(item);
              const isSelected = globalIndex === selectedIndex;
              const Icon = item.icon;
              return (
                <button
                  key={item.title}
                  ref={isSelected ? selectedRef : null}
                  type="button"
                  onClick={() => command(item)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-2.5 text-left transition duration-200 ease-in-out",
                    isSelected
                      ? "bg-gradient-to-r from-[#8B5CF6]/10 to-[#3B82F6]/10 text-slate-900"
                      : "text-slate-900 hover:bg-slate-50",
                  )}
                >
                  <div className={cn(
                    "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl border border-slate-200",
                    isSelected ? "bg-gradient-to-r from-[#8B5CF6] to-[#3B82F6] border-transparent text-white" : "bg-slate-50 text-slate-500",
                  )}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-slate-500">{item.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
});
CommandList.displayName = "CommandList";

// ─── Slash Command Popup (portal) ─────────────────────────────────────────────

interface SlashMenuState {
  rect: DOMRect;
  items: SlashCommand[];
  command: (item: SlashCommand) => void;
  listRef: React.RefObject<CommandListRef | null>;
}

function SlashMenuPortal({ state }: { state: SlashMenuState }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!ref.current) return;
    const menuH = ref.current.offsetHeight;
    const menuW = ref.current.offsetWidth;
    const vpH = window.innerHeight;
    const vpW = window.innerWidth;
    let top = state.rect.bottom + 8;
    let left = state.rect.left;
    if (top + menuH > vpH - 16) top = state.rect.top - menuH - 8;
    if (left + menuW > vpW - 16) left = vpW - menuW - 16;
    setPos({ top, left });
  }, [state.rect, state.items]);

  return createPortal(
    <div
      ref={ref}
      style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999 }}
    >
      <CommandList
        ref={state.listRef as React.RefObject<CommandListRef>}
        items={state.items}
        command={state.command}
      />
    </div>,
    document.body,
  );
}

// ─── Callout Node ─────────────────────────────────────────────────────────────

const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return { type: { default: "note" as CalloutType } };
  },

  parseHTML() {
    return [{ tag: "div[data-callout]", getAttrs: (el) => ({ type: (el as HTMLElement).getAttribute("data-type") || "note" }) }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-callout": "", "data-type": node.attrs.type }), 0];
  },

  addCommands() {
    return {
      setCallout:
        (attrs: { type: CalloutType }) =>
        ({ commands }: { commands: { wrapIn: (name: string, attrs: object) => boolean } }) =>
          commands.wrapIn(this.name, attrs),
      liftCallout:
        () =>
        ({ commands }: { commands: { lift: (name: string) => boolean } }) =>
          commands.lift(this.name),
    } as any;
  },
});

const StyledText = Mark.create({
  name: "styledText",

  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element) => (element as HTMLElement).style.color || null,
      },
      backgroundColor: {
        default: null,
        parseHTML: (element) => (element as HTMLElement).style.backgroundColor || null,
      },
    };
  },

  parseHTML() {
    return [{ tag: "span" }];
  },

  renderHTML({ HTMLAttributes }) {
    const { color, backgroundColor, ...rest } = HTMLAttributes as {
      color?: string | null;
      backgroundColor?: string | null;
    };

    const styles = [
      color ? `color: ${color}` : "",
      backgroundColor ? `background-color: ${backgroundColor}` : "",
      backgroundColor ? "padding: 0 0.18em" : "",
      backgroundColor ? "border-radius: 0.35em" : "",
      backgroundColor ? "box-decoration-break: clone" : "",
      backgroundColor ? "-webkit-box-decoration-break: clone" : "",
    ].filter(Boolean).join("; ");

    return ["span", mergeAttributes(rest, styles ? { style: styles } : {}), 0];
  },

  addCommands() {
    return {
      setTextColor:
        (color: string) =>
        ({ chain, editor }: any) =>
          chain()
            .setMark(this.name, {
              ...editor.getAttributes(this.name),
              color,
            })
            .run(),
      unsetTextColor:
        () =>
        ({ chain, editor, commands }: any) => {
          const attrs = editor.getAttributes(this.name) ?? {};
          if (attrs.backgroundColor) {
            return chain().setMark(this.name, { backgroundColor: attrs.backgroundColor, color: null }).run();
          }
          return commands.unsetMark(this.name);
        },
      setTextBackground:
        (backgroundColor: string) =>
        ({ chain, editor }: any) =>
          chain()
            .setMark(this.name, {
              ...editor.getAttributes(this.name),
              backgroundColor,
            })
            .run(),
      unsetTextBackground:
        () =>
        ({ chain, editor, commands }: any) => {
          const attrs = editor.getAttributes(this.name) ?? {};
          if (attrs.color) {
            return chain().setMark(this.name, { color: attrs.color, backgroundColor: null }).run();
          }
          return commands.unsetMark(this.name);
        },
      clearTextStyle:
        () =>
        ({ commands }: any) =>
          commands.unsetMark(this.name),
    } as any;
  },
});

const InlineImage = Node.create({
  name: "inlineImage",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "img[src]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "img",
      mergeAttributes(HTMLAttributes, {
        class: "my-6 block max-h-[520px] w-auto max-w-full rounded-[24px] border border-slate-200 bg-white object-contain shadow-[0_18px_40px_rgba(15,23,42,0.08)]",
      }),
    ];
  },

  addCommands() {
    return {
      setInlineImage:
        (attrs: { src: string; alt?: string; title?: string }) =>
        ({ commands }: any) =>
          commands.insertContent({ type: this.name, attrs }),
    } as any;
  },
});

// ─── Build Slash Command extension ───────────────────────────────────────────
// We hold a mutable ref that gets filled by the hook below, then the
// extension's render callbacks write into it.

interface SlashState {
  open: boolean;
  rect: DOMRect | null;
  items: SlashCommand[];
  command: ((item: SlashCommand) => void) | null;
  listRef: React.RefObject<CommandListRef | null>;
}

function buildSlashExtension(slashRef: React.MutableRefObject<{
  set: (s: Partial<SlashState>) => void;
  listRef: React.RefObject<CommandListRef | null>;
}>) {
  return Extension.create({
    name: "slashCommand",

    addProseMirrorPlugins() {
      const editor = this.editor;
      return [
        Suggestion({
          editor,
          char: "/",
          startOfLine: false,
          allowSpaces: false,

          items: ({ query }) => filterCommands(query),

          command: ({ editor: ed, range, props }) => {
            (props as SlashCommand).action({ editor: ed as Parameters<SlashCommand["action"]>[0]["editor"], range });
          },

          render: () => {
            let currentProps: Parameters<NonNullable<Parameters<typeof Suggestion>[0]["render"]>> extends never ? never : any;

            return {
              onStart(props: any) {
                currentProps = props;
                slashRef.current.set({
                  open: true,
                  rect: props.clientRect?.() ?? null,
                  items: props.items as SlashCommand[],
                  command: (item: SlashCommand) => {
                    props.command(item);
                    slashRef.current.set({ open: false });
                  },
                });
              },

              onUpdate(props: any) {
                currentProps = props;
                slashRef.current.set({
                  open: true,
                  rect: props.clientRect?.() ?? null,
                  items: props.items as SlashCommand[],
                  command: (item: SlashCommand) => {
                    props.command(item);
                    slashRef.current.set({ open: false });
                  },
                });
              },

              onExit() {
                slashRef.current.set({ open: false });
              },

              onKeyDown({ event }: { event: KeyboardEvent }) {
                if (event.key === "Escape") {
                  slashRef.current.set({ open: false });
                  return true;
                }
                return slashRef.current.listRef.current?.onKeyDown({ event }) ?? false;
              },
            };
          },
        }),
      ];
    },
  });
}

// ─── Toolbar button ───────────────────────────────────────────────────────────

function TBtn({ active, onClick, title, children }: { active?: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full text-xs transition duration-200 ease-in-out",
        active
          ? "bg-[var(--ink)] text-[var(--paper)] shadow-[0_10px_24px_rgba(28,24,20,0.18)]"
          : "text-[var(--ink-3)] hover:bg-[var(--paper-2)] hover:text-[var(--ink)]",
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1.5 h-5 w-px bg-[var(--rule)]" />;
}

function QuickInsertButton({
  label,
  hint,
  onClick,
  children,
}: {
  label: string;
  hint: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-2xl border border-line bg-white px-3 py-2 text-left text-xs transition hover:border-brand-200 hover:bg-brand-50/40"
    >
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
        {children}
      </span>
      <span className="min-w-0">
        <span className="block font-semibold text-ink">{label}</span>
        <span className="block truncate text-[11px] text-muted">{hint}</span>
      </span>
    </button>
  );
}

// ─── Page Editor ─────────────────────────────────────────────────────────────

interface PageEditorProps {
  content: string;
  onChange: (html: string) => void;
  readOnly?: boolean;
}

interface PageHeading {
  id: string;
  level: number;
  text: string;
}

function extractHeadingsFromHtml(html: string): PageHeading[] {
  const matches = Array.from(html.matchAll(/<(h[1-6])[^>]*>(.*?)<\/\1>/gi));
  return matches.map((match, index) => ({
    id: `heading-${index}`,
    level: Number(match[1].replace("h", "")),
    text: match[2]
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  })).filter((heading) => heading.text);
}

function countWords(html: string) {
  const plain = html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return plain ? plain.split(" ").filter(Boolean).length : 0;
}

export function PageEditor({ content, onChange, readOnly = false }: PageEditorProps) {
  // Slash menu state
  const [slashState, setSlashState] = useState<SlashState>({
    open: false,
    rect: null,
    items: [],
    command: null,
    listRef: { current: null } as React.RefObject<CommandListRef | null>,
  });
  const listRef = useRef<CommandListRef | null>(null);

  const slashRef = useRef({
    set: (s: Partial<SlashState>) => setSlashState((prev) => ({ ...prev, ...s })),
    listRef,
  });
  // keep listRef in sync
  slashState.listRef = listRef;

  // Build extension once
  const slashExt = useRef(buildSlashExtension(slashRef)).current;
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [headings, setHeadings] = useState<PageHeading[]>(() => extractHeadingsFromHtml(content || ""));
  const [wordCount, setWordCount] = useState(() => countWords(content || ""));

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      CodeBlock,
      Placeholder.configure({ placeholder: "Commencez à écrire… tapez / pour insérer un bloc" }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      StyledText,
      InlineImage,
      Callout,
      slashExt,
    ],
    content: content || "",
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: "focus:outline-none",
      },
      handlePaste(view, event) {
        const items = Array.from(event.clipboardData?.items ?? []);
        const imageItem = items.find((item) => item.type.startsWith("image/"));
        const imageNode = view.state.schema.nodes.inlineImage;
        if (!imageItem || !imageNode) return false;

        const file = imageItem.getAsFile();
        if (!file) return false;

        event.preventDefault();
        const reader = new FileReader();
        reader.onload = () => {
          const src = typeof reader.result === "string" ? reader.result : "";
          if (!src) return;
          const node = imageNode.create({
            src,
            alt: file.name || "Image collée",
            title: file.name || "Image collée",
          });
          const transaction = view.state.tr.replaceSelectionWith(node).scrollIntoView();
          view.dispatch(transaction);
        };
        reader.readAsDataURL(file);
        return true;
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      setHeadings(extractHeadingsFromHtml(html));
      setWordCount(countWords(html));
      onChange(html);
    },
  });

  if (!editor) return null;

  useEffect(() => {
    const html = editor.getHTML();
    setHeadings(extractHeadingsFromHtml(html));
    setWordCount(countWords(html));
  }, [editor, content]);

  const readingTime = useMemo(() => Math.max(1, Math.ceil(wordCount / 220)), [wordCount]);

  const quickInsertHeading = () => editor.chain().focus().toggleHeading({ level: 2 }).run();
  const quickInsertTasks = () => editor.chain().focus().toggleTaskList().run();
  const quickInsertTable = () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  const quickInsertCode = () => editor.chain().focus().toggleCodeBlock().run();
  const quickInsertNote = () => {
    const chain = editor.chain().focus() as any;
    if (editor.isActive("callout")) chain.liftCallout().run();
    else chain.setCallout({ type: "note" }).run();
  };
  const quickInsertWarning = () => {
    const chain = editor.chain().focus() as any;
    if (editor.isActive("callout")) chain.liftCallout().run();
    else chain.setCallout({ type: "warning" }).run();
  };
  const applyTextColor = (color: string | null) => {
    const chain = editor.chain().focus() as any;
    if (color) chain.setTextColor(color).run();
    else chain.unsetTextColor().run();
  };
  const applyTextBackground = (color: string | null) => {
    const chain = editor.chain().focus() as any;
    if (color) chain.setTextBackground(color).run();
    else chain.unsetTextBackground().run();
  };
  const clearTextStyles = () => {
    (editor.chain().focus() as any).clearTextStyle().run();
  };
  const insertImageFromFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = typeof reader.result === "string" ? reader.result : "";
      if (!src) return;
      (editor.chain().focus() as any).setInlineImage({
        src,
        alt: file.name || "Image",
        title: file.name || "Image",
      }).run();
    };
    reader.readAsDataURL(file);
  };
  const handlePickImage = () => {
    imageInputRef.current?.click();
  };
  const handleImageInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    insertImageFromFile(file);
    event.currentTarget.value = "";
  };

  const scrollToHeading = (headingIndex: number) => {
    const headingNodes = editor.view.dom.querySelectorAll("h1, h2, h3, h4, h5, h6");
    const target = headingNodes.item(headingIndex);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const editorSurfaceClass = cn(
    "min-h-full w-full text-[14px] leading-[1.72] text-[var(--ink-2)] [font-family:var(--font-body)]",
    "[&_*.is-editor-empty:first-child::before]:text-[var(--ink-4)] [&_*.is-editor-empty:first-child::before]:opacity-100",
    "[&_h1]:mb-4 [&_h1]:mt-1 [&_h1]:font-[var(--font-display)] [&_h1]:text-[34px] [&_h1]:leading-[0.98] [&_h1]:tracking-[-0.04em] [&_h1]:text-[var(--ink)]",
    "[&_h2]:mb-3 [&_h2]:mt-10 [&_h2]:font-[var(--font-display)] [&_h2]:text-[27px] [&_h2]:leading-[1.04] [&_h2]:tracking-[-0.03em] [&_h2]:text-[var(--ink)]",
    "[&_h3]:mb-3 [&_h3]:mt-8 [&_h3]:font-[var(--font-display)] [&_h3]:text-[21px] [&_h3]:leading-[1.08] [&_h3]:tracking-[-0.03em] [&_h3]:text-[var(--ink)]",
    "[&_p]:my-3 [&_p]:max-w-[72ch] [&_p]:leading-[1.72]",
    "[&_ul]:my-4 [&_ul]:max-w-[72ch] [&_ul]:list-disc [&_ul]:pl-5 [&_ul_li]:my-1.5",
    "[&_ol]:my-4 [&_ol]:max-w-[72ch] [&_ol]:list-decimal [&_ol]:pl-5 [&_ol_li]:my-1.5",
    "[&_blockquote]:my-5 [&_blockquote]:max-w-[72ch] [&_blockquote]:rounded-[16px] [&_blockquote]:border-l-[3px] [&_blockquote]:border-[var(--accent)] [&_blockquote]:bg-[var(--paper-2)] [&_blockquote]:px-4 [&_blockquote]:py-3 [&_blockquote]:italic [&_blockquote]:text-[var(--ink-3)]",
    "[&_pre]:my-5 [&_pre]:max-w-[72ch] [&_pre]:overflow-x-auto [&_pre]:rounded-[18px] [&_pre]:bg-[var(--ink)] [&_pre]:p-4 [&_pre]:text-[12px] [&_pre]:leading-[1.7] [&_pre]:text-[var(--paper)]",
    "[&_code]:font-[var(--font-mono)] [&_code]:text-[0.92em]",
    "[&_hr]:my-8 [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-[var(--rule)]",
    "[&_table]:my-7 [&_table]:w-full [&_table]:max-w-[72ch] [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-[16px] [&_table]:border [&_table]:border-[var(--rule)]",
    "[&_th]:border-b [&_th]:border-[var(--rule)] [&_th]:bg-[var(--paper-2)] [&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_th]:font-[var(--font-mono)] [&_th]:text-[10px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.16em] [&_th]:text-[var(--ink-4)]",
    "[&_td]:border-b [&_td]:border-[var(--rule)] [&_td]:px-4 [&_td]:py-3 [&_td]:align-top",
    "[&_tr:hover_td]:bg-[var(--paper-2)]",
    "[&_div[data-callout]]:my-5 [&_div[data-callout]]:max-w-[72ch] [&_div[data-callout]]:rounded-[16px] [&_div[data-callout]]:border-0 [&_div[data-callout]]:border-l-[3px] [&_div[data-callout]]:px-4 [&_div[data-callout]]:py-3",
    "[&_div[data-callout][data-type='note']]:border-[var(--accent)] [&_div[data-callout][data-type='note']]:bg-[var(--accent-soft)]",
    "[&_div[data-callout][data-type='warning']]:border-[var(--warm)] [&_div[data-callout][data-type='warning']]:bg-[var(--warm-soft)]",
    "[&_div[data-callout][data-type='success']]:border-[var(--success)] [&_div[data-callout][data-type='success']]:bg-[var(--success-soft)]",
    "[&_div[data-callout][data-type='error']]:border-[var(--hot)] [&_div[data-callout][data-type='error']]:bg-[var(--hot-soft)]",
    "[&_a]:text-[var(--accent-deep)] [&_a]:underline-offset-4 hover:[&_a]:underline",
    readOnly ? "[&_div[data-callout]]:cursor-default" : "",
  );

  return (
    <div className="flex min-h-full bg-[var(--paper)] [font-family:var(--font-body)]">
      {/* Slash command palette portal */}
      {slashState.open && slashState.rect && slashState.command && (
        <SlashMenuPortal
          state={{
            rect: slashState.rect,
            items: slashState.items,
            command: slashState.command,
            listRef,
          }}
        />
      )}

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Toolbar */}
          {!readOnly && (
            <div className="sticky top-0 z-20 border-b border-[var(--rule)] bg-[var(--paper)]/95 px-4 py-3 backdrop-blur lg:px-8">
              <div className="mx-auto flex max-w-[720px] justify-start">
                <div className="flex w-fit max-w-full flex-wrap items-center gap-1 rounded-full border border-[var(--rule)] bg-[var(--paper)] px-3 py-2 shadow-[0_12px_30px_rgba(28,24,20,0.06)]">
                  <TBtn title="Titre 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
                    <span className="font-[var(--font-display)] text-[13px] font-semibold">H1</span>
                  </TBtn>
                  <TBtn title="Titre 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
                    <span className="font-[var(--font-display)] text-[12px] font-semibold">H2</span>
                  </TBtn>
                  <Divider />
                  <TBtn title="Gras" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></TBtn>
                  <TBtn title="Italique" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></TBtn>
                  <TBtn title="Code inline" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}>
                    <span className="font-mono text-[11px] font-bold">{"{ }"}</span>
                  </TBtn>
                  <Divider />
                  <TBtn title="Liste a puces" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></TBtn>
                  <TBtn title="Liste numerotee" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></TBtn>
                  <TBtn title="Checklist" active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()}><CheckSquare className="h-4 w-4" /></TBtn>
                  <Divider />
                  <TBtn title="Citation" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="h-4 w-4" /></TBtn>
                  <TBtn title="Inserer une image" onClick={handlePickImage}><ImagePlus className="h-4 w-4" /></TBtn>
                  <Divider />
                  <button
                    type="button"
                    onClick={quickInsertNote}
                    className="inline-flex h-7 items-center justify-center rounded-full bg-[var(--accent)] px-3 text-[11px] font-semibold text-[var(--accent-ink)] transition hover:bg-[var(--accent-deep)]"
                    title="MePO Ask"
                  >
                    <Sparkles className="mr-1 h-3.5 w-3.5" />
                    MePO Ask
                  </button>
                </div>
              </div>
              <div className="hidden mx-auto flex max-w-[960px] justify-start">
                <div className="flex w-fit max-w-full flex-wrap items-center gap-1 rounded-full border border-[var(--rule)] bg-[var(--paper)] px-3 py-2 shadow-[0_12px_30px_rgba(28,24,20,0.06)]">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageInputChange}
                  className="hidden"
                />
                {/* Text formatting */}
                <TBtn title="Gras (Ctrl+B)" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></TBtn>
                <TBtn title="Italique (Ctrl+I)" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></TBtn>
                <TBtn title="Barré" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="h-4 w-4" /></TBtn>
                <TBtn title="Code inline" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}><Code className="h-4 w-4" /></TBtn>
                <Divider />
                <TBtn title="Titre 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 className="h-4 w-4" /></TBtn>
                <TBtn title="Titre 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-4 w-4" /></TBtn>
                <TBtn title="Titre 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="h-4 w-4" /></TBtn>
                <Divider />
                <TBtn title="Liste à puces" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></TBtn>
                <TBtn title="Liste numérotée" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></TBtn>
                <TBtn title="Cases à cocher" active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()}><CheckSquare className="h-4 w-4" /></TBtn>
                <Divider />
                <TBtn title="Citation" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="h-4 w-4" /></TBtn>
                <TBtn title="Bloc de code" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
                  <span className="font-mono text-[11px] font-bold">&lt;/&gt;</span>
                </TBtn>
                <TBtn title="Séparateur horizontal" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus className="h-4 w-4" /></TBtn>
                <TBtn title="Tableau 3×3" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><TableIcon className="h-4 w-4" /></TBtn>
                <Divider />
                <div className="flex items-center gap-1 rounded-full border border-[var(--rule)] bg-[var(--paper-2)] px-2 py-1">
                  <Palette className="h-3.5 w-3.5 text-[var(--ink-4)]" />
                  {TEXT_COLOR_OPTIONS.map((option) => {
                    const currentColor = (editor.getAttributes("styledText").color as string | null) ?? null;
                    const isActive = option.value === null ? !currentColor : currentColor === option.value;
                    return (
                      <button
                        key={option.label}
                        type="button"
                        title={`Couleur du texte : ${option.label}`}
                        onClick={() => applyTextColor(option.value)}
                        className={cn(
                          "h-6 w-6 rounded-full ring-1 ring-[var(--rule)] transition duration-200 ease-in-out hover:scale-105",
                          isActive && "ring-2 ring-[var(--ink)] ring-offset-2 ring-offset-[var(--paper)]",
                        )}
                        style={{ backgroundColor: option.swatch }}
                      />
                    );
                  })}
                </div>
                <div className="flex items-center gap-1 rounded-full border border-[var(--rule)] bg-[var(--paper-2)] px-2 py-1">
                  <Highlighter className="h-3.5 w-3.5 text-[var(--ink-4)]" />
                  {TEXT_BACKGROUND_OPTIONS.map((option) => {
                    const currentBackground = (editor.getAttributes("styledText").backgroundColor as string | null) ?? null;
                    const isActive = option.value === null ? !currentBackground : currentBackground === option.value;
                    return (
                      <button
                        key={option.label}
                        type="button"
                        title={`Fond du texte : ${option.label}`}
                        onClick={() => applyTextBackground(option.value)}
                        className={cn(
                          "h-6 w-6 rounded-full border transition duration-200 ease-in-out hover:scale-105",
                          option.value === null ? "border-[var(--rule)] bg-[var(--paper)]" : "border-[var(--paper)]",
                          isActive && "ring-2 ring-[var(--ink)] ring-offset-2 ring-offset-[var(--paper)]",
                        )}
                        style={{ backgroundColor: option.value ?? "#FFFFFF" }}
                      />
                    );
                  })}
                </div>
                <TBtn title="Effacer les styles de texte" onClick={clearTextStyles}><span className="text-[11px] font-semibold">Tx</span></TBtn>
                <TBtn title="Insérer une image" onClick={handlePickImage}><ImagePlus className="h-4 w-4" /></TBtn>
                <TBtn title="Note (info)" active={editor.isActive("callout", { type: "note" })} onClick={quickInsertNote}><AlertCircle className="h-4 w-4 text-brand-500" /></TBtn>
                <TBtn title="Attention" active={editor.isActive("callout", { type: "warning" })} onClick={quickInsertWarning}><AlertTriangle className="h-4 w-4 text-amber-500" /></TBtn>
                <TBtn title="Validé / OK" active={editor.isActive("callout", { type: "success" })} onClick={() => {
                  const chain = editor.chain().focus() as any;
                  if (editor.isActive("callout")) chain.liftCallout().run();
                  else chain.setCallout({ type: "success" }).run();
                }}><CheckCircle className="h-4 w-4 text-emerald-500" /></TBtn>
                <TBtn title="Anomalie / KO" active={editor.isActive("callout", { type: "error" })} onClick={() => {
                  const chain = editor.chain().focus() as any;
                  if (editor.isActive("callout")) chain.liftCallout().run();
                  else chain.setCallout({ type: "error" }).run();
                }}><XCircle className="h-4 w-4 text-rose-500" /></TBtn>
                </div>
              </div>
            </div>
          )}

          {/* Contextual table toolbar — always in DOM, revealed via opacity so height stays constant */}
          {!readOnly && (
            <div
              aria-hidden={!editor.isActive("table")}
              className={cn(
                "flex flex-wrap items-center gap-1 border-b border-[var(--rule)] bg-[var(--paper)] px-6 py-2 transition-all duration-200 ease-in-out",
                editor.isActive("table") ? "opacity-100 max-h-10 pointer-events-auto" : "opacity-0 max-h-0 overflow-hidden py-0 border-0 pointer-events-none",
              )}
            >
              <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-brand-500">
                <Columns className="h-3 w-3" />Colonnes
              </span>
              <button type="button" title="Ajouter colonne à gauche" onClick={() => editor.chain().focus().addColumnBefore().run()}
                className="flex h-6 items-center gap-1 rounded px-2 text-xs text-[var(--text-muted)] transition hover:bg-[var(--bg-panel-2)] hover:text-[var(--text-strong)]">
                <ArrowLeft className="h-3 w-3" />Avant
              </button>
              <button type="button" title="Ajouter colonne à droite" onClick={() => editor.chain().focus().addColumnAfter().run()}
                className="flex h-6 items-center gap-1 rounded px-2 text-xs text-[var(--text-muted)] transition hover:bg-[var(--bg-panel-2)] hover:text-[var(--text-strong)]">
                <ArrowRight className="h-3 w-3" />Après
              </button>
              <button type="button" title="Supprimer colonne" onClick={() => editor.chain().focus().deleteColumn().run()}
                className="flex h-6 items-center gap-1 rounded px-2 text-xs text-danger-500 transition hover:bg-danger-500/10">
                <Trash2 className="h-3 w-3" />Col.
              </button>
              <Divider />
              <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-brand-500">
                <Rows className="h-3 w-3" />Lignes
              </span>
              <button type="button" title="Ajouter ligne au-dessus" onClick={() => editor.chain().focus().addRowBefore().run()}
                className="flex h-6 items-center gap-1 rounded px-2 text-xs text-[var(--text-muted)] transition hover:bg-[var(--bg-panel-2)] hover:text-[var(--text-strong)]">
                <ArrowUp className="h-3 w-3" />Avant
              </button>
              <button type="button" title="Ajouter ligne en-dessous" onClick={() => editor.chain().focus().addRowAfter().run()}
                className="flex h-6 items-center gap-1 rounded px-2 text-xs text-[var(--text-muted)] transition hover:bg-[var(--bg-panel-2)] hover:text-[var(--text-strong)]">
                <ArrowDown className="h-3 w-3" />Après
              </button>
              <button type="button" title="Supprimer ligne" onClick={() => editor.chain().focus().deleteRow().run()}
                className="flex h-6 items-center gap-1 rounded px-2 text-xs text-danger-500 transition hover:bg-danger-500/10">
                <Trash2 className="h-3 w-3" />Ligne
              </button>
              <Divider />
              <button type="button" title="Basculer en-tête de ligne" onClick={() => editor.chain().focus().toggleHeaderRow().run()}
                className="flex h-6 items-center gap-1 rounded px-2 text-xs text-[var(--text-muted)] transition hover:bg-[var(--bg-panel-2)] hover:text-[var(--text-strong)]">
                En-tête
              </button>
              <button type="button" title="Basculer en-tête de colonne" onClick={() => editor.chain().focus().toggleHeaderColumn().run()}
                className="flex h-6 items-center gap-1 rounded px-2 text-xs text-[var(--text-muted)] transition hover:bg-[var(--bg-panel-2)] hover:text-[var(--text-strong)]">
                En-tête col.
              </button>
              <Divider />
              <button type="button" title="Supprimer le tableau" onClick={() => editor.chain().focus().deleteTable().run()}
                className="flex h-6 items-center gap-1 rounded px-2 text-xs text-danger-500 transition hover:bg-danger-500/10">
                <Trash2 className="h-3 w-3" />Tableau
              </button>
            </div>
          )}

          <div className="flex min-h-0 flex-1">
            <aside className="hidden">
              <div className="border-b border-line px-5 py-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600">Navigation</p>
                <h3 className="mt-2 font-[var(--font-display)] text-lg font-semibold tracking-tight text-ink">Sommaire de page</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted">Repères de lecture, métriques et structure du document.</p>
              </div>

              <div className="space-y-5 overflow-y-auto px-5 py-5">
                <div className="grid gap-3">
                  <div className="rounded-[22px] border border-line bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                        <FileStack className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Volume</p>
                        <p className="text-base font-semibold text-ink">{wordCount} mots</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-line bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                        <BookOpenText className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Lecture</p>
                        <p className="text-base font-semibold text-ink">{readingTime} min</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-line bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                        <ListTree className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Sections</p>
                        <p className="text-base font-semibold text-ink">{headings.length || 1}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-line bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Plan du document</p>
                  {headings.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {headings.map((heading, index) => (
                        <button
                          key={heading.id}
                          type="button"
                          onClick={() => scrollToHeading(index)}
                          className="flex w-full items-start gap-3 rounded-2xl border border-line bg-slate-50/80 px-3 py-3 text-left transition hover:border-brand-200 hover:bg-brand-50/40"
                        >
                          <span className="mt-0.5 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-600 shadow-sm">
                            H{heading.level}
                          </span>
                          <span className="min-w-0 text-sm leading-relaxed text-ink">{heading.text}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm leading-relaxed text-muted">Ajoute des titres pour faire apparaître un sommaire utile dans la page.</p>
                  )}
                </div>
              </div>
            </aside>
            <div className="flex min-w-0 flex-1 justify-start overflow-visible px-4 py-0 lg:px-8 xl:px-10">
              <div className="w-full max-w-[720px] space-y-0">
                {!readOnly && (
                  <div className="hidden">
                    <div className="rounded-[24px] border border-line bg-white p-4 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600">Blocs rapides</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <QuickInsertButton label="Section" hint="Titre et structure" onClick={quickInsertHeading}><Heading2 className="h-4 w-4" /></QuickInsertButton>
                        <QuickInsertButton label="Checklist" hint="Tâches ou validation" onClick={quickInsertTasks}><CheckSquare className="h-4 w-4" /></QuickInsertButton>
                        <QuickInsertButton label="Callout" hint="Point d'attention" onClick={quickInsertNote}><AlertCircle className="h-4 w-4" /></QuickInsertButton>
                        <QuickInsertButton label="Tableau" hint="Comparatif ou matrice" onClick={quickInsertTable}><TableIcon className="h-4 w-4" /></QuickInsertButton>
                      </div>
                    </div>
                  </div>
                )}

                <section className="hidden">
                  <div className="flex flex-col gap-5 px-6 py-6 lg:px-8">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-2xl border border-white/70 bg-white/85 text-brand-600 shadow-sm">
                        <Sparkles className="h-4 w-4" />
                      </span>
                      <span className="rounded-full border border-brand-200 bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-700">Document workspace</span>
                      <span className="rounded-full border border-white/80 bg-white/75 px-3 py-1 text-[11px] text-muted">Structure editoriale</span>
                      <span className="rounded-full border border-white/80 bg-white/75 px-3 py-1 text-[11px] text-muted">Sommaire actif</span>
                    </div>

                    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(250px,0.9fr)]">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600">Surface documentaire</p>
                        <h2 className="mt-2 font-[var(--font-display)] text-3xl font-bold tracking-tight text-slate-950">Une page plus structurée, plus lisible et plus premium</h2>
                        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                          La rédaction reste dense et métier, mais le cadre visuel devient plus net pour guider la lecture,
                          les comparatifs, les décisions et la capitalisation.
                        </p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                        <div className="rounded-[24px] border border-white/80 bg-white/80 p-4 backdrop-blur">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Longueur</p>
                          <p className="mt-2 text-2xl font-bold tracking-tight text-ink">{wordCount}</p>
                          <p className="mt-1 text-xs text-muted">mots analyses</p>
                        </div>
                        <div className="rounded-[24px] border border-white/80 bg-white/80 p-4 backdrop-blur">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Lecture</p>
                          <p className="mt-2 text-2xl font-bold tracking-tight text-ink">{readingTime} min</p>
                          <p className="mt-1 text-xs text-muted">rythme standard</p>
                        </div>
                        <div className="rounded-[24px] border border-white/80 bg-white/80 p-4 backdrop-blur">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Reperes</p>
                          <p className="mt-2 text-2xl font-bold tracking-tight text-ink">{headings.length || 1}</p>
                          <p className="mt-1 text-xs text-muted">sections visibles</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <div className="w-full bg-[var(--paper)]">
                  <div className="hidden">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-[11px] font-semibold text-brand-700">
                        Page
                      </span>
                      <span className="rounded-full border border-line bg-slate-50 px-3 py-1 text-[11px] text-muted">
                        Édition riche
                      </span>
                    </div>
            
                  </div>

                  <div className="prose-editor overflow-y-visible px-0 py-6 pb-14">
                    <div className="hidden">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-[11px] font-semibold text-brand-700">Page</span>
                        <span className="rounded-full border border-line bg-slate-50 px-3 py-1 text-[11px] text-muted">Surface principale</span>
                      </div>
                      <h4 className="mt-4 font-[var(--font-display)] text-2xl font-semibold tracking-tight text-ink">Contenu éditorial</h4>
                      <p className="mt-2 max-w-2xl text-sm leading-7 text-muted">
                        Rédige ici le corps de page avec une hiérarchie forte, des callouts premium, des tableaux propres
                        et des blocs réutilisables pour les analyses, cadrages et synthèses.
                      </p>
                    </div>

                    <EditorContent editor={editor} className={editorSurfaceClass} />
                  </div>
                </div>
              </div>
            </div>

            {!readOnly && (
              <aside className="hidden">
                <div className="border-b border-line px-5 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600">Atelier</p>
                  <h3 className="mt-2 font-[var(--font-display)] text-lg font-semibold tracking-tight text-ink">Composition du document</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    Insère les bons blocs et garde une page homogène sur les contenus longs.
                  </p>
                </div>
                <div className="space-y-5 overflow-y-auto px-5 py-5">
                  <div className="rounded-[24px] border border-line bg-white p-4 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Repères</p>
                    <div className="mt-3 grid gap-3">
                      <div className="rounded-2xl border border-line bg-slate-50/80 px-3 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Sections</p>
                        <p className="mt-1 text-sm font-semibold text-ink">{headings.length || 1}</p>
                      </div>
                      <div className="rounded-2xl border border-line bg-slate-50/80 px-3 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Lecture</p>
                        <p className="mt-1 text-sm font-semibold text-ink">{readingTime} min environ</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Insertion rapide</p>
                    <div className="grid gap-2">
                      <QuickInsertButton label="Section" hint="Titre niveau 2" onClick={quickInsertHeading}><Heading2 className="h-4 w-4" /></QuickInsertButton>
                      <QuickInsertButton label="Checklist" hint="Suivi d'actions" onClick={quickInsertTasks}><CheckSquare className="h-4 w-4" /></QuickInsertButton>
                      <QuickInsertButton label="Tableau" hint="Synthèse tabulaire" onClick={quickInsertTable}><TableIcon className="h-4 w-4" /></QuickInsertButton>
                      <QuickInsertButton label="Bloc code" hint="SQL, JSON, règles" onClick={quickInsertCode}><Code className="h-4 w-4" /></QuickInsertButton>
                      <QuickInsertButton label="Note" hint="Information complémentaire" onClick={quickInsertNote}><AlertCircle className="h-4 w-4" /></QuickInsertButton>
                      <QuickInsertButton label="Alerte" hint="Vigilance ou point bloquant" onClick={quickInsertWarning}><AlertTriangle className="h-4 w-4" /></QuickInsertButton>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-line bg-white p-4 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Standards de page</p>
                    <div className="mt-3 space-y-3 text-xs leading-6 text-muted">
                      <p>1. Ouvre par un contexte clair et un objectif explicite.</p>
                      <p>2. Utilise des titres courts et réguliers pour nourrir le sommaire.</p>
                      <p>3. Réserve les callouts aux décisions, alertes et validations.</p>
                      <p>4. Préfère les tableaux pour les comparatifs et avant/après.</p>
                    </div>
                  </div>
                </div>
              </aside>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
