import React, { useState } from 'react';
import { Code, FileText, Loader } from 'lucide-react';
import { extensionApi } from '../services/api';
import type { ExtensionDraft } from '../types';

interface ArtifactsPanelProps {
  draft: ExtensionDraft;
  onGenerated: (draft: ExtensionDraft) => void;
}

export const ArtifactsPanel: React.FC<ArtifactsPanelProps> = ({ draft, onGenerated }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('ajvValidator');

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await extensionApi.generate(draft.id);
      onGenerated(response.draft);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  const hasArtifacts = draft.generatedArtifacts && Object.keys(draft.generatedArtifacts).length > 0;

  return (
    <div className="artifacts-panel">
      <h3>Generated Artifacts</h3>

      {!hasArtifacts && draft.status === 'validated' && (
        <div className="generate-prompt">
          <Code size={48} />
          <p>Generate code artifacts, validators, and documentation</p>
          <button onClick={handleGenerate} disabled={loading}>
            {loading ? <><Loader className="spin" /> Generating...</> : 'Generate Artifacts'}
          </button>
        </div>
      )}

      {hasArtifacts && (
        <div className="artifacts-viewer">
          <div className="tabs">
            {Object.keys(draft.generatedArtifacts).map((key) => (
              <button
                key={key}
                className={activeTab === key ? 'active' : ''}
                onClick={() => setActiveTab(key)}
              >
                {key}
              </button>
            ))}
          </div>

          <div className="artifact-content">
            <pre>
              <code>{draft.generatedArtifacts[activeTab as keyof typeof draft.generatedArtifacts]}</code>
            </pre>
          </div>

          <div className="artifact-actions">
            <button onClick={() => {
              const content = draft.generatedArtifacts[activeTab as keyof typeof draft.generatedArtifacts];
              navigator.clipboard.writeText(content || '');
            }}>
              Copy to Clipboard
            </button>
          </div>
        </div>
      )}

      {error && <div className="error">{error}</div>}
    </div>
  );
};
