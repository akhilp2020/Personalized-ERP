export interface ExtensionDraft {
  id: string;
  tenantId: string;
  targetService: string;
  extensionName: string;
  description: string;
  schema: any;
  status: 'draft' | 'validated' | 'testing' | 'approved' | 'rejected' | 'deployed' | 'rolled_back';
  featureFlag: string;
  validationResults: ValidationResults | null;
  testResults: TestResults | null;
  impactReport: ImpactReport | null;
  migrations: Migration[];
  generatedArtifacts: GeneratedArtifacts;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  approvedBy: string | null;
  deployedAt: string | null;
}

export interface ValidationResults {
  contract: {
    compatible: boolean;
    violations: string[];
  };
  storage: {
    tables: Array<{
      table: string;
      hasExtensions: boolean;
    }>;
    needsMigration: boolean;
  };
}

export interface TestResults {
  passed: boolean;
  results: any;
  logs: string;
  error: string | null;
}

export interface ImpactReport {
  service: string;
  extension: string;
  backwardCompatible: boolean;
  violations: string[];
  affectedEndpoints: string[];
  affectedEvents: string[];
  summary: string;
}

export interface Migration {
  filename: string;
  content: string;
  affectedTables: string[];
}

export interface GeneratedArtifacts {
  ajvValidator?: string;
  zodValidator?: string;
  uiFragment?: string;
  test?: string;
  kgUpdate?: string;
  changeMapUpdate?: string;
}

export interface QAQuestion {
  question: string;
  fieldName: string;
  type: 'text' | 'select' | 'multiselect' | 'boolean';
  options?: string[];
}

export interface QASession {
  draftId: string;
  questions: QAQuestion[];
  answers: Record<string, any>;
}

export interface ChatMessage {
  role: 'assistant' | 'user' | 'system';
  text: string;
  timestamp: Date;
}

export interface ChatResponse {
  draftId: string | null;
  messages: Array<{ role: string; text: string }>;
  status: string;
  plan?: ExtensionPlan;
  impactReport?: ImpactReport;
}

export interface ExtensionPlan {
  storage: {
    scope: string;
    tables: string[];
    migrations: string[];
  };
  api: {
    changes: string;
    endpoints: Array<{ method: string; path: string }>;
  };
  ui: {
    fragments: string;
  };
  tests: {
    packs: string[];
  };
  docs: {
    files: string[];
  };
}
