import React, { useState, useEffect, useRef } from 'react';
import { Send, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { extensionApi } from '../services/api';
import type { ChatMessage, ChatResponse, ExtensionPlan, ImpactReport } from '../types';
import './ChatInterface.css';

interface ChatInterfaceProps {
  tenantId: string;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ tenantId }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      text: 'Hi! I\'m here to help you create extensions. Try saying:\n\n• "Add Customer PO on order header, optional, max length 40"\n• "Add priority field to order items with values standard, high, critical"\n\nJust describe what you need in plain English!',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [draftId, setDraftId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('idle');
  const [plan, setPlan] = useState<ExtensionPlan | null>(null);
  const [impactReport, setImpactReport] = useState<ImpactReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      text: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await extensionApi.sendChatMessage({
        tenant: tenantId,
        text: input,
        draftId,
      });

      if (response.draftId && !draftId) {
        setDraftId(response.draftId);
      }

      if (response.status) {
        setStatus(response.status);
      }

      if (response.plan) {
        setPlan(response.plan);
      }

      if (response.impactReport) {
        setImpactReport(response.impactReport);
      }

      // Add assistant messages
      const newMessages: ChatMessage[] = response.messages.map(msg => ({
        role: msg.role,
        text: msg.text,
        timestamp: new Date(),
      }));

      setMessages(prev => [...prev, ...newMessages]);

    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: 'Sorry, something went wrong. Please try again.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = (action: string) => {
    setInput(action);
  };

  const handleApprove = async () => {
    if (isLoading) return;

    setIsLoading(true);

    try {
      const response = await extensionApi.sendChatMessage({
        tenant: tenantId,
        text: 'approve',
        draftId,
      });

      if (response.status) {
        setStatus(response.status);
      }

      if (response.plan) {
        setPlan(response.plan);
      }

      if (response.impactReport) {
        setImpactReport(response.impactReport);
      }

      // Add assistant messages
      const newMessages: ChatMessage[] = response.messages.map(msg => ({
        role: msg.role,
        text: msg.text,
        timestamp: new Date(),
      }));

      setMessages(prev => [...prev,
        { role: 'user', text: 'approve', timestamp: new Date() },
        ...newMessages
      ]);

    } catch (error) {
      console.error('Approval error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: 'Sorry, approval failed. Please try again.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevise = async () => {
    if (isLoading) return;

    setIsLoading(true);

    try {
      const response = await extensionApi.sendChatMessage({
        tenant: tenantId,
        text: 'revise',
        draftId,
      });

      if (response.status) {
        setStatus(response.status);
      }

      if (response.plan) {
        setPlan(response.plan);
      }

      if (response.impactReport) {
        setImpactReport(response.impactReport);
      }

      // Add assistant messages
      const newMessages: ChatMessage[] = response.messages.map(msg => ({
        role: msg.role,
        text: msg.text,
        timestamp: new Date(),
      }));

      setMessages(prev => [...prev,
        { role: 'user', text: 'revise', timestamp: new Date() },
        ...newMessages
      ]);

    } catch (error) {
      console.error('Revise error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: 'Sorry, revision failed. Please try again.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickChips = [
    'Order',
    'Item',
    'Required',
    'Optional',
    'Enum',
    'Date',
  ];

  return (
    <div className="chat-interface">
      <div className="chat-container">
        <div className="chat-messages">
          {messages.map((msg, idx) => (
            <div key={idx} className={`message ${msg.role}`}>
              <div className="message-content">
                {msg.text.split('\n').map((line, i) => (
                  <React.Fragment key={i}>
                    {line}
                    {i < msg.text.split('\n').length - 1 && <br />}
                  </React.Fragment>
                ))}
              </div>
              <div className="message-timestamp">
                {msg.timestamp.toLocaleTimeString()}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="message assistant loading">
              <div className="message-content">
                <Clock className="spin" size={16} /> Thinking...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-quick-chips">
          {quickChips.map(chip => (
            <button
              key={chip}
              className="quick-chip"
              onClick={() => handleQuickAction(chip.toLowerCase())}
            >
              {chip}
            </button>
          ))}
        </div>

        <div className="chat-input">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Describe the field you need..."
            disabled={isLoading}
          />
          <button onClick={handleSend} disabled={isLoading || !input.trim()}>
            <Send size={20} />
          </button>
        </div>

        {draftId && (
          <div className="chat-status">
            <span className="draft-id">Draft: {draftId}</span>
            <span className={`status-badge ${status}`}>{status}</span>
          </div>
        )}
      </div>

      {/* Right-side Plan Panel */}
      {status === 'ready_to_propose' && plan && (
        <div className="plan-panel">
          <div className="plan-header">
            <CheckCircle size={24} color="#10b981" />
            <h3>Implementation Plan</h3>
          </div>

          <div className="plan-section">
            <h4>Storage</h4>
            <ul>
              <li>Scope: {plan.storage.scope}</li>
              <li>Tables: {plan.storage.tables.join(', ')}</li>
              {plan.storage.migrations.length > 0 && (
                <li>Migrations: {plan.storage.migrations.join(', ')}</li>
              )}
            </ul>
          </div>

          <div className="plan-section">
            <h4>API Changes</h4>
            <p>{plan.api.changes}</p>
            {plan.api.endpoints.length > 0 && (
              <ul>
                {plan.api.endpoints.map((ep: any, i: number) => (
                  <li key={i}>{ep.method} {ep.path}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="plan-section">
            <h4>UI</h4>
            <p>{plan.ui.fragments}</p>
          </div>

          <div className="plan-section">
            <h4>Tests</h4>
            <ul>
              {plan.tests.packs.map((pack: string, i: number) => (
                <li key={i}>{pack}</li>
              ))}
            </ul>
          </div>

          <div className="plan-section">
            <h4>Documentation</h4>
            <ul>
              {plan.docs.files.map((file: string, i: number) => (
                <li key={i}>{file}</li>
              ))}
            </ul>
          </div>

          <button
            className="approve-button"
            onClick={handleApprove}
            disabled={isLoading}
          >
            Approve Plan
          </button>
        </div>
      )}

      {/* Impact Report Panel (Contract Break) */}
      {status === 'contract_break' && impactReport && (
        <div className="plan-panel contract-break">
          <div className="plan-header">
            <AlertTriangle size={24} color="#ef4444" />
            <h3>Contract Break Detected</h3>
          </div>

          <div className="plan-section">
            <h4>Violations</h4>
            <ul>
              {impactReport.violations.map((violation, i) => (
                <li key={i} className="violation">{violation}</li>
              ))}
            </ul>
          </div>

          <div className="plan-section">
            <h4>Affected Endpoints</h4>
            {impactReport.affectedEndpoints.length > 0 ? (
              <ul>
                {impactReport.affectedEndpoints.map((ep: string, i: number) => (
                  <li key={i}>{ep}</li>
                ))}
              </ul>
            ) : (
              <p>None</p>
            )}
          </div>

          <div className="plan-section">
            <h4>Affected Events</h4>
            {impactReport.affectedEvents.length > 0 ? (
              <ul>
                {impactReport.affectedEvents.map((ev: string, i: number) => (
                  <li key={i}>{ev}</li>
                ))}
              </ul>
            ) : (
              <p>None</p>
            )}
          </div>

          <div className="plan-section">
            <h4>How to Fix</h4>
            <p>To maintain backward compatibility:</p>
            <ul>
              <li>Mark all new fields as optional</li>
              <li>Avoid conflicts with existing required fields</li>
              <li>Use the extensions map pattern</li>
            </ul>
          </div>

          <button
            className="revise-button"
            onClick={handleRevise}
            disabled={isLoading}
          >
            Revise Extension
          </button>
        </div>
      )}
    </div>
  );
};
