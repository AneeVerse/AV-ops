'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AgentConfig } from '../../lib/agents';
import { AgentSidebar, ChatSessionSummary } from '../../components/AgentSidebar';
import { ChatWindow } from '../../components/ChatWindow';

function readChatParams() {
  const params = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
  const embed = params.get('embed') === '1';
  return {
    embed,
    agentId: params.get('agent') || (embed ? 'novino' : null),
  };
}

export default function ChatPage() {
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [active, setActive] = useState<AgentConfig | null>(null);
  const [activeSessionKeyByAgent, setActiveSessionKeyByAgent] = useState<Record<string, string>>({});
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [embed, setEmbed] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('av-chat-active-session-keys');
    if (stored) {
      try { setActiveSessionKeyByAgent(JSON.parse(stored)); } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('av-chat-active-session-keys', JSON.stringify(activeSessionKeyByAgent));
  }, [activeSessionKeyByAgent]);

  useEffect(() => {
    async function loadAgents() {
      try {
        const { embed: embedMode, agentId } = readChatParams();
        setEmbed(embedMode);
        const res = await fetch('/api/agents');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load agents');
        const list: AgentConfig[] = data.agents || [];
        setAgents(list);
        const match =
          (agentId ? list.find((agent) => agent.id === agentId) : undefined) ||
          list.find((agent) => agent.id === 'novino') ||
          list[0] ||
          null;
        setActive(match);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load agents');
      }
    }
    void loadAgents();
  }, []);

  const activeSessionKey = active ? activeSessionKeyByAgent[active.id] || active.defaultSessionKey : '';

  const loadSessions = useCallback(async (agent: AgentConfig | null = active) => {
    if (!agent) return;
    setSessionsLoading(true);
    try {
      const res = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agentId: agent.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load chats');
      setSessions(data.sessions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load chats');
    } finally {
      setSessionsLoading(false);
    }
  }, [active]);

  useEffect(() => {
    void loadSessions(active);
  }, [active, loadSessions]);

  async function newChat() {
    if (!active) return;
    try {
      const res = await fetch('/api/chat/new', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agentId: active.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create chat');
      setActiveSessionKeyByAgent((current) => ({ ...current, [active.id]: data.sessionKey }));
      setSessions((current) => [
        { key: data.sessionKey, label: 'New chat', updatedAt: null, status: null, sessionId: null },
        ...current.filter((session) => session.key !== data.sessionKey),
      ]);
      setSidebarOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create chat');
    }
  }

  if (error) return <main className="login-page"><div className="bubble system">{error}</div></main>;
  if (!active) return <main className="login-page"><div className="bubble system">Loading agents...</div></main>;

  return (
    <div className={`shell ${embed ? 'embed' : ''}`}>
      {embed ? null : (
        <AgentSidebar
          agents={agents}
          activeAgentId={active.id}
          activeSessionKey={activeSessionKey}
          sessions={sessions}
          sessionsLoading={sessionsLoading}
          open={sidebarOpen}
          onSelectAgent={(agent) => {
            setActive(agent);
            setSidebarOpen(false);
          }}
          onSelectSession={(sessionKey) => {
            setActiveSessionKeyByAgent((current) => ({ ...current, [active.id]: sessionKey }));
            setSidebarOpen(false);
          }}
          onNewChat={newChat}
        />
      )}
      <ChatWindow
        agent={active}
        sessionKey={activeSessionKey}
        embed={embed}
        onToggleSidebar={() => setSidebarOpen((value) => !value)}
        onSessionsChanged={() => void loadSessions(active)}
        onNewChat={embed ? newChat : undefined}
      />
    </div>
  );
}
