import type { DocumentItem, Project, Space, Ticket, Topic } from "../types/domain";

export const projects: Project[] = [
  {
    id: "hcl-livret",
    name: "HCL - Livret",
    description: "Workspace PO pour le pilotage du livret, des sujets, des tickets et des documents.",
    color: "from-indigo-500 to-blue-500",
    icon: "HL",
    lastActivity: "Mise a jour il y a 2 heures",
    metrics: { spaces: 3, topics: 18, tickets: 146, documents: 39 },
  },
  {
    id: "retail-core",
    name: "Retail Core",
    description: "Pilotage produit transverse, backlog, analyses et documentation.",
    color: "from-emerald-500 to-teal-500",
    icon: "RC",
    lastActivity: "Mise a jour hier",
    metrics: { spaces: 2, topics: 11, tickets: 88, documents: 27 },
  },
];

export const spaces: Space[] = [
  {
    id: "s1-2026",
    projectId: "hcl-livret",
    name: "Semestre 1 2026",
    timeframe: "Janvier 2026 - Juin 2026",
    status: "Active",
    progress: 62,
    summary: "Hub principal de travail PO avec suivi, documents, sujets actifs et IA contextuelle.",
  },
  {
    id: "s2-2026",
    projectId: "hcl-livret",
    name: "Semestre 2 2026",
    timeframe: "Juillet 2026 - Decembre 2026",
    status: "Planning",
    progress: 34,
    summary: "Preparation du prochain horizon de delivery avec cadrage, priorisation et objectifs.",
  },
  {
    id: "s1-2027",
    projectId: "hcl-livret",
    name: "Semestre 1 2027",
    timeframe: "Janvier 2027 - Juin 2027",
    status: "Planning",
    progress: 8,
    summary: "Espace prospectif pour discovery, roadmap et sujets a fort impact metier.",
  },
];

export const topics: Topic[] = [
  {
    id: "multi-establishments",
    spaceId: "s1-2026",
    title: "Gestion multi-etablissements",
    description: "Sujet central de cadrage, impacts habilitations, parcours et non-regression.",
    status: "active",
    priority: "high",
    owner: "Meryem Ghass",
  },
  {
    id: "identity-sync",
    spaceId: "s1-2026",
    title: "Synchronisation des identites",
    description: "Stabilisation du mapping et du suivi des droits entre composants legacy.",
    status: "blocked",
    priority: "critical",
    owner: "Tech Lead",
  },
  {
    id: "statement-rules",
    spaceId: "s1-2026",
    title: "Regles de diffusion des releves",
    description: "Capitalisation des decisions de diffusion et impacts multi-equipes.",
    status: "done",
    priority: "medium",
    owner: "Business Analyst",
  },
];

export const tickets: Ticket[] = [
  {
    id: "LIV-101",
    topicId: "multi-establishments",
    title: "Ajouter la gestion des etablissements secondaires",
    type: "Feature",
    status: "In Progress",
    priority: "High",
    topic: "Gestion multi-etablissements",
    assignee: "Meryem",
    acceptance: ["Scenario principal valide", "Impact habilitations documente"],
  },
  {
    id: "LIV-102",
    topicId: "identity-sync",
    title: "Corriger le mapping des habilitations",
    type: "Bug",
    status: "Review",
    priority: "Critical",
    topic: "Synchronisation des identites",
    assignee: "Yassine",
    acceptance: ["Aucune regression sur les profils standards"],
  },
  {
    id: "LIV-103",
    topicId: "multi-establishments",
    title: "Formaliser les criteres d'acceptation en Gherkin",
    type: "Task",
    status: "Todo",
    priority: "Medium",
    topic: "Gestion multi-etablissements",
    assignee: "PO",
    acceptance: ["3 scenarios nominaux", "1 scenario de non-regression"],
  },
  {
    id: "LIV-104",
    topicId: "statement-rules",
    title: "Structurer l'epic de migration documentaire",
    type: "Epic",
    status: "Backlog",
    priority: "High",
    topic: "Regles de diffusion des releves",
    assignee: "Equipe Produit",
    acceptance: ["Perimetre de migration trace"],
  },
];

export const documents: DocumentItem[] = [
  { id: "doc-1", topicId: "multi-establishments", title: "Analyse d'impact multi-etablissements", type: "Page", updatedAt: "2026-04-10" },
  { id: "doc-2", topicId: "multi-establishments", title: "Recette fonctionnelle", type: "Page", updatedAt: "2026-04-09" },
  { id: "doc-3", title: "Specifications", type: "Folder", updatedAt: "2026-04-06" },
];
