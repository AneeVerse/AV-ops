export type ChatMessage = {
  id: string;
  role: string;
  text: string;
  timestamp?: string | number | null;
};

export function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role !== 'user' && message.role !== 'assistant') return null;
  const role = message.role === 'user' ? 'user' : 'assistant';
  const text = (message.text || '').trim();
  if (!text) return null;
  return <div className={`bubble ${role}`}>{text}</div>;
}
