// ─── Domain types — aligned 1:1 with backend Pydantic schemas ────────────────

export interface Project {
  id: string;
  name: string;
  status: "active" | "planning" | "archived" | string;
  description: string | null;
  image_url?: string | null;
  created_at: string | null;
}

export interface ProjectCreate {
  name: string;
  status?: string;
  description?: string | null;
  image_url?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────

export interface Space {
  id: string;
  project_id: string;
  name: string;
  status: "active" | "planning" | "archived" | string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  is_favorite: boolean;
}

export interface SpaceCreate {
  project_id: string;
  name: string;
  status?: string;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  is_favorite?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────

export interface Topic {
  id: string;
  space_id: string;
  title: string;
  description: string | null;
  status: "active" | "done" | "blocked" | string;
  priority: "low" | "medium" | "high" | "critical" | string;
  topic_nature: "study" | "delivery" | "study_delivery" | string;
  color: string;
  roadmap_start_date: string | null;
  roadmap_end_date: string | null;
  owner: string | null;
  teams: string[];
  risks: string[];
  dependencies: string[];
  open_questions: string[];
  tags: string[];
  created_at: string | null;
  updated_at: string | null;
}

export interface TopicCreate {
  space_id: string;
  title: string;
  description?: string | null;
  status?: string;
  priority?: string;
  topic_nature?: string;
  color?: string | null;
  roadmap_start_date?: string | null;
  roadmap_end_date?: string | null;
  owner?: string | null;
  dependencies?: string[];
  tags?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────

export type TicketStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "review"
  | "done"
  | "blocked"
  | string;

export interface Ticket {
  id: string;
  topic_id: string;
  type: "feature" | "bug" | "task" | "analysis" | "test" | string;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: "low" | "medium" | "high" | "critical" | string;
  assignee: string | null;
  reporter: string | null;
  tags: string[];
  acceptance_criteria: string[];
  due_date: string | null;
  estimate: number | null;
  dependencies: string[];
  linked_document_ids: string[];
  ticket_details: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
}

export interface TicketCreate {
  topic_id: string;
  title: string;
  type?: string;
  description?: string | null;
  status?: string;
  priority?: string;
  assignee?: string | null;
  reporter?: string | null;
  due_date?: string | null;
  estimate?: number | null;
  dependencies?: string[];
  linked_document_ids?: string[];
  ticket_details?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────

export interface Document {
  id: string;
  space_id: string;
  topic_id: string | null;
  title: string;
  content: string;
  parent_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface DocumentCreate {
  space_id: string;
  topic_id?: string | null;
  title: string;
  content?: string;
  parent_id?: string | null;
}
