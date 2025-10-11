import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { DraftForm } from '../components/DraftForm';
import { QAChat } from '../components/QAChat';
import { ValidationPanel } from '../components/ValidationPanel';
import { ArtifactsPanel } from '../components/ArtifactsPanel';
import { TestRunner } from '../components/TestRunner';
import { ApprovalPanel } from '../components/ApprovalPanel';
import { extensionApi } from '../services/api';
import type { ExtensionDraft } from '../types';

interface DraftWorkflowProps {
  tenantId: string;
}

export const DraftWorkflow: React.FC<DraftWorkflowProps> = ({ tenantId }) => {
  const { id } = useParams();
  const [currentDraft, setCurrentDraft] = useState<ExtensionDraft | null>(null);
  const [step, setStep] = useState<'create' | 'qa' | 'validate' | 'artifacts' | 'test' | 'approve'>('create');

  React.useEffect(() => {
    if (id) {
      loadDraft(id);
    }
  }, [id]);

  const loadDraft = async (draftId: string) => {
    try {
      const response = await extensionApi.getDraft(draftId);
      setCurrentDraft(response.draft);
      determineStep(response.draft);
    } catch (err) {
      console.error('Failed to load draft:', err);
    }
  };

  const determineStep = (draft: ExtensionDraft) => {
    if (!draft.schema || Object.keys(draft.schema.properties || {}).length === 0) {
      setStep('qa');
    } else if (!draft.validationResults) {
      setStep('validate');
    } else if (!draft.generatedArtifacts || Object.keys(draft.generatedArtifacts).length === 0) {
      setStep('artifacts');
    } else if (!draft.testResults) {
      setStep('test');
    } else {
      setStep('approve');
    }
  };

  const handleDraftCreated = (draftId: string) => {
    loadDraft(draftId);
    setStep('qa');
  };

  const handleSchemaComplete = async (schema: any) => {
    if (!currentDraft) return;

    // Update draft with schema (in real app, would call API)
    const updatedDraft = { ...currentDraft, schema };
    setCurrentDraft(updatedDraft);
    setStep('validate');
  };

  const handleValidated = (draft: ExtensionDraft) => {
    setCurrentDraft(draft);
    if (draft.status === 'validated') {
      setStep('artifacts');
    }
  };

  const handleGenerated = (draft: ExtensionDraft) => {
    setCurrentDraft(draft);
    setStep('test');
  };

  const handleTestComplete = (draft: ExtensionDraft) => {
    setCurrentDraft(draft);
    setStep('approve');
  };

  const handleStatusChange = (draft: ExtensionDraft) => {
    setCurrentDraft(draft);
  };

  return (
    <div className="draft-workflow">
      <div className="workflow-steps">
        <div className={`step ${step === 'create' ? 'active' : currentDraft ? 'completed' : ''}`}>
          1. Create
        </div>
        <div className={`step ${step === 'qa' ? 'active' : (currentDraft?.schema && Object.keys(currentDraft.schema.properties || {}).length > 0) ? 'completed' : ''}`}>
          2. Define Schema
        </div>
        <div className={`step ${step === 'validate' ? 'active' : currentDraft?.validationResults ? 'completed' : ''}`}>
          3. Validate
        </div>
        <div className={`step ${step === 'artifacts' ? 'active' : (currentDraft?.generatedArtifacts && Object.keys(currentDraft.generatedArtifacts).length > 0) ? 'completed' : ''}`}>
          4. Generate
        </div>
        <div className={`step ${step === 'test' ? 'active' : currentDraft?.testResults ? 'completed' : ''}`}>
          5. Test
        </div>
        <div className={`step ${step === 'approve' ? 'active' : currentDraft?.status === 'approved' || currentDraft?.status === 'deployed' ? 'completed' : ''}`}>
          6. Approve
        </div>
      </div>

      <div className="workflow-content">
        {step === 'create' && !currentDraft && (
          <DraftForm onDraftCreated={handleDraftCreated} />
        )}

        {step === 'qa' && currentDraft && (
          <QAChat draftId={currentDraft.id} onSchemaComplete={handleSchemaComplete} />
        )}

        {step === 'validate' && currentDraft && (
          <ValidationPanel draft={currentDraft} onValidated={handleValidated} />
        )}

        {step === 'artifacts' && currentDraft && (
          <ArtifactsPanel draft={currentDraft} onGenerated={handleGenerated} />
        )}

        {step === 'test' && currentDraft && (
          <TestRunner draft={currentDraft} onTestComplete={handleTestComplete} />
        )}

        {step === 'approve' && currentDraft && (
          <ApprovalPanel draft={currentDraft} onStatusChange={handleStatusChange} />
        )}
      </div>
    </div>
  );
};
