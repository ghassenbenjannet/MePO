export interface ChatStarterPrompt {
  id: string;
  label: string;
  description: string;
  prompt: string;
}

export interface ChatThreadState {
  total: number;
  loaded: number;
  hasMore: boolean;
  nextOffset: number | null;
}
