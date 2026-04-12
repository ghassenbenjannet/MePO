import type { DocumentItem, Project, Space, Ticket, Topic } from "../types/domain";

export const projects: Project[] = [
  {
    id: "hcl-livret",
    name: "HCL - Livret",
    description: "Migration product ops for a multi-team banking initiative.",
    color: "from-indigo-500 to-blue-500",
    icon: "HL",
    metrics: { spaces: 3, topics: 18, tickets: 146, documents: 39 },
  },
  {
    id: "retail-core",
    name: "Retail Core",
    description: "Core product streams, release planning, and architecture follow-up.",
    color: "from-emerald-500 to-teal-500",
    icon: "RC",
    metrics: { spaces: 2, topics: 11, tickets: 88, documents: 27 },
  },
];

export const spaces: Space[] = [
  {
    id: "s1-2026",
    projectId: "hcl-livret",
    name: "S1 2026",
    timeframe: "Jan 2026 - Jun 2026",
    status: "Active",
    progress: 62,
  },
  {
    id: "release-2026-1",
    projectId: "hcl-livret",
    name: "Release 2026.1",
    timeframe: "Mar 2026 - Apr 2026",
    status: "Planning",
    progress: 34,
  },
];

export const topics: Topic[] = [
  { id: "multi-establishments", title: "Gestion multi-etablissements", status: "active", priority: "high" },
  { id: "identity-sync", title: "Synchronisation des identites", status: "blocked", priority: "critical" },
  { id: "statement-rules", title: "Regles de diffusion des releves", status: "done", priority: "medium" },
];

export const tickets: Ticket[] = [
  {
    id: "LIV-101",
    title: "Ajouter la gestion des etablissements secondaires",
    type: "Feature",
    status: "In Progress",
    priority: "High",
    topic: "Gestion multi-etablissements",
  },
  {
    id: "LIV-102",
    title: "Corriger le mapping des habilitations",
    type: "Bug",
    status: "Review",
    priority: "Critical",
    topic: "Synchronisation des identites",
  },
  {
    id: "LIV-103",
    title: "Formaliser les criteres d'acceptation en Gherkin",
    type: "Task",
    status: "Todo",
    priority: "Medium",
    topic: "Gestion multi-etablissements",
  },
  {
    id: "LIV-104",
    title: "Structurer l'epic de migration documentaire",
    type: "Epic",
    status: "Backlog",
    priority: "High",
    topic: "Regles de diffusion des releves",
  },
];

export const documents: DocumentItem[] = [
  { id: "doc-1", title: "Analyse d'impact multi-etablissements", type: "Page", updatedAt: "2026-04-10" },
  { id: "doc-2", title: "Recette fonctionnelle", type: "Page", updatedAt: "2026-04-09" },
  { id: "doc-3", title: "Specifications", type: "Folder", updatedAt: "2026-04-06" },
];
