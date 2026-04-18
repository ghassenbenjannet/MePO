type EntityRef = {
  id: string;
  name?: string | null;
  title?: string | null;
};

export type SpaceSuiviView = "overview" | "topics" | "kanban" | "tasks" | "backlog" | "roadmap";

const SPACE_SUIVI_VIEWS: SpaceSuiviView[] = ["overview", "topics", "kanban", "tasks", "backlog", "roadmap"];

export function normalizeSlugPart(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function buildEntitySlug(value: string | null | undefined, _id?: string) {
  const raw = (value?.trim() || "").replace(/--[^-]+$/, "");
  const base = normalizeSlugPart(raw) || "item";
  return base;
}

export function readEntityIdFromSlug(slug: string | undefined) {
  if (!slug) return undefined;
  const marker = slug.lastIndexOf("--");
  return marker >= 0 ? slug.slice(marker + 2) : undefined;
}

export function isLegacyEntitySlug(slug: string | undefined) {
  return !!slug && slug.includes("--");
}

function labelOf(entity: EntityRef) {
  return entity.name ?? entity.title ?? entity.id;
}

export function entitySlugOf(entity: EntityRef) {
  return buildEntitySlug(labelOf(entity), entity.id);
}

export function resolveEntityBySlug<T extends EntityRef>(entities: T[], slug: string | undefined) {
  if (!slug) return undefined;
  const legacyId = readEntityIdFromSlug(slug);
  if (legacyId) {
    const byId = entities.find((entity) => entity.id === legacyId);
    if (byId) return byId;
  }

  const normalized = normalizeSlugPart(slug.replace(/--[^-]+$/, ""));
  return entities.find((entity) => entitySlugOf(entity) === normalized);
}

export function projectPath(project: EntityRef) {
  return `/projects/${buildEntitySlug(labelOf(project), project.id)}`;
}

export function spaceOverviewPath(project: EntityRef, space: EntityRef) {
  return `/projects/${buildEntitySlug(labelOf(project), project.id)}/spaces/${buildEntitySlug(labelOf(space), space.id)}/suivi`;
}

export function isSpaceSuiviView(value: string | null | undefined): value is SpaceSuiviView {
  return !!value && SPACE_SUIVI_VIEWS.includes(value as SpaceSuiviView);
}

export function spaceSuiviPath(project: EntityRef, space: EntityRef, view: SpaceSuiviView = "overview") {
  const basePath = spaceOverviewPath(project, space);
  return view === "overview" ? basePath : `${basePath}?view=${view}`;
}

export function spaceDocumentsPath(project: EntityRef, space: EntityRef) {
  return `/projects/${buildEntitySlug(labelOf(project), project.id)}/spaces/${buildEntitySlug(labelOf(space), space.id)}/documents`;
}

export function spaceChatPath(project: EntityRef, space: EntityRef) {
  return `/projects/${buildEntitySlug(labelOf(project), project.id)}/spaces/${buildEntitySlug(labelOf(space), space.id)}/chat`;
}

export function topicPath(project: EntityRef, space: EntityRef, topic: EntityRef) {
  return `/projects/${buildEntitySlug(labelOf(project), project.id)}/spaces/${buildEntitySlug(labelOf(space), space.id)}/topics/${buildEntitySlug(labelOf(topic), topic.id)}`;
}
