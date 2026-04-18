export type SourceLevel =
  | "mepo_objects"
  | "topic_memory"
  | "local_documents"
  | "knowledge_documents"
  | "vector_store";

export interface SourcePriorityItem {
  rank: number;
  level: SourceLevel;
  label: string;
}

export interface SourcePriorityPolicy {
  strict_order: true;
  items: SourcePriorityItem[];
}

export interface FeatureFlags {
  allow_raw_workspace_dump: false;
  allow_unplanned_document_search: false;
  allow_automatic_action_execution: false;
  allow_vector_store_auto_create: false;
  allow_full_space_prompt_injection: false;
}

export interface PromptRuntimeConfig {
  source_priority_policy: SourcePriorityPolicy;
  feature_flags: FeatureFlags;
  project_runtime_text: string | null;
}

export interface VectorStoreBinding {
  vector_store_id: string | null;
  last_sync_at: string | null;
  sync_status: "never" | "idle" | "running" | "success" | "partial" | "failed" | "error" | "ok";
}

export interface TicketSummary {
  ticketId: string;
  title: string;
  type: string;
  status: string;
  priority: string;
}

export interface MemoryEntry {
  section: string;
  content: string;
}

export interface DocumentRef {
  documentId: string;
  title: string;
  docType: string;
  topicId: string | null;
  spaceId: string | null;
  tags: string[];
  updatedAt: string | null;
}

export interface KnowledgeDocumentRef {
  knowledgeDocumentId: string;
  title: string;
  category: string;
  tags: string[];
  syncStatus: string;
  updatedAt: string | null;
}

export interface TestRepositoryRef {
  knowledgeDocumentId: string;
  title: string;
  updatedAt: string | null;
}

export interface DocumentRegistryEntry {
  sourceType: string;
  sourceId: string;
  title: string;
  category: string;
  priority: number;
  reliabilityScore: number;
}

export interface WorkspaceContext {
  projectContext: {
    id: string;
    name: string;
    status: string;
    description: string | null;
  };
  spaceContext: {
    id: string;
    name: string;
    status: string;
    description: string | null;
    start_date: string | null;
    end_date: string | null;
  } | null;
  activeTopic: {
    id: string;
    title: string;
    status: string;
    priority: string;
    topic_nature: string;
    description: string | null;
  } | null;
  topicTickets: TicketSummary[];
  topicMemory: MemoryEntry[];
  topicDocuments: DocumentRef[];
  spaceDocuments: DocumentRef[];
  knowledgeDocuments: KnowledgeDocumentRef[];
  testRepositories: TestRepositoryRef[];
  docRegistry: DocumentRegistryEntry[];
  vectorStoreBinding: VectorStoreBinding;
}

export interface RetrievalTraceStep {
  level: SourceLevel;
  used: boolean;
  reason: string;
  item_count: number;
}

export interface RetrievalTrace {
  mode: string;
  final_level: SourceLevel;
  vector_store_allowed: boolean;
  vector_store_used: boolean;
  steps: RetrievalTraceStep[];
}

export type ProposedActionContract =
  | "create_ticket"
  | "add_comment"
  | "create_document"
  | "update_memory"
  | "select_topic_then_create_ticket";

export interface ProjectKnowledgeConfig {
  skillDirectives: {
    runtimeSkillText: string;
    modePolicies: string;
    outputTemplates: string;
    actionPolicies: string;
  };
  knowledgeBase: {
    vectorStoreId: string | null;
    lastSyncAt: string | null;
    syncStatus: "never" | "ok" | "error" | "running";
    folders: {
      specifications: unknown[];
      importantNotes: unknown[];
      technical: unknown[];
      database: unknown[];
      testCases: unknown[];
      other: unknown[];
    };
  };
}
