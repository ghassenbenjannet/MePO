import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { ToastProvider } from "../ui/toast";
import { useThemeStore } from "../../stores/theme-store";
import { useKeyDown } from "../../lib/hooks";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { CommandPalette } from "./command-palette";
import { DesignTweaksPanel } from "./design-tweaks-panel";

const ACCENT_VARIANTS = {
  orange: {
    50: "#FFF2EC",
    100: "#FFE4D6",
    200: "#FFC7B5",
    300: "#FFA47C",
    400: "#FF7A43",
    500: "#FF5A1F",
    600: "#E04510",
    700: "#C23810",
    800: "#8A2606",
    900: "#5C1803",
  },
  blue: {
    50: "#ECF2FE",
    100: "#D2DEFB",
    200: "#AFC5F8",
    300: "#7DA7F2",
    400: "#4C83EE",
    500: "#2563EB",
    600: "#1D4ED8",
    700: "#1D3FAF",
    800: "#173078",
    900: "#10214C",
  },
  violet: {
    50: "#F3EEFE",
    100: "#E4D7FB",
    200: "#CDB5F7",
    300: "#AF8AF2",
    400: "#935DF0",
    500: "#7C3AED",
    600: "#6D28D9",
    700: "#581FAE",
    800: "#43167F",
    900: "#2C0F55",
  },
  magenta: {
    50: "#FCECF3",
    100: "#F7D2E3",
    200: "#F2A6C8",
    300: "#EA73AB",
    400: "#E2488D",
    500: "#DB2777",
    600: "#BE185D",
    700: "#98124A",
    800: "#700D37",
    900: "#4C0825",
  },
} as const;

function hexToRgb(value: string) {
  const normalized = value.replace("#", "");
  const sized = normalized.length === 3
    ? normalized.split("").map((char) => `${char}${char}`).join("")
    : normalized;

  const r = Number.parseInt(sized.slice(0, 2), 16);
  const g = Number.parseInt(sized.slice(2, 4), 16);
  const b = Number.parseInt(sized.slice(4, 6), 16);

  return `${r} ${g} ${b}`;
}

export function AppShell() {
  const mode = useThemeStore((s) => s.mode);
  const accentVariant = useThemeStore((s) => s.accentVariant);
  const densityMode = useThemeStore((s) => s.densityMode);
  const dashboardVariant = useThemeStore((s) => s.dashboardVariant);
  const kanbanVariant = useThemeStore((s) => s.kanbanVariant);
  const setLastVisitedPath = useThemeStore((s) => s.setLastVisitedPath);
  const location = useLocation();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [designTweaksOpen, setDesignTweaksOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", mode === "dark");
    document.documentElement.setAttribute("data-theme", mode);

    const accent = ACCENT_VARIANTS[accentVariant];
    const accentRgb = hexToRgb(accent[500]);
    const rootStyle = document.documentElement.style;
    const softSurface = mode === "dark" ? `rgba(${accentRgb}, 0.14)` : accent[100];
    const softSurfaceStrong = `rgba(${accentRgb}, ${mode === "dark" ? "0.18" : "0.12"})`;
    const softBorder = `rgba(${accentRgb}, ${mode === "dark" ? "0.24" : "0.22"})`;
    const sidebarActive = `rgba(${accentRgb}, ${mode === "dark" ? "0.12" : "0.08"})`;

    rootStyle.setProperty("--color-brand-50", accent[50]);
    rootStyle.setProperty("--color-brand-100", accent[100]);
    rootStyle.setProperty("--color-brand-200", accent[200]);
    rootStyle.setProperty("--color-brand-300", accent[300]);
    rootStyle.setProperty("--color-brand-400", accent[400]);
    rootStyle.setProperty("--color-brand-500", accent[500]);
    rootStyle.setProperty("--color-brand-600", accent[600]);
    rootStyle.setProperty("--color-brand-700", accent[700]);
    rootStyle.setProperty("--color-brand-800", accent[800]);
    rootStyle.setProperty("--color-brand-900", accent[900]);
    rootStyle.setProperty("--accent", accent[500]);
    rootStyle.setProperty("--accent-deep", accent[600]);
    rootStyle.setProperty("--accent-soft", softSurface);
    rootStyle.setProperty("--accent-ink", "#FFFFFF");
    rootStyle.setProperty("--brand", accent[500]);
    rootStyle.setProperty("--brand-hover", accent[600]);
    rootStyle.setProperty("--brand-pressed", accent[700]);
    rootStyle.setProperty("--brand-dark", accent[700]);
    rootStyle.setProperty("--brand-light", softSurface);
    rootStyle.setProperty("--brand-soft", sidebarActive);
    rootStyle.setProperty("--brand-soft-strong", softSurfaceStrong);
    rootStyle.setProperty("--brand-border-soft", softBorder);
    rootStyle.setProperty("--brand-rgb", accentRgb);
    rootStyle.setProperty("--sidebar-accent", accent[500]);
    rootStyle.setProperty("--bg-sidebar-active", sidebarActive);
    rootStyle.setProperty("--shadow-brand", `0 8px 20px rgba(${accentRgb}, ${mode === "dark" ? "0.18" : "0.18"})`);
    rootStyle.setProperty("--chat-code-border", `rgba(${accentRgb}, ${mode === "dark" ? "0.2" : "0.18"})`);

    document.body.classList.toggle("density-dense", densityMode === "dense");
    document.body.classList.toggle("dash-b", dashboardVariant === "b");
    document.body.classList.toggle("kanban-b", kanbanVariant === "b");
  }, [accentVariant, dashboardVariant, densityMode, kanbanVariant, mode]);

  useEffect(() => {
    setLastVisitedPath(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search, setLastVisitedPath]);

  useKeyDown("k", () => setCmdOpen(true), { ctrl: true });
  useKeyDown("k", () => setCmdOpen(true), { meta: true });

  return (
    <div className="flex min-h-screen bg-[var(--bg-body)] text-[var(--text)]">
      <Sidebar onOpenCommandPalette={() => setCmdOpen(true)} />

      <div className="flex min-w-0 flex-1 flex-col bg-[var(--bg-body)]">
        <Topbar
          onOpenCommandPalette={() => setCmdOpen(true)}
          onToggleDesignTweaks={() => setDesignTweaksOpen((current) => !current)}
        />

        <main className="min-h-0 flex-1 bg-[var(--bg-body)]">
          <div className="w-full px-6 pb-8 pt-6 xl:px-10 xl:pb-10 xl:pt-8">
            <Outlet />
          </div>
        </main>
      </div>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
      <DesignTweaksPanel open={designTweaksOpen} onClose={() => setDesignTweaksOpen(false)} />
      <ToastProvider />
    </div>
  );
}
