import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
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
import { Extension, Node, mergeAttributes } from "@tiptap/core";
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
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-3 shadow-xl">
        <p className="text-xs text-[var(--text-muted)]">Aucun résultat</p>
      </div>
    );
  }

  // Group by category
  const groups = Array.from(new Set(items.map((i) => i.group)));

  return (
    <div className="max-h-80 min-w-[280px] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] py-1 shadow-2xl">
      {groups.map((group) => {
        const groupItems = items.filter((i) => i.group === group);
        return (
          <div key={group}>
            <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
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
                    "flex w-full items-center gap-3 px-3 py-2 text-left transition",
                    isSelected
                      ? "bg-brand-500/10 text-[var(--text-strong)]"
                      : "text-[var(--text-strong)] hover:bg-[var(--bg-panel-2)]",
                  )}
                >
                  <div className={cn(
                    "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--border)]",
                    isSelected ? "bg-brand-500 border-brand-500 text-white" : "bg-[var(--bg-panel-2)] text-[var(--text-muted)]",
                  )}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-[var(--text-muted)]">{item.description}</p>
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
        ref={state.listRef}
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
    } as ReturnType<NonNullable<Parameters<typeof Node.create>[0]["addCommands"]>>;
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
        "flex h-7 w-7 items-center justify-center rounded text-xs transition",
        active ? "bg-brand-500/15 text-brand-500" : "text-[var(--text-muted)] hover:bg-[var(--bg-panel-2)] hover:text-[var(--text-strong)]",
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px bg-[var(--border)]" />;
}

// ─── Page Editor ─────────────────────────────────────────────────────────────

interface PageEditorProps {
  content: string;
  onChange: (html: string) => void;
  readOnly?: boolean;
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
      Callout,
      slashExt,
    ],
    content: content || "",
    editable: !readOnly,
    onUpdate: ({ editor: ed }) => onChange(ed.getHTML()),
  });

  if (!editor) return null;

  return (
    <div className="flex h-full flex-col">
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

      {/* Toolbar */}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-0.5 border-b border-[var(--border)] bg-[var(--bg-panel)] px-3 py-1.5">
          <TBtn title="Gras" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-3.5 w-3.5" /></TBtn>
          <TBtn title="Italique" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-3.5 w-3.5" /></TBtn>
          <TBtn title="Barré" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="h-3.5 w-3.5" /></TBtn>
          <Divider />
          <TBtn title="Titre 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 className="h-3.5 w-3.5" /></TBtn>
          <TBtn title="Titre 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-3.5 w-3.5" /></TBtn>
          <TBtn title="Titre 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="h-3.5 w-3.5" /></TBtn>
          <Divider />
          <TBtn title="Liste à puces" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-3.5 w-3.5" /></TBtn>
          <TBtn title="Liste numérotée" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-3.5 w-3.5" /></TBtn>
          <TBtn title="Tâches" active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()}><CheckSquare className="h-3.5 w-3.5" /></TBtn>
          <Divider />
          <TBtn title="Citation" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="h-3.5 w-3.5" /></TBtn>
          <TBtn title="Code inline" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}><Code className="h-3.5 w-3.5" /></TBtn>
          <TBtn title="Bloc de code" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
            <span className="font-mono text-[10px] font-bold">&lt;/&gt;</span>
          </TBtn>
          <TBtn title="Séparateur" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus className="h-3.5 w-3.5" /></TBtn>
          <Divider />
          <TBtn title="Tableau" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><TableIcon className="h-3.5 w-3.5" /></TBtn>
          <Divider />
          {/* Callouts */}
          <TBtn title="Callout Note" active={editor.isActive("callout", { type: "note" })} onClick={() => {
            if (editor.isActive("callout")) editor.chain().focus().liftCallout().run();
            else editor.chain().focus().setCallout({ type: "note" }).run();
          }}><AlertCircle className="h-3.5 w-3.5 text-brand-500" /></TBtn>
          <TBtn title="Callout Attention" active={editor.isActive("callout", { type: "warning" })} onClick={() => {
            if (editor.isActive("callout")) editor.chain().focus().liftCallout().run();
            else editor.chain().focus().setCallout({ type: "warning" }).run();
          }}><AlertTriangle className="h-3.5 w-3.5 text-warn-500" /></TBtn>
          <TBtn title="Callout OK" active={editor.isActive("callout", { type: "success" })} onClick={() => {
            if (editor.isActive("callout")) editor.chain().focus().liftCallout().run();
            else editor.chain().focus().setCallout({ type: "success" }).run();
          }}><CheckCircle className="h-3.5 w-3.5 text-accent-500" /></TBtn>
          <TBtn title="Callout KO" active={editor.isActive("callout", { type: "error" })} onClick={() => {
            if (editor.isActive("callout")) editor.chain().focus().liftCallout().run();
            else editor.chain().focus().setCallout({ type: "error" }).run();
          }}><XCircle className="h-3.5 w-3.5 text-danger-500" /></TBtn>
          <Divider />
          <span className="ml-1 text-[10px] text-[var(--text-muted)]">ou tapez <kbd className="rounded bg-[var(--bg-panel-2)] px-1 py-0.5 font-mono">/</kbd></span>
        </div>
      )}

      {/* Contextual table toolbar — always in DOM, revealed via opacity so height stays constant */}
      {!readOnly && (
        <div
          aria-hidden={!editor.isActive("table")}
          className={cn(
            "flex flex-wrap items-center gap-1 border-b border-[var(--border)] bg-brand-500/5 px-3 py-1.5 transition-all duration-150",
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

      {/* Editor */}
      <div className="prose-editor flex-1 overflow-y-auto p-5">
        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  );
}
