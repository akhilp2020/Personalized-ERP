import React, { useState } from 'react';
import { Play, CheckCircle, XCircle, Loader, FileCheck } from 'lucide-react';
import { extensionApi } from '../services/api';
import type { ExtensionDraft } from '../types';

interface TestRunnerProps {
  draft: ExtensionDraft;
  onTestComplete: (draft: ExtensionDraft) => void;
}

export const TestRunner: React.FC<TestRunnerProps> = ({ draft, onTestComplete }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRunTests = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await extensionApi.test(draft.id);
      onTestComplete(response.draft);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Test execution failed');
    } finally {
      setLoading(false);
    }
  };

  const renderTestStatus = () => {
    if (!draft.testResults) {
      return (
        <div className="test-prompt">
          <Play size={48} />
          <p>Run tests to verify extension behavior</p>
          <button onClick={handleRunTests} disabled={loading}>
            {loading ? <><Loader className="spin" /> Running Tests...</> : <><Play size={16} /> Run Tests</>}
          </button>
        </div>
      );
    }

    const { passed, results, logs } = draft.testResults;

    return (
      <div className="test-results">
        <div className={`test-status ${passed ? 'passed' : 'failed'}`}>
          {passed ? <CheckCircle size={32} /> : <XCircle size={32} />}
          <h4>{passed ? 'All Tests Passed' : 'Tests Failed'}</h4>
        </div>

        {results && (
          <div className="test-stats">
            <div className="stat">
              <strong>{results.stats?.tests || 0}</strong>
              <span>Total Tests</span>
            </div>
            <div className="stat">
              <strong>{results.stats?.passes || 0}</strong>
              <span>Passed</span>
            </div>
            <div className="stat">
              <strong>{results.stats?.failures || 0}</strong>
              <span>Failed</span>
            </div>
          </div>
        )}

        <details className="test-logs">
          <summary>View Logs</summary>
          <pre>{logs}</pre>
        </details>

        <button onClick={handleRunTests} disabled={loading}>
          Re-run Tests
        </button>
      </div>
    );
  };

  return (
    <div className="test-runner">
      <h3>Test Execution</h3>
      {renderTestStatus()}
      {error && <div className="error">{error}</div>}
    </div>
  );
};
