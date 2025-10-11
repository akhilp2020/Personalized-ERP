import React, { useState, useEffect } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import type { QAQuestion } from '../types';

interface QAChatProps {
  draftId: string;
  onSchemaComplete: (schema: any) => void;
}

export const QAChat: React.FC<QAChatProps> = ({ draftId, onSchemaComplete }) => {
  const [messages, setMessages] = useState<Array<{ role: 'assistant' | 'user'; content: string }>>([
    { role: 'assistant', content: 'Hi! I\'ll help you define your extension schema. What fields do you want to add?' }
  ]);
  const [input, setInput] = useState('');
  const [schema, setSchema] = useState<any>({ type: 'object', properties: {} });

  // Simple Q&A simulation - in production, this would call the Q&A endpoint
  const handleSend = () => {
    if (!input.trim()) return;

    setMessages(prev => [...prev, { role: 'user', content: input }]);

    // Parse simple field definitions like "priorityLevel: string (standard, high, critical)"
    const fieldMatch = input.match(/(\w+):\s*(\w+)(?:\s*\(([^)]+)\))?/);

    if (fieldMatch) {
      const [, fieldName, fieldType, enumValues] = fieldMatch;
      const newProperty: any = { type: fieldType };

      if (enumValues) {
        newProperty.enum = enumValues.split(',').map(v => v.trim());
      }

      const updatedSchema = {
        ...schema,
        properties: {
          ...schema.properties,
          [fieldName]: newProperty
        }
      };

      setSchema(updatedSchema);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Added field "${fieldName}" of type ${fieldType}${enumValues ? ` with values: ${enumValues}` : ''}. Add more fields or type "done" to finish.`
      }]);
    } else if (input.toLowerCase() === 'done') {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Schema complete! Found ${Object.keys(schema.properties).length} fields.`
      }]);
      onSchemaComplete(schema);
    } else {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Please specify fields in format: fieldName: type (optional comma-separated enum values)\nExample: priorityLevel: string (standard, high, critical)'
      }]);
    }

    setInput('');
  };

  return (
    <div className="qa-chat">
      <div className="chat-header">
        <MessageCircle size={20} />
        <h3>Extension Schema Builder</h3>
      </div>

      <div className="messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            <div className="message-content">{msg.content}</div>
          </div>
        ))}
      </div>

      {Object.keys(schema.properties).length > 0 && (
        <div className="schema-preview">
          <h4>Current Schema</h4>
          <pre>{JSON.stringify(schema, null, 2)}</pre>
        </div>
      )}

      <div className="chat-input">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Describe a field or type 'done'"
        />
        <button onClick={handleSend}>
          <Send size={16} />
        </button>
      </div>
    </div>
  );
};
