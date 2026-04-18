import { CheckCircle2, FileCode2, Loader2, Save, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  useProjectSkillRuntime,
  useProjectSkillSettings,
  useSaveProjectSkillSettings,
} from "../../hooks/use-skills";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { SectionHeader } from "../ui/section-header";
import { StatusBadge } from "../ui/status-badge";
import { Surface, SurfaceContent, SurfaceHeader } from "../ui/surface";

const SKILL_FIELDS: Array<{
  key:
    | "mainSkillText"
    | "generalDirectivesText"
    | "sourceHierarchyText"
    | "modePoliciesText"
    | "actionPoliciesText"
    | "outputTemplatesText"
    | "guardrailsText";
  title: string;
  description: string;
  rows: number;
}> = [
  {
    key: "mainSkillText",
    title: "Skill principal projet",
    description: "Regles metier principales utilisees par l'assistant du projet.",
    rows: 8,
  },
  {
    key: "generalDirectivesText",
    title: "Directives generales",
    description: "Ton, discipline de reponse, conventions d'ecriture et attentes generales.",
    rows: 6,
  },
  {
    key: "sourceHierarchyText",
    title: "Hierarchie des sources",
    description: "Notes projet sur l'ordre des sources sans renverser la politique codee en dur.",
    rows: 6,
  },
  {
    key: "modePoliciesText",
    title: "Politiques de modes metier",
    description: "Regles de routage entre analyse, ticket, documentation, pilotage et memoire.",
    rows: 6,
  },
  {
    key: "actionPoliciesText",
    title: "Politiques d'actions",
    description: "Regles sur les actions proposees, les confirmations obligatoires et les garde-fous.",
    rows: 6,
  },
  {
    key: "outputTemplatesText",
    title: "Templates de sortie",
    description: "Formats attendus pour les fiches, syntheses, analyses et plans de recette.",
    rows: 6,
  },
  {
    key: "guardrailsText",
    title: "Garde-fous et contraintes",
    description: "Anti-invention, limites, interdits et regles de prudence supplementaires.",
    rows: 6,
  },
];

type FormState = Record<(typeof SKILL_FIELDS)[number]["key"], string>;

function createEmptyForm(): FormState {
  return {
    mainSkillText: "",
    generalDirectivesText: "",
    sourceHierarchyText: "",
    modePoliciesText: "",
    actionPoliciesText: "",
    outputTemplatesText: "",
    guardrailsText: "",
  };
}

function RuntimeMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-[18px] border border-[var(--border)] bg-[var(--bg-panel)] px-4 py-3 shadow-[var(--shadow-xs)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-xmuted)]">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-[var(--text-strong)]">{value}</p>
      {hint ? <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{hint}</p> : null}
    </div>
  );
}

