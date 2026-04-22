import { CheckCircle2, Loader2, Save, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  type SkillEditorPayload,
  useActivateProjectSkillVersion,
  useActiveProjectSkill,
  useProjectSkillVersions,
  useSaveActiveProjectSkill,
} from "../../hooks/use-skills";
import { Button } from "../ui/button";
import { SectionHeader } from "../ui/section-header";
import { StatusBadge } from "../ui/status-badge";
import { Surface, SurfaceContent, SurfaceHeader } from "../ui/surface";

const SKILL_FIELDS: Array<{
  key: keyof SkillEditorPayload;
  title: string;
  description: string;
  rows: number;
}> = [
  {
    key: "mainSkillText",
    title: "Contexte general",
    description: "Ce que l'IA doit savoir du projet avant tout use-case.",
    rows: 7,
  },
  {
    key: "generalDirectivesText",
    title: "Directives globales",
    description: "Ton, niveau de preuve, contraintes transverses et discipline de reponse.",
    rows: 5,
  },
  {
    key: "modePoliciesText",
    title: "Regles par use-case",
    description: "Attendus specifiques pour analyse, bogue, recette, question et structuration.",
    rows: 6,
  },
  {
    key: "actionPoliciesText",
    title: "Politiques d'actions",
    description: "Regles de proposition, confirmation et execution des actions MePO.",
    rows: 5,
  },
  {
    key: "outputTemplatesText",
    title: "Structures de sortie",
    description: "Formats cibles pour les notes, tickets, plans et syntheses.",
    rows: 5,
  },
  {
    key: "guardrailsText",
    title: "Garde-fous",
    description: "Interdits, prudence, anti-invention et limites de l'assistant.",
    rows: 5,
  },
];

function createEmptyPayload(): SkillEditorPayload {
  return {
    mainSkillText: "",
    generalDirectivesText: "",
    modePoliciesText: "",
    actionPoliciesText: "",
    outputTemplatesText: "",
    guardrailsText: "",
  };
}

