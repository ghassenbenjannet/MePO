export type TicketStatus =
  | "Backlog"
  | "Todo"
  | "In Progress"
  | "Review"
  | "Done"
  | "Blocked";

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  lastActivity: string;
  metrics: {
    spaces: number;
    topics: number;
    tickets: number;
    documents: number;
  };
}

export interface Space {
  id: string;
  projectId: string;
  name: string;
  timeframe: string;
  status: "Planning" | "Active" | "Closed";
  progress: number;
  summary: string;
}

export interface Topic {
  id: string;
  spaceId: string;
  title: string;
  description: string;
  status: "active" | "done" | "blocked";
  priority: "low" | "medium" | "high" | "critical";
  owner: string;
}

export interface Ticket {
  id: string;
  topicId: string;
  title: string;
  type: "Epic" | "Feature" | "Bug" | "Task";
  status: TicketStatus;
  priority: "Low" | "Medium" | "High" | "Critical";
  topic: string;
  assignee: string;
  acceptance: string[];
}

export interface DocumentItem {
  id: string;
  topicId?: string;
  title: string;
  type: "Folder" | "Page";
  updatedAt: string;
}
