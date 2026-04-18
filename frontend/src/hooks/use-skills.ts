import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export interface ProjectSkillSettings {
  id: string | null;
  project_id: string;
  main_skill_text: string | null;
  general_directives_text: string | null;
  source_hierarchy_text: string | null;
  mode_policies_text: string | null;
  action_policies_text: string | null;
  output_templates_text: string | null;
  guardrails_text: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ProjectSkillSettingsUpdate {
  mainSkillText?: string | null;
  generalDirectivesText?: string | null;
  sourceHierarchyText?: string | null;
  modePoliciesText?: string | null;
  actionPoliciesText?: string | null;
  outputTemplatesText?: string | null;
  guardrailsText?: string | null;
}

export interface ProjectSkillRuntime {
  projectId: string;
  compiledRuntimeText: string;
  updatedAt: string | null;
}

export function useProjectSkillSettings(projectId: string | undefined) {
  return useQuery<ProjectSkillSettings>({
    queryKey: ["project-skills", projectId],
    queryFn: () => api.get<ProjectSkillSettings>(`/api/projects/${projectId}/skills/settings`),
    enabled: !!projectId,
  });
}

export function useSaveProjectSkillSettings(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProjectSkillSettingsUpdate) =>
      api.put<ProjectSkillSettings>(`/api/projects/${projectId}/skills/settings`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-skills", projectId] });
      qc.invalidateQueries({ queryKey: ["project-skill-runtime", projectId] });
    },
  });
}

export function useProjectSkillRuntime(projectId: string | undefined) {
  return useQuery<ProjectSkillRuntime>({
    queryKey: ["project-skill-runtime", projectId],
    queryFn: () => api.get<ProjectSkillRuntime>(`/api/projects/${projectId}/skills/runtime`),
    enabled: !!projectId,
  });
}
