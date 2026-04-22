import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export interface SkillEditorPayload {
  mainSkillText: string;
  generalDirectivesText: string;
  modePoliciesText: string;
  actionPoliciesText: string;
  outputTemplatesText: string;
  guardrailsText: string;
}

export interface ProjectSkillVersion {
  id: string;
  projectId: string;
  versionLabel: string;
  editorPayload: SkillEditorPayload;
  compiledContextText: string;
  sourceKind: string;
  createdAt: string;
  isActive: boolean;
}

export interface ActiveProjectSkill {
  projectId: string;
  activeSkillVersionId: string;
  version: ProjectSkillVersion;
}

export function useActiveProjectSkill(projectId: string | undefined) {
  return useQuery<ActiveProjectSkill>({
    queryKey: ["project-skills", projectId, "active"],
    queryFn: () => api.get<ActiveProjectSkill>(`/api/projects/${projectId}/skills/active`),
    enabled: !!projectId,
  });
}

export function useProjectSkillVersions(projectId: string | undefined) {
  return useQuery<ProjectSkillVersion[]>({
    queryKey: ["project-skills", projectId, "versions"],
    queryFn: () => api.get<ProjectSkillVersion[]>(`/api/projects/${projectId}/skills/versions`),
    enabled: !!projectId,
  });
}

export function useSaveActiveProjectSkill(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SkillEditorPayload) =>
      api.put<ActiveProjectSkill>(`/api/projects/${projectId}/skills/active`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-skills", projectId] });
    },
  });
}

export function useActivateProjectSkillVersion(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (versionId: string) =>
      api.post<ActiveProjectSkill>(`/api/projects/${projectId}/skills/versions/${versionId}/activate`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-skills", projectId] });
    },
  });
}

export function useSaveRawSkill(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rawText: string) =>
      api.put<ActiveProjectSkill>(`/api/projects/${projectId}/skills/raw`, { raw_text: rawText }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-skills", projectId] });
    },
  });
}

export function useApplySkillV2(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<ActiveProjectSkill>(`/api/projects/${projectId}/skills/apply-v2`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-skills", projectId] });
    },
  });
}
