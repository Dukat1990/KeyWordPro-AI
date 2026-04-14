
export type KeywordStatus = 'preliminary' | 'selected' | 'negative' | 'parsed' | 'trash';

export interface NegativeGroup {
  id: string;
  name: string;
}

export interface Keyword {
  id: string;
  text: string;
  status: KeywordStatus;
  isNegative?: boolean; 
  negativeGroupId?: string; // Reference to NegativeGroup
  groupId?: string;
  frequency?: number;
  exactFrequency?: number;
  aiSuggestedNegative?: boolean;
}

export interface Group {
  id: string;
  name: string;
  parentId?: string; 
}

export interface Project {
  id: string;
  name: string;
  theme: string;
  keywords: Keyword[];
  groups: Group[];
  negativeGroups: NegativeGroup[]; // New field
  createdAt: number;
}

export interface AppState {
  projects: Project[];
  currentProjectId: string | null;
}
