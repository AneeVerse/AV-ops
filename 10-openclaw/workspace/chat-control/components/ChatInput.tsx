import { useState } from 'react';

export function ChatInput({ disabled, onSend }: { disabled?: boolean; onSend: (text: string) => Promise<void> }) {
  const [text, setText] = useState('');

  async function submit() {
    const value = text.trim();
    if (!value || disabled) return;
    setText('');
    await onSend(value);
  }

  return (
    <div className="composer-row">
      <textarea
        className="textarea"
        placeholder="Message OpenClaw..."
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void submit();
          }
        }}
      />
      <button className="btn" disabled={disabled || !text.trim()} onClick={() => void submit()}>
        Send
      </button>
    </div>
  );
}
