import { Outlet } from "react-router-dom";
import { RightDock } from "./right-dock";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell() {
  return (
    <div className="min-h-screen bg-app-surface text-ink">
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-h-screen flex-1 flex-col">
          <Topbar />
          <main className="flex-1 px-5 py-5 lg:px-8 lg:py-7">
            <Outlet />
          </main>
        </div>
        <RightDock />
      </div>
    </div>
  );
}
