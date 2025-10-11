import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown, Rocket, RotateCcw } from 'lucide-react';
import { extensionApi } from '../services/api';
import type { ExtensionDraft } from '../types';

interface ApprovalPanelProps {
  draft: ExtensionDraft;
  onStatusChange: (draft: ExtensionDraft) => void;
}

export const ApprovalPanel: React.FC<ApprovalPanelProps> = ({ draft, onStatusChange }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approver, setApprover] = useState('');

  const handleApprove = async () => {
    if (!approver) {
      setError('Please enter approver email');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await extensionApi.approve(draft.id, approver);
      onStatusChange(response.draft);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Approval failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDeploy = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await extensionApi.deploy(draft.id);
      onStatusChange(response.draft);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Deployment failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async () => {
    if (!confirm('Are you sure you want to rollback this extension?')) return;

    setLoading(true);
    setError(null);

    try {
      const response = await extensionApi.rollback(draft.id);
      onStatusChange(response.draft);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Rollback failed');
    } finally {
      setLoading(false);
    }
  };

  const canApprove = draft.status === 'testing' && draft.testResults?.passed;
  const canDeploy = draft.status === 'approved';
  const canRollback = draft.status === 'deployed';

  return (
    <div className="approval-panel">
      <h3>Approval & Deployment</h3>

      <div className="status-badge">
        <span className={`badge ${draft.status}`}>{draft.status.toUpperCase()}</span>
      </div>

      {canApprove && (
        <div className="approval-form">
          <h4>Approve Extension</h4>
          <div className="form-group">
            <label>Approver Email</label>
            <input
              type="email"
              value={approver}
              onChange={(e) => setApprover(e.target.value)}
              placeholder="manager@company.com"
            />
          </div>
          <button onClick={handleApprove} disabled={loading} className="btn-approve">
            <ThumbsUp size={16} /> Approve
          </button>
        </div>
      )}

      {canDeploy && (
        <div className="deployment-actions">
          <h4>Ready to Deploy</h4>
          <p>Extension has been approved and is ready for deployment.</p>
          <div className="deploy-checklist">
            <label>
              <input type="checkbox" /> Migration applied to database
            </label>
            <label>
              <input type="checkbox" /> Feature flag configured
            </label>
            <label>
              <input type="checkbox" /> Deployment plan reviewed
            </label>
          </div>
          <button onClick={handleDeploy} disabled={loading} className="btn-deploy">
            <Rocket size={16} /> Deploy Extension
          </button>
        </div>
      )}

      {canRollback && (
        <div className="rollback-actions">
          <h4>Extension Deployed</h4>
          <div className="deployment-info">
            <div><strong>Deployed:</strong> {new Date(draft.deployedAt!).toLocaleString()}</div>
            <div><strong>Feature Flag:</strong> {draft.featureFlag}</div>
            <div><strong>Approved By:</strong> {draft.approvedBy}</div>
          </div>
          <button onClick={handleRollback} disabled={loading} className="btn-rollback">
            <RotateCcw size={16} /> Rollback
          </button>
        </div>
      )}

      {draft.status === 'rejected' && (
        <div className="rejected-notice">
          <ThumbsDown />
          <p>Extension was rejected. Review validation errors and create a new draft.</p>
        </div>
      )}

      {error && <div className="error">{error}</div>}
    </div>
  );
};