export function ProjectSkillsSection({ projectId }: { projectId: string }) {
  const { data: activeSkill, isLoading } = useActiveProjectSkill(projectId);
  const { data: versions = [] } = useProjectSkillVersions(projectId);
  const { mutateAsync: saveActiveSkill, isPending: isSaving } = useSaveActiveProjectSkill(projectId);
  const { mutateAsync: activateVersion, isPending: isActivating } = useActivateProjectSkillVersion(projectId);
  const [form, setForm] = useState<SkillEditorPayload>(createEmptyPayload);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!activeSkill?.version?.editorPayload) {
      setForm(createEmptyPayload());
      return;
    }
    setForm(activeSkill.version.editorPayload);
  }, [activeSkill]);

  const filledBlocks = useMemo(
    () => Object.values(form).filter((value) => value.trim().length > 0).length,
    [form],
  );
  const totalCharacters = useMemo(
    () => Object.values(form).reduce((sum, value) => sum + value.trim().length, 0),
    [form],
  );

  async function handleSave() {
    setSaveMessage(null);
    setErrorMessage(null);
    try {
      await saveActiveSkill(form);
      setSaveMessage("Nouvelle version de skill enregistree et activee.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Impossible d'enregistrer le skill actif.",
      );
    }
  }

  async function handleActivate(versionId: string) {
    setSaveMessage(null);
    setErrorMessage(null);
    try {
      await activateVersion(versionId);
      setSaveMessage("Version active mise a jour.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Impossible d'activer cette version.",
      );
    }
  }

  if (isLoading) {
    return (
      <Surface tone="muted" className="px-5 py-8">
        <div className="flex items-center justify-center gap-2 text-sm text-[var(--text-muted)]">
          <Loader2 className="h-5 w-5 animate-spin" />
          Chargement du skill projet...
        </div>
      </Surface>
    );
  }

  return (
    <section className="space-y-5">
      <SectionHeader
        eyebrow="Skill"
        title="Contexte IA du projet"
        description="Le skill reste dans MePO, versionne le contexte stable du projet et compile un context pack compact pour le runtime."
        actions={(
          <>
            <StatusBadge tone="brand">{filledBlocks}/{SKILL_FIELDS.length} blocs</StatusBadge>
            <StatusBadge tone="neutral">{versions.length} version{versions.length > 1 ? "s" : ""}</StatusBadge>
          </>
        )}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_360px]">
        <div className="space-y-4">
          {SKILL_FIELDS.map((field) => (
            <Surface key={field.key} className="overflow-hidden">
              <SurfaceHeader className="pb-0">
                <div className="min-w-0">
                  <p className="panel-eyebrow">Bloc editeur</p>
                  <h3 className="mt-2 text-base font-semibold tracking-[-0.02em] text-[var(--text-strong)]">
                    {field.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                    {field.description}
                  </p>
                </div>
              </SurfaceHeader>

              <SurfaceContent className="pt-4">
                <textarea
                  value={form[field.key]}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, [field.key]: event.target.value }))
                  }
                  rows={field.rows}
                  className="input min-h-[164px] resize-y leading-7"
                  placeholder={`Renseigne ici le bloc "${field.title}".`}
                />
              </SurfaceContent>
            </Surface>
          ))}

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
                  <p className="panel-eyebrow">Version active</p>
                  <h3 className="mt-2 text-base font-semibold tracking-[-0.02em] text-[var(--text-strong)]">
                    {activeSkill?.version.versionLabel ?? "Aucune version"}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                    Le runtime chat lit uniquement cette version depuis MePO.
                  </p>
                </div>
                <StatusBadge tone="success">Active</StatusBadge>
              </SurfaceHeader>

              <SurfaceContent className="pt-4">
                <div className="grid gap-3">
                  <div className="rounded-[18px] border border-[var(--border)] bg-[var(--bg-panel)] px-4 py-3 shadow-[var(--shadow-xs)]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-xmuted)]">
                      Couverture
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[var(--text-strong)]">
                      {filledBlocks}/{SKILL_FIELDS.length} blocs
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                      {totalCharacters.toLocaleString("fr-FR")} caracteres utiles.
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() => void handleSave()}
                  disabled={isSaving}
                  className="mt-4 w-full"
                  leadingIcon={isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                >
                  {isSaving ? "Enregistrement..." : "Creer une nouvelle version active"}
                </Button>
              </SurfaceContent>
            </Surface>

            <Surface tone="muted" className="overflow-hidden">
              <SurfaceHeader className="pb-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[var(--brand-dark)]">
                    <Sparkles className="h-4 w-4" />
                    <p className="text-sm font-semibold text-[var(--text-strong)]">
                      Context pack compile
                    </p>
                  </div>
                </div>
              </SurfaceHeader>

              <SurfaceContent className="pt-4">
                <pre className="max-h-[280px] overflow-auto rounded-[18px] border border-[var(--chat-code-border)] bg-[var(--chat-code-bg)] p-4 font-mono text-[11px] leading-6 text-[var(--chat-code-text)]">
                  {activeSkill?.version.compiledContextText || "Aucun context pack compile pour le moment."}
                </pre>
              </SurfaceContent>
            </Surface>

            <Surface tone="muted" className="overflow-hidden">
              <SurfaceHeader className="pb-0">
                <div className="min-w-0">
                  <p className="panel-eyebrow">Historique</p>
                  <h3 className="mt-2 text-base font-semibold tracking-[-0.02em] text-[var(--text-strong)]">
                    Versions precedentes
                  </h3>
                </div>
              </SurfaceHeader>
              <SurfaceContent className="pt-4">
                <div className="space-y-3">
                  {versions.map((version) => (
                    <div
                      key={version.id}
                      className="rounded-[18px] border border-[var(--border)] bg-[var(--bg-panel)] px-4 py-3 shadow-[var(--shadow-xs)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[var(--text-strong)]">
                            {version.versionLabel}
                          </p>
                          <p className="mt-1 text-xs text-[var(--text-muted)]">
                            {new Date(version.createdAt).toLocaleString("fr-FR")}
                          </p>
                        </div>
                        {version.isActive ? (
                          <StatusBadge tone="success">Active</StatusBadge>
                        ) : (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={isActivating}
                            onClick={() => void handleActivate(version.id)}
                            leadingIcon={isActivating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                          >
                            Activer
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </SurfaceContent>
            </Surface>
          </div>
        </aside>
      </div>
    </section>
  );
}
