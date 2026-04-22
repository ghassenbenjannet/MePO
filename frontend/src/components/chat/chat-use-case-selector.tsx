import {
  Bug,
  ClipboardCheck,
  FilePenLine,
  FolderTree,
  SearchCheck,
  ShieldQuestion,
} from "lucide-react";
import type { ComponentType } from "react";
import type { UseCase } from "../../pages/chat/chat-page";

const USE_CASES: Array<{
  id: UseCase;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  {
    id: "analyse",
    label: "Analyse",
    description: "Analyser un comportement, une architecture, un sujet ou un bogue.",
    icon: SearchCheck,
  },
  {
    id: "bogue",
    label: "Bogue",
    description: "Identifier, documenter et cadrer les impacts d'un bogue.",
    icon: Bug,
  },
  {
    id: "recette",
    label: "Recette",
    description: "Trouver, adapter ou creer un cas de test et sa justification.",
    icon: ClipboardCheck,
  },
  {
    id: "question_generale",
    label: "Question generale",
    description: "Repondre a une question metier justifiee par le corpus projet.",
    icon: ShieldQuestion,
  },
  {
    id: "redaction_besoin",
    label: "Redaction besoin",
    description: "Produire un besoin, un existant, une solution ou des tickets.",
    icon: FilePenLine,
  },
  {
    id: "structuration_sujet",
    label: "Structuration sujet",
    description: "Structurer un nouveau sujet avec topic, docs et tickets proposes.",
    icon: FolderTree,
  },
];

interface ChatUseCaseSelectorProps {
  onSelect: (useCase: UseCase) => void;
}

export function ChatUseCaseSelector({ onSelect }: ChatUseCaseSelectorProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-6 py-10">
      <div className="text-center">
        <h2 className="text-lg font-semibold text-slate-800">Quel est votre cas metier ?</h2>
        <p className="mt-1 text-sm text-slate-500">
          Selectionnez un cas explicite avant d'envoyer le premier message.
        </p>
      </div>
      <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {USE_CASES.map((useCase) => {
          const Icon = useCase.icon;
          return (
            <button
              key={useCase.id}
              type="button"
              onClick={() => onSelect(useCase.id)}
              className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:border-indigo-300 hover:shadow-md active:scale-[0.98]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-sm font-semibold text-slate-800">{useCase.label}</span>
              <span className="text-xs leading-snug text-slate-500">{useCase.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
