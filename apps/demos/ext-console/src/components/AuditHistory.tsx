import React, { useState, useEffect } from 'react';
import { History, Filter } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { extensionApi } from '../services/api';
import type { ExtensionDraft } from '../types';

interface AuditHistoryProps {
  tenantId?: string;
}

export const AuditHistory: React.FC<AuditHistoryProps> = ({ tenantId }) => {
  const [drafts, setDrafts] = useState<ExtensionDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    loadDrafts();
  }, [tenantId]);

  const loadDrafts = async () => {
    try {
      const response = await extensionApi.listDrafts();
      let filtered = response.drafts || [];

      if (tenantId) {
        filtered = filtered.filter(d => d.tenantId === tenantId);
      }

      setDrafts(filtered);
    } catch (err) {
      console.error('Failed to load drafts:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredDrafts = filterStatus === 'all'
    ? drafts
    : drafts.filter(d => d.status === filterStatus);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'gray',
      validated: 'blue',
      testing: 'yellow',
      approved: 'green',
      rejected: 'red',
      deployed: 'purple',
      rolled_back: 'orange'
    };
    return colors[status] || 'gray';
  };

  return (
    <div className="audit-history">
      <div className="header">
        <h2>
          <History size={24} />
          Audit History
          {tenantId && <span className="tenant-badge">{tenantId}</span>}
        </h2>

        <div className="filters">
          <Filter size={16} />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="validated">Validated</option>
            <option value="testing">Testing</option>
            <option value="approved">Approved</option>
            <option value="deployed">Deployed</option>
            <option value="rejected">Rejected</option>
            <option value="rolled_back">Rolled Back</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading history...</div>
      ) : (
        <div className="timeline">
          {filteredDrafts.length === 0 ? (
            <div className="empty">No extensions found</div>
          ) : (
            filteredDrafts.map((draft) => (
              <div key={draft.id} className="timeline-item">
                <div className={`timeline-marker ${getStatusColor(draft.status)}`} />
                <div className="timeline-content">
                  <div className="timeline-header">
                    <h4>{draft.extensionName}</h4>
                    <span className={`badge ${draft.status}`}>{draft.status}</span>
                  </div>

                  <div className="timeline-meta">
                    <div><strong>Service:</strong> {draft.targetService}</div>
                    <div><strong>Tenant:</strong> {draft.tenantId}</div>
                    <div><strong>Created:</strong> {formatDistanceToNow(new Date(draft.createdAt), { addSuffix: true })}</div>
                    <div><strong>By:</strong> {draft.createdBy}</div>
                  </div>

                  <p className="timeline-description">{draft.description}</p>

                  {draft.approvedBy && (
                    <div className="approval-info">
                      ✓ Approved by {draft.approvedBy}
                    </div>
                  )}

                  {draft.deployedAt && (
                    <div className="deployment-info">
                      🚀 Deployed {formatDistanceToNow(new Date(draft.deployedAt), { addSuffix: true })}
                    </div>
                  )}

                  <div className="timeline-actions">
                    <a href={`/draft/${draft.id}`}>View Details</a>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
