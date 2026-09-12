export type AgentConfig = {
  id: string;
  name: string;
  description: string;
  defaultSessionKey: string;
};

export const AGENTS: AgentConfig[] = [
  {
    id: 'main',
    name: 'AV_BOT',
    description: 'Default Aneeverse business operations assistant',
    defaultSessionKey: 'agent:main:main',
  },
  {
    id: 'onefc',
    name: '1FC',
    description: 'OpenClaw agent: onefc',
    defaultSessionKey: 'agent:onefc:main',
  },
  {
    id: 'novino',
    name: 'Novino',
    description: 'OpenClaw agent: Novino',
    defaultSessionKey: 'agent:novino:main',
  },
  {
    id: 'surajscarpe11',
    name: 'Suraj Scarpe',
    description: 'OpenClaw agent: Suraj Scarpe',
    defaultSessionKey: 'agent:surajscarpe11:main',
  },
];

export function getAgent(agentId: string | null | undefined) {
  return AGENTS.find((agent) => agent.id === agentId) ?? AGENTS[0];
}

export function buildSessionKey(agentId: string, mainKey = 'main') {
  const safeAgent = agentId.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'main';
  const safeMain = mainKey.trim() || 'main';
  return `agent:${safeAgent}:${safeMain}`;
}
