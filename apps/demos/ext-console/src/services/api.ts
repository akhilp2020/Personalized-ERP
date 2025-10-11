import axios from 'axios';
import type { ExtensionDraft, QAQuestion, ChatResponse } from '../types';

const EXT_API_BASE = import.meta.env.VITE_EXT_API_BASE || '/api';

const api = axios.create({
  baseURL: EXT_API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const extensionApi = {
  // List all drafts
  listDrafts: async (): Promise<{ drafts: ExtensionDraft[] }> => {
    const { data } = await api.get('/extensions/drafts');
    return data;
  },

  // Get specific draft
  getDraft: async (id: string): Promise<{ draft: ExtensionDraft }> => {
    const { data } = await api.get(`/extensions/drafts/${id}`);
    return data;
  },

  // Create draft
  createDraft: async (payload: {
    tenantId: string;
    targetService: string;
    extensionName: string;
    description: string;
    schema: any;
    createdBy: string;
  }): Promise<{ draft: ExtensionDraft }> => {
    const { data } = await api.post('/extensions/drafts', payload);
    return data;
  },

  // Validate draft
  validate: async (id: string): Promise<{ draft: ExtensionDraft; validation: any; impactReport: any; migrations: any[] }> => {
    const { data } = await api.post(`/extensions/drafts/${id}/validate`);
    return data;
  },

  // Generate artifacts
  generate: async (id: string): Promise<{ draft: ExtensionDraft; artifacts: any }> => {
    const { data } = await api.post(`/extensions/drafts/${id}/generate`);
    return data;
  },

  // Run tests
  test: async (id: string): Promise<{ draft: ExtensionDraft; testResults: any }> => {
    const { data } = await api.post(`/extensions/drafts/${id}/test`);
    return data;
  },

  // Approve draft
  approve: async (id: string, approvedBy: string): Promise<{ draft: ExtensionDraft }> => {
    const { data } = await api.post(`/extensions/drafts/${id}/approve`, { approvedBy });
    return data;
  },

  // Deploy draft
  deploy: async (id: string): Promise<{ draft: ExtensionDraft }> => {
    const { data } = await api.post(`/extensions/drafts/${id}/deploy`);
    return data;
  },

  // Rollback draft
  rollback: async (id: string): Promise<{ draft: ExtensionDraft }> => {
    const { data } = await api.post(`/extensions/drafts/${id}/rollback`);
    return data;
  },

  // Get Q&A questions
  getQA: async (draftId: string): Promise<{ questions: QAQuestion[] }> => {
    const { data } = await api.get(`/extensions/qa/${draftId}`);
    return data;
  },

  // Chat message
  sendChatMessage: async (payload: {
    tenant: string;
    text: string;
    draftId?: string | null;
  }): Promise<ChatResponse> => {
    const { data } = await api.post('/chat/message', payload);
    return data;
  },
};
