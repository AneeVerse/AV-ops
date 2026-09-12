import WebSocket from 'ws';
import { randomUUID } from 'crypto';

export type OpenClawMessage = {
  role?: string;
  text?: string;
  content?: unknown;
  timestamp?: string | number;
  [key: string]: unknown;
};

type Pending = {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
};

export class OpenClawRpcClient {
  private ws?: WebSocket;
  private pending = new Map<string, Pending>();
  private connected = false;

  constructor(
    private readonly url = process.env.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789',
    private readonly token = process.env.OPENCLAW_GATEWAY_TOKEN,
  ) {}

  async connect() {
    if (!this.token) throw new Error('OPENCLAW_GATEWAY_TOKEN is not set');

    this.ws = new WebSocket(this.url, {
      headers: {
        Origin: process.env.OPENCLAW_GATEWAY_ORIGIN || 'https://bot.aneeverse.com',
      },
    });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('OpenClaw Gateway connection timed out')), 10000);

      this.ws!.once('open', () => {
        this.installMessageHandler();
      });
      this.ws!.once('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
      this.ws!.once('close', (code, reason) => {
        if (!this.connected) {
          clearTimeout(timer);
          reject(new Error(`OpenClaw Gateway closed before connect (${code}): ${reason.toString()}`));
        }
      });

      const onReady = async () => {
        try {
          await this.request('connect', {
            minProtocol: 3,
            maxProtocol: 3,
            role: 'operator',
            scopes: ['operator.read', 'operator.write'],
            caps: ['tool-events'],
            client: {
              id: 'openclaw-control-ui',
              version: 'aneeverse-chat-control/0.1.0',
              platform: 'server',
              mode: 'webchat',
            },
            auth: { token: this.token },
            userAgent: 'aneeverse-chat-control/0.1.0',
            locale: 'en',
          });
          this.connected = true;
          clearTimeout(timer);
          resolve();
        } catch (err) {
          clearTimeout(timer);
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      };

      this.ws!.once('open', () => setTimeout(onReady, 50));
    });
  }

  private installMessageHandler() {
    this.ws!.on('message', (data) => {
      let msg: any;
      try {
        msg = JSON.parse(String(data));
      } catch {
        return;
      }

      if (msg.type === 'event' && msg.event === 'connect.challenge') {
        // This minimal server client uses shared-token auth only. Gateway accepts
        // this on loopback; browser/device pairing is intentionally not exposed here.
        return;
      }

      if (msg.type !== 'res') return;
      const pending = this.pending.get(msg.id);
      if (!pending) return;
      this.pending.delete(msg.id);
      if (msg.ok) pending.resolve(msg.payload);
      else pending.reject(new Error(msg.error?.message || 'OpenClaw request failed'));
    });
  }

  request<T = unknown>(method: string, params: Record<string, unknown>) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('OpenClaw Gateway is not connected'));
    }
    const id = randomUUID();
    const payload = { type: 'req', id, method, params };
    const promise = new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
      setTimeout(() => {
        if (this.pending.delete(id)) reject(new Error(`OpenClaw request timed out: ${method}`));
      }, 120000);
    });
    this.ws.send(JSON.stringify(payload));
    return promise;
  }

  close() {
    this.ws?.close();
  }
}

export async function withOpenClaw<T>(fn: (client: OpenClawRpcClient) => Promise<T>) {
  const client = new OpenClawRpcClient();
  await client.connect();
  try {
    return await fn(client);
  } finally {
    client.close();
  }
}

function cleanVisibleText(value: string) {
  return value
    .replace(/<final>([\s\S]*?)<\/final>/gi, '$1')
    .replace(/<answer>([\s\S]*?)<\/answer>/gi, '$1')
    .replace(/<assistant>([\s\S]*?)<\/assistant>/gi, '$1')
    .replace(/<\/?(?:final|answer|assistant)>/gi, '')
    .trim();
}

export function messageText(message: OpenClawMessage) {
  let text = '';
  if (typeof message.text === 'string') text = message.text;
  else if (typeof message.content === 'string') text = message.content;
  else if (Array.isArray(message.content)) {
    text = message.content
      .map((part: any) => (typeof part === 'string' ? part : typeof part?.text === 'string' ? part.text : ''))
      .filter(Boolean)
      .join('\n');
  }
  return cleanVisibleText(text);
}
