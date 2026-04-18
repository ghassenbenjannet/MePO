import { BookOpen, FolderKanban } from "lucide-react";
import { cn } from "../../lib/utils";

export type ProjectViewTab = "spaces" | "knowledge";

const PROJECT_TABS = [
  { id: "spaces" as ProjectViewTab, label: "Espaces de travail", icon: FolderKanban },
  { id: "knowledge" as ProjectViewTab, label: "Base de connaissance", icon: BookOpen },
];

export function ProjectTabs({
  activeTab,
  onChange,
}: {
  activeTab: ProjectViewTab;
  onChange: (tab: ProjectViewTab) => void;
}) {
  return (
    <div className="tabs-shell w-full">
      {PROJECT_TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn("tab-trigger", activeTab === id && "tab-trigger-active")}
        >
          <Icon className="h-[14px] w-[14px]" />
          {label}
        </button>
      ))}
    </div>
  );
}
