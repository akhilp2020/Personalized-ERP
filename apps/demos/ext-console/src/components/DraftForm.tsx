import React, { useState } from 'react';
import { extensionApi } from '../services/api';

interface DraftFormProps {
  onDraftCreated: (draftId: string) => void;
}

export const DraftForm: React.FC<DraftFormProps> = ({ onDraftCreated }) => {
  const [formData, setFormData] = useState({
    tenantId: '',
    targetService: 'order-svc',
    extensionName: '',
    description: '',
    createdBy: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await extensionApi.createDraft({
        ...formData,
        schema: { type: 'object', properties: {} }, // Will be filled via Q&A
      });
      onDraftCreated(response.draft.id);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create draft');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="draft-form">
      <h2>Start New Extension</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Tenant ID</label>
          <input
            type="text"
            value={formData.tenantId}
            onChange={(e) => setFormData({ ...formData, tenantId: e.target.value })}
            placeholder="e.g., tenant1"
            required
          />
        </div>

        <div className="form-group">
          <label>Target Service</label>
          <select
            value={formData.targetService}
            onChange={(e) => setFormData({ ...formData, targetService: e.target.value })}
            required
          >
            <option value="order-svc">Order Service</option>
            <option value="inventory-svc">Inventory Service</option>
            <option value="customer-svc">Customer Service</option>
          </select>
        </div>

        <div className="form-group">
          <label>Extension Name</label>
          <input
            type="text"
            value={formData.extensionName}
            onChange={(e) => setFormData({ ...formData, extensionName: e.target.value })}
            placeholder="e.g., priority-handling"
            pattern="[a-z-]+"
            title="Use lowercase letters and hyphens only"
            required
          />
          <small>Use kebab-case (e.g., priority-handling)</small>
        </div>

        <div className="form-group">
          <label>Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe the purpose of this extension"
            rows={3}
            required
          />
        </div>

        <div className="form-group">
          <label>Created By</label>
          <input
            type="email"
            value={formData.createdBy}
            onChange={(e) => setFormData({ ...formData, createdBy: e.target.value })}
            placeholder="your.email@company.com"
            required
          />
        </div>

        {error && <div className="error">{error}</div>}

        <button type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Create Draft'}
        </button>
      </form>
    </div>
  );
};
