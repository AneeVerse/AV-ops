'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { AgentConfig } from '../lib/agents';
import { ChatInput } from './ChatInput';
import { ChatMessage, MessageBubble } from './MessageBubble';

type Props = {
  agent: AgentConfig;
  sessionKey: string;
  onToggleSidebar: () => void;
  onSessionsChanged: () => void;
};

export function ChatWindow({ agent, sessionKey, onToggleSidebar, onSessionsChanged }: Props) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const historyPayload = useMemo(() => ({ agentId: agent.id, sessionKey }), [agent.id, sessionKey]);

  async function loadHistory(silent = false) {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/chat/history', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(historyPayload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load history');
      setMessages(data.messages || []);
      setSessionId(data.sessionId || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    setMessages([]);
    setSessionId(null);
    void loadHistory(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.id, sessionKey]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  async function send(text: string) {
    setSending(true);
    setStatus('Sending...');
    setError('');
    const initialAssistantCount = messages.filter((message) => message.role === 'assistant').length;
    const optimistic: ChatMessage = { id: `local-${Date.now()}`, role: 'user', text };
    setMessages((current) => [...current, optimistic]);
    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agentId: agent.id, sessionKey, sessionId, message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Send failed');
      setStatus('Waiting for assistant reply...');
      onSessionsChanged();

      for (let i = 0; i < 24; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, i < 6 ? 1000 : 2500));

        const historyRes = await fetch('/api/chat/history', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(historyPayload),
        });
        const historyData = await historyRes.json();
        if (!historyRes.ok) throw new Error(historyData.error || 'Failed to load history');

        const nextMessages = historyData.messages || [];
        setMessages(nextMessages);
        setSessionId(historyData.sessionId || null);

        const assistantCount = nextMessages.filter((message: ChatMessage) => message.role === 'assistant').length;
        if (assistantCount > initialAssistantCount) break;
      }
      setStatus('');
      onSessionsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed');
      setStatus('');
    } finally {
      setSending(false);
      void loadHistory(true);
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    location.href = '/login';
  }

  return (
    <main className="chat">
      <header className="chat-header">
        <div>
          <button className="btn secondary mobile-agent-toggle" onClick={onToggleSidebar}>Agents</button>
          <div className="chat-title">{agent.name}</div>
          <div className="chat-subtitle">{sessionKey}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={onSessionsChanged} disabled={sending}>Refresh</button>
          <button className="btn secondary" onClick={logout}>Logout</button>
        </div>
      </header>

      <section className="messages">
        {loading ? <div className="bubble system">Loading history...</div> : null}
        {error ? <div className="bubble system">Error: {error}</div> : null}
        {!loading && messages.length === 0 ? <div className="bubble system">No messages yet. Start a chat with {agent.name}.</div> : null}
        {messages.map((message) => <MessageBubble key={message.id} message={message} />)}
        {sending ? <div className="bubble system">Assistant may still be working...</div> : null}
        <div ref={bottomRef} />
      </section>

      <footer className="composer">
        <ChatInput disabled={sending || loading} onSend={send} />
        <div className="status">{status || 'Gateway token stays server-side. Browser only talks to this app.'}</div>
      </footer>
    </main>
  );
}
