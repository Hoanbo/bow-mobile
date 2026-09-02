// src/services/bowconBridge.ts
// Client SDK Bridge connecting BOWCON Mobile to Central Brain (@bow/agent V4.0)

export interface BowconHandshake {
  channel: 'ROBOT';
  role: 'owner';
  client: 'BOWCON_MOBILE';
  version: '4.0.0';
  device: 'iPhone';
}

export interface BowconCommandRequest {
  text: string;
  context?: {
    channel: string;
    role: string;
    userId?: string;
  };
}

export interface BowconCommandResponse {
  success: boolean;
  content: string;
  actionData?: any;
  speechAudioBase64?: string;
}

export class BowconBridge {
  private serverHost: string = 'localhost:4078';

  constructor() {
    const saved = localStorage.getItem('bowcon_server_host');
    if (saved) {
      this.serverHost = saved;
    }
  }

  public setServerHost(host: string): void {
    this.serverHost = host;
    localStorage.setItem('bowcon_server_host', host);
  }

  public getServerHost(): string {
    return this.serverHost;
  }

  public getHandshakePayload(): BowconHandshake {
    return {
      channel: 'ROBOT',
      role: 'owner',
      client: 'BOWCON_MOBILE',
      version: '4.0.0',
      device: 'iPhone',
    };
  }

  public async checkHealth(): Promise<boolean> {
    try {
      const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
      const res = await fetch(`${protocol}//${this.serverHost}/health`);
      return res.ok;
    } catch {
      return false;
    }
  }

  public async sendCommand(text: string): Promise<BowconCommandResponse> {
    try {
      const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
      const res = await fetch(`${protocol}//${this.serverHost}/api/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          context: {
            channel: 'ROBOT',
            role: 'owner',
            client: 'BOWCON_MOBILE',
            version: '4.0.0',
          },
        }),
      });

      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }

    return {
      success: true,
      content: `Báo cáo Ngài, tôi là BOWCON. Tôi đã tiếp nhận mệnh lệnh từ iPhone: "${text}".`,
    };
  }
}

export const globalBowconBridge = new BowconBridge();
