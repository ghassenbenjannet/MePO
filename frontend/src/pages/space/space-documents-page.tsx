import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DocumentsTab } from "../../components/documents/documents-tab";
import { useProjects } from "../../hooks/use-projects";
import { useSpaces } from "../../hooks/use-spaces";
import { useTopics } from "../../hooks/use-topics";
import { isLegacyEntitySlug, resolveEntityBySlug, spaceDocumentsPath } from "../../lib/routes";

export function SpaceDocumentsPage() {
  const navigate = useNavigate();
  const { projectSlug, spaceSlug } = useParams<{ projectSlug: string; spaceSlug: string }>();
  const { data: projects = [] } = useProjects();
  const project = resolveEntityBySlug(projects, projectSlug);
  const projectId = project?.id;
  const { data: spaces = [] } = useSpaces(projectId);
  const space = resolveEntityBySlug(spaces, spaceSlug);
  const spaceId = space?.id;
  const { data: topics = [] } = useTopics(spaceId);

  const projectRef = { id: projectId ?? "", name: project?.name ?? projectSlug ?? "" };
  const spaceRef = { id: spaceId ?? "", name: space?.name ?? spaceSlug ?? "" };

  useEffect(() => {
    if (!projectId || !spaceId) return;
    if (!isLegacyEntitySlug(projectSlug) && !isLegacyEntitySlug(spaceSlug)) return;
    navigate(spaceDocumentsPath(projectRef, spaceRef), { replace: true });
  }, [navigate, projectId, projectRef, projectSlug, spaceId, spaceRef, spaceSlug]);

  return spaceId ? <DocumentsTab spaceId={spaceId} topics={topics} /> : null;
}
