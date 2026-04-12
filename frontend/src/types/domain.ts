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
}

export interface Topic {
  id: string;
  title: string;
  status: "active" | "done" | "blocked";
  priority: "low" | "medium" | "high" | "critical";
}

export interface Ticket {
  id: string;
  title: string;
  type: "Epic" | "Feature" | "Bug" | "Task";
  status: TicketStatus;
  priority: "Low" | "Medium" | "High" | "Critical";
  topic: string;
}

export interface DocumentItem {
  id: string;
  title: string;
  type: "Folder" | "Page";
  updatedAt: string;
}
