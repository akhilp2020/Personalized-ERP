import React, { useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Loader } from 'lucide-react';
import { extensionApi } from '../services/api';
import type { ExtensionDraft } from '../types';

interface ValidationPanelProps {
  draft: ExtensionDraft;
  onValidated: (draft: ExtensionDraft) => void;
}

export const ValidationPanel: React.FC<ValidationPanelProps> = ({ draft, onValidated }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleValidate = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await extensionApi.validate(draft.id);
      onValidated(response.draft);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Validation failed');
    } finally {
      setLoading(false);
    }
  };

  const renderStatus = () => {
    if (loading) {
      return <div className="status loading"><Loader className="spin" /> Validating...</div>;
    }

    if (!draft.validationResults) {
      return (
        <div className="status pending">
          <AlertTriangle />
          <span>Not yet validated</span>
          <button onClick={handleValidate}>Validate Now</button>
        </div>
      );
    }

    const isValid = draft.validationResults.contract.compatible;
    return (
      <div className={`status ${isValid ? 'valid' : 'invalid'}`}>
        {isValid ? <CheckCircle /> : <XCircle />}
        <span>{isValid ? 'Valid' : 'Invalid'}</span>
      </div>
    );
  };

  return (
    <div className="validation-panel">
      <h3>Validation & Contract Check</h3>

      {renderStatus()}

      {draft.impactReport && (
        <div className="impact-report">
          <h4>Impact Report</h4>
          <div className={`summary ${draft.impactReport.backwardCompatible ? 'compatible' : 'incompatible'}`}>
            {draft.impactReport.summary}
          </div>

          {draft.impactReport.violations.length > 0 && (
            <div className="violations">
              <h5>Violations</h5>
              <ul>
                {draft.impactReport.violations.map((v, idx) => (
                  <li key={idx}>{v}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="metadata">
            <div>
              <strong>Affected Endpoints:</strong> {draft.impactReport.affectedEndpoints.length}
            </div>
            <div>
              <strong>Affected Events:</strong> {draft.impactReport.affectedEvents.length}
            </div>
          </div>
        </div>
      )}

      {draft.validationResults?.storage && (
        <div className="storage-validation">
          <h4>Storage Readiness</h4>
          <table>
            <thead>
              <tr>
                <th>Table</th>
                <th>Extensions Column</th>
              </tr>
            </thead>
            <tbody>
              {draft.validationResults.storage.tables.map((t) => (
                <tr key={t.table}>
                  <td>{t.table}</td>
                  <td>
                    {t.hasExtensions ? (
                      <span className="badge success">✓ Ready</span>
                    ) : (
                      <span className="badge warning">⚠ Needs Migration</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {draft.migrations.length > 0 && (
            <div className="migrations">
              <h5>Required Migrations</h5>
              {draft.migrations.map((migration, idx) => (
                <details key={idx}>
                  <summary>{migration.filename}</summary>
                  <pre>{migration.content}</pre>
                </details>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <div className="error">{error}</div>}
    </div>
  );
};
