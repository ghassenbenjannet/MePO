import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { ToastProvider } from "../ui/toast";
import { useThemeStore } from "../../stores/theme-store";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell() {
  const mode = useThemeStore((s) => s.mode);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", mode === "dark");
  }, [mode]);

  return (
    <div className="flex min-h-screen bg-slate-50/60">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto px-5 py-6 lg:px-7 lg:py-8">
          <Outlet />
        </main>
      </div>
      <ToastProvider />
    </div>
  );
}
