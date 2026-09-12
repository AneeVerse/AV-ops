import type { AgentConfig } from '../lib/agents';

export type ChatSessionSummary = {
  key: string;
  label: string;
  updatedAt: number | null;
  status: string | null;
  sessionId: string | null;
};

type Props = {
  agents: AgentConfig[];
  activeAgentId: string;
  activeSessionKey: string;
  sessions: ChatSessionSummary[];
  sessionsLoading: boolean;
  open: boolean;
  onSelectAgent: (agent: AgentConfig) => void;
  onSelectSession: (sessionKey: string) => void;
  onNewChat: () => void;
};

function formatUpdatedAt(value: number | null) {
  if (!value) return 'No messages yet';
  return new Date(value).toLocaleString('en-IN', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AgentSidebar({
  agents,
  activeAgentId,
  activeSessionKey,
  sessions,
  sessionsLoading,
  open,
  onSelectAgent,
  onSelectSession,
  onNewChat,
}: Props) {
  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="sidebar-title">
        <div className="logo">AV</div>
        <div>
          <div>Aneeverse Chat</div>
          <div className="agent-id">OpenClaw agents</div>
        </div>
      </div>

      <div className="sidebar-section-title">Agents</div>
      <div className="agent-list">
        {agents.map((agent) => (
          <button
            key={agent.id}
            className={`agent-button ${agent.id === activeAgentId ? 'active' : ''}`}
            onClick={() => onSelectAgent(agent)}
          >
            <div className="agent-name">{agent.name}</div>
            <div className="agent-id">{agent.id}</div>
          </button>
        ))}
      </div>

      <div className="sidebar-section-title with-action">
        <span>Chats</span>
        <button className="tiny-btn" onClick={onNewChat}>New</button>
      </div>
      <div className="session-list">
        {sessionsLoading ? <div className="session-empty">Loading chats...</div> : null}
        {!sessionsLoading && sessions.length === 0 ? <div className="session-empty">No chats yet</div> : null}
        {sessions.map((session) => (
          <button
            key={session.key}
            className={`session-button ${session.key === activeSessionKey ? 'active' : ''}`}
            onClick={() => onSelectSession(session.key)}
          >
            <div className="session-label">{session.label}</div>
            <div className="session-meta">{formatUpdatedAt(session.updatedAt)}</div>
            <div className="session-key">{session.key}</div>
          </button>
        ))}
      </div>
    </aside>
  );
}
