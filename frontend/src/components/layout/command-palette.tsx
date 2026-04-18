import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight, FolderKanban, LayoutDashboard, LogOut,
  Moon, Plus, Search, Settings, Sparkles, Sun, User, X,
} from "lucide-react";
import { useProjects } from "../../hooks/use-projects";
import { projectPath } from "../../lib/routes";
import { useAuthStore } from "../../stores/auth-store";
import { useThemeStore } from "../../stores/theme-store";
import { useUiStore } from "../../stores/ui-store";
import { useKeyDown, useDebounce } from "../../lib/hooks";
import { cn } from "../../lib/utils";

interface CommandItem {
  id: string;
  group: string;
  label: string;
  meta?: string;
  icon: React.ElementType;
  iconBg?: string;
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 150);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { data: projects = [] } = useProjects();
  const logout = useAuthStore((s) => s.logout);
  const toggleMode = useThemeStore((s) => s.toggleMode);
  const mode = useThemeStore((s) => s.mode);
  const setCreateProjectModalOpen = useUiStore((s) => s.setCreateProjectModalOpen);

  // Build static commands
  const staticCommands: CommandItem[] = useMemo(() => [
    {
      id: "dashboard", group: "Navigation", label: "Dashboard", meta: "Accueil",
      icon: LayoutDashboard, iconBg: "bg-brand-50 text-brand-600",
      action: () => { navigate("/"); onClose(); },
    },
    {
      id: "new-project", group: "Actions", label: "Nouveau projet", meta: "Créer",
      icon: Plus, iconBg: "bg-emerald-50 text-emerald-600",
      action: () => { navigate("/"); setCreateProjectModalOpen(true); onClose(); },
    },
    {
      id: "profile", group: "Navigation", label: "Profil & préférences",
      icon: User, iconBg: "bg-[var(--bg-panel-2)] text-[var(--text-muted)]",
      action: () => { navigate("/profile"); onClose(); },
    },
    {
      id: "settings", group: "Navigation", label: "Paramètres",
      icon: Settings, iconBg: "bg-[var(--bg-panel-2)] text-[var(--text-muted)]",
      action: () => { navigate("/settings"); onClose(); },
    },
    {
      id: "theme", group: "Actions",
      label: mode === "dark" ? "Passer en mode clair" : "Passer en mode sombre",
      icon: mode === "dark" ? Sun : Moon, iconBg: "bg-amber-50 text-amber-600",
      action: () => { toggleMode(); onClose(); },
    },
    {
      id: "logout", group: "Compte", label: "Se déconnecter",
      icon: LogOut, iconBg: "bg-rose-50 text-rose-600",
      action: () => { logout(); navigate("/login"); onClose(); },
    },
  ], [navigate, onClose, logout, toggleMode, mode, setCreateProjectModalOpen]);

  // Build project commands
  const projectCommands: CommandItem[] = useMemo(() =>
    projects.map((p) => ({
      id: `project-${p.id}`,
      group: "Projets",
      label: p.name,
      meta: p.status,
      icon: FolderKanban,
      iconBg: "bg-brand-50 text-brand-600",
      action: () => { navigate(projectPath(p)); onClose(); },
    })),
    [projects, navigate, onClose],
  );

  const allCommands = useMemo(() => [...staticCommands, ...projectCommands], [staticCommands, projectCommands]);

  // Filter by query
  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return allCommands;
    return allCommands.filter((c) =>
      c.label.toLowerCase().includes(q) ||
      c.group.toLowerCase().includes(q) ||
      (c.meta ?? "").toLowerCase().includes(q),
    );
  }, [allCommands, debouncedQuery]);

  // Group
  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    for (const item of filtered) {
      if (!map.has(item.group)) map.set(item.group, []);
      map.get(item.group)!.push(item);
    }
    return map;
  }, [filtered]);

  // Reset selected on filter change
  useEffect(() => { setSelected(0); }, [debouncedQuery]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((s) => Math.min(s + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((s) => Math.max(s - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        filtered[selected]?.action();
      } else if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, filtered, selected, onClose]);

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selected}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  if (!open) return null;

  let globalIndex = 0;

  return createPortal(
    <div className="cmd-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cmd-panel" role="dialog" aria-modal aria-label="Palette de commandes">
        {/* Search input */}
        <div className="relative flex items-center">
          <Search className="absolute left-4 h-5 w-5 text-[var(--text-muted)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher ou exécuter une commande…"
            className="cmd-input"
            autoComplete="off"
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-4 rounded p-1 text-[var(--text-muted)] hover:text-[var(--text-strong)]">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Results */}
        <div ref={listRef} className="cmd-results" role="listbox">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-[var(--text-muted)]">
              Aucun résultat pour « {debouncedQuery} »
            </div>
          ) : (
            Array.from(grouped.entries()).map(([group, items]) => (
              <div key={group}>
                <div className="cmd-section-label">{group}</div>
                {items.map((item) => {
                  const idx = globalIndex++;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      data-index={idx}
                      role="option"
                      aria-selected={selected === idx}
                      onMouseEnter={() => setSelected(idx)}
                      onClick={item.action}
                      className={cn(
                        "cmd-item w-full text-left",
                        selected === idx && "!bg-[var(--bg-panel-2)]",
                      )}
                    >
                      <div className={cn("cmd-item-icon", item.iconBg ?? "bg-[var(--bg-panel-3)] text-[var(--text-muted)]")}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="cmd-item-label truncate">{item.label}</div>
                        {item.meta && <div className="cmd-item-meta">{item.meta}</div>}
                      </div>
                      {item.shortcut && <kbd className="cmd-shortcut">{item.shortcut}</kbd>}
                      {selected === idx && <ArrowRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hints */}
        <div className="cmd-footer">
          <span className="cmd-hint"><kbd>↑↓</kbd> Naviguer</span>
          <span className="cmd-hint"><kbd>↵</kbd> Ouvrir</span>
          <span className="cmd-hint"><kbd>Esc</kbd> Fermer</span>
          <span className="ml-auto flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
            <Sparkles className="h-3 w-3" />MePO
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
