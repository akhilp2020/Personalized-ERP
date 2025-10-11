import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { ChatInterface } from './components/ChatInterface';
import { AuditHistory } from './components/AuditHistory';
import './App.css';

const queryClient = new QueryClient();

function App() {
  const [tenantId, setTenantId] = useState('tenant1');

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="app">
          <header className="app-header">
            <div className="logo">
              <MessageSquare size={32} />
              <h1>Extension Console</h1>
              <span className="subtitle">Chat-First Extension Builder</span>
            </div>
            <div className="tenant-selector">
              <label>Tenant:</label>
              <select value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
                <option value="tenant1">Tenant 1</option>
                <option value="tenant2">Tenant 2</option>
                <option value="tenant3">Tenant 3</option>
              </select>
            </div>
          </header>

          <nav className="app-nav">
            <Link to="/">Chat</Link>
            <Link to="/history">History</Link>
          </nav>

          <main className="app-main">
            <Routes>
              <Route path="/" element={<ChatInterface tenantId={tenantId} />} />
              <Route path="/history" element={<AuditHistory tenantId={tenantId} />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