export function ProjectSkillsSection({ projectId }: { projectId: string }) {
  const { data: settings, isLoading } = useProjectSkillSettings(projectId);
  const { data: runtime } = useProjectSkillRuntime(projectId);
  const { mutateAsync: saveSettings, isPending } = useSaveProjectSkillSettings(projectId);
  const [form, setForm] = useState<FormState>(createEmptyForm);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setForm({
      mainSkillText: settings?.main_skill_text ?? "",
      generalDirectivesText: settings?.general_directives_text ?? "",
      sourceHierarchyText: settings?.source_hierarchy_text ?? "",
      modePoliciesText: settings?.mode_policies_text ?? "",
      actionPoliciesText: settings?.action_policies_text ?? "",
      outputTemplatesText: settings?.output_templates_text ?? "",
      guardrailsText: settings?.guardrails_text ?? "",
    });
  }, [settings]);

  const filledBlocks = useMemo(
    () => Object.values(form).filter((value) => value.trim().length > 0).length,
    [form],
  );
  const totalCharacters = useMemo(
    () => Object.values(form).reduce((sum, value) => sum + value.trim().length, 0),
    [form],
  );
  const compiledRuntime = runtime?.compiledRuntimeText?.trim() ?? "";
  const updatedAtLabel = runtime?.updatedAt
    ? new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(runtime.updatedAt))
    : "Jamais";

  async function handleSave() {
    setSaveMessage(null);
    setErrorMessage(null);
    try {
      await saveSettings({
        mainSkillText: form.mainSkillText.trim() || null,
        generalDirectivesText: form.generalDirectivesText.trim() || null,
        sourceHierarchyText: form.sourceHierarchyText.trim() || null,
        modePoliciesText: form.modePoliciesText.trim() || null,
        actionPoliciesText: form.actionPoliciesText.trim() || null,
        outputTemplatesText: form.outputTemplatesText.trim() || null,
        guardrailsText: form.guardrailsText.trim() || null,
      });
      setSaveMessage("Skills et directives enregistres localement.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible d'enregistrer les skills du projet.",
      );
    }
  }

  if (isLoading) {
    return (
      <Surface tone="muted" className="px-5 py-8">
        <div className="flex items-center justify-center gap-2 text-sm text-[var(--text-muted)]">
          <Loader2 className="h-5 w-5 animate-spin" />
          Chargement des skills...
        </div>
      </Surface>
    );
  }

  return (
    <section className="space-y-5">
      <SectionHeader
        eyebrow="Knowledge"
        title="Skills et directives"
        description="Parametres locaux utilises par l'assistant du projet. Ces blocs restent dans MePO et ne sont jamais synchronises vers OpenAI."
        actions={(
          <>
            <StatusBadge tone="brand">{filledBlocks} blocs renseignes</StatusBadge>
            <StatusBadge tone="neutral">Local uniquement</StatusBadge>
          </>
        )}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_360px]">
        <div className="space-y-4">
          {SKILL_FIELDS.map((field) => {
            const value = form[field.key];
            const hasValue = value.trim().length > 0;

            return (
              <Surface key={field.key} className="overflow-hidden">
                <SurfaceHeader className="pb-0">
                  <div className="min-w-0">
                    <p className="panel-eyebrow">Bloc de consignes</p>
                    <h3 className="mt-2 text-base font-semibold tracking-[-0.02em] text-[var(--text-strong)]">
                      {field.title}
                    </h3>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
                      {field.description}
                    </p>
                  </div>
                  <StatusBadge tone={hasValue ? "success" : "neutral"}>
                    {hasValue ? "Renseigne" : "Vide"}
                  </StatusBadge>
                </SurfaceHeader>

                <SurfaceContent className="pt-4">
                  <textarea
                    value={value}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, [field.key]: event.target.value }))
                    }
                    rows={field.rows}
                    className={cn(
                      "input min-h-[164px] resize-y leading-7",
                      field.rows >= 8 && "min-h-[220px]",
                    )}
                    placeholder={`Renseigne ici le bloc "${field.title}".`}
                  />
                </SurfaceContent>
              </Surface>
            );
          })}

          {errorMessage ? (
            <div className="rounded-[18px] border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-[var(--danger)]">
              {errorMessage}
            </div>
          ) : null}

          {saveMessage ? (
            <div className="rounded-[18px] border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-[#5D9B6D]">
              {saveMessage}
            </div>
          ) : null}
        </div>

        <aside className="space-y-4">
          <div className="sticky top-24 space-y-4">
            <Surface tone="strong" className="overflow-hidden">
              <SurfaceHeader className="pb-0">
                <div className="min-w-0">
                  <p className="panel-eyebrow">Runtime</p>
                  <h3 className="mt-2 text-base font-semibold tracking-[-0.02em] text-[var(--text-strong)]">
                    Vue compilee
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                    Ce panneau regroupe l'etat du runtime local et la commande d'enregistrement.
                  </p>
                </div>
                <StatusBadge tone={compiledRuntime ? "success" : "neutral"}>
                  {compiledRuntime ? "Pret" : "A completer"}
                </StatusBadge>
              </SurfaceHeader>

              <SurfaceContent className="pt-4">
                <div className="grid gap-3">
                  <RuntimeMetric
                    label="Derniere mise a jour"
                    value={updatedAtLabel}
                    hint="Date de compilation locale du runtime projet."
                  />
                  <RuntimeMetric
                    label="Couverture"
                    value={`${filledBlocks}/${SKILL_FIELDS.length} blocs`}
                    hint={`${totalCharacters.toLocaleString("fr-FR")} caracteres utiles.`}
                  />
                  <RuntimeMetric
                    label="Sync OpenAI"
                    value="Desactivee"
                    hint="Cette vue reste locale au projet."
                  />
                </div>

                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() => void handleSave()}
                  disabled={isPending}
                  className="mt-4 w-full"
                  leadingIcon={isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                >
                  {isPending ? "Enregistrement..." : "Enregistrer les directives"}
                </Button>
              </SurfaceContent>
            </Surface>

            <Surface tone="muted" className="overflow-hidden">
              <SurfaceHeader className="pb-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[var(--brand-dark)]">
                    <FileCode2 className="h-4 w-4" />
                    <p className="text-sm font-semibold text-[var(--text-strong)]">
                      Previsualisation runtime
                    </p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                    Version compilee transmise au moteur une fois les directives enregistrees.
                  </p>
                </div>
              </SurfaceHeader>

              <SurfaceContent className="pt-4">
                <pre className="max-h-[420px] overflow-auto rounded-[18px] border border-[var(--chat-code-border)] bg-[var(--chat-code-bg)] p-4 font-mono text-[11px] leading-6 text-[var(--chat-code-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                  {compiledRuntime || "Aucune configuration runtime compilee pour ce projet."}
                </pre>

                <div className="mt-4 flex items-start gap-3 rounded-[18px] border border-[var(--border)] bg-[var(--bg-panel-3)] px-4 py-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--brand-dark)]" />
                  <p className="text-xs leading-6 text-[var(--text-muted)]">
                    Les directives locales completent les regles systeme existantes. Elles ne changent ni la priorite de sources ni la politique d'execution globale.
                  </p>
                </div>
              </SurfaceContent>
            </Surface>
          </div>
        </aside>
      </div>
    </section>
  );
}
