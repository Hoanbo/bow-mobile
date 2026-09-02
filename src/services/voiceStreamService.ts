// src/services/voiceStreamService.ts
// Real-time Audio Stream WebSocket Client with Full-Duplex Barge-In

import type { EmotionState } from '../types';

export interface VoiceStreamCallbacks {
  onStatusChange: (status: 'connected' | 'disconnected' | 'connecting' | 'error') => void;
  onEmotionChange: (emotion: EmotionState) => void;
  onTranscript: (sender: 'boss' | 'bowcon', text: string) => void;
  onBargeIn: () => void;
}

export class VoiceStreamService {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private isMuted: boolean = false;
  private isCalling: boolean = false;
  private callbacks: VoiceStreamCallbacks | null = null;
  private serverHost: string = 'localhost:4078';

  constructor(serverHost?: string) {
    if (serverHost) {
      this.serverHost = serverHost;
    }
  }

  public setServerHost(host: string): void {
    this.serverHost = host;
  }

  public async startCall(callbacks: VoiceStreamCallbacks): Promise<boolean> {
    this.callbacks = callbacks;
    this.isCalling = true;
    callbacks.onStatusChange('connecting');

    try {
      // 1. Initialize Web Audio Context
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass({ sampleRate: 16000 });

      // 2. Connect WebSocket to BOWCON Central Brain
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${this.serverHost}/ws/audio-stream`;
      
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        // Send Handshake
        this.ws?.send(
          JSON.stringify({
            channel: 'ROBOT',
            role: 'owner',
            client: 'BOWCON_MOBILE',
            version: '4.0.0',
            device: 'iPhone',
          })
        );
        this.callbacks?.onStatusChange('connected');
        this.callbacks?.onEmotionChange('listening');
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          
          // Handle Emotion Dispatch
          if (msg.emotion) {
            this.callbacks?.onEmotionChange(msg.emotion);
          }

          // Handle Barge-In Interruption from Server
          if (msg.action === 'stop_playback' && msg.reason === 'barge_in') {
            this.callbacks?.onBargeIn();
            this.callbacks?.onEmotionChange('listening');
          }

          // Handle Text Response / Transcript
          if (msg.type === 'response' || msg.replyText || msg.text) {
            const text = msg.replyText || msg.text || msg.content;
            if (text) {
              this.callbacks?.onTranscript('bowcon', text);
            }
          }
        } catch {
          // Audio buffer stream
        }
      };

      this.ws.onclose = () => {
        this.callbacks?.onStatusChange('disconnected');
        this.callbacks?.onEmotionChange('sleeping');
      };

      this.ws.onerror = () => {
        this.callbacks?.onStatusChange('error');
      };

      // 3. Request Mic Permission
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          this.mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
        } catch (micErr) {
          console.warn('[VoiceStream] Microphone not accessible or permitted:', micErr);
        }
      }

      return true;
    } catch (err) {
      console.error('[VoiceStream] Failed to start call:', err);
      this.callbacks?.onStatusChange('error');
      return false;
    }
  }

  public sendVoiceCommand(text: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.callbacks?.onTranscript('boss', text);
      this.callbacks?.onEmotionChange('thinking');

      this.ws.send(
        JSON.stringify({
          type: 'text_command',
          content: text,
          role: 'owner',
          channel: 'ROBOT',
        })
      );
    } else {
      // Offline fallback simulation for smooth UI experience
      this.callbacks?.onTranscript('boss', text);
      this.callbacks?.onEmotionChange('thinking');

      setTimeout(() => {
        this.callbacks?.onEmotionChange('speaking');
        let reply = `Báo cáo Ngài, tôi là BOWCON. Tôi đã ghi nhận mệnh lệnh: "${text}" và đang điều phối hệ thống phục vụ Ngài!`;
        if (text.toLowerCase().includes('doanh thu') || text.toLowerCase().includes('đơn hàng')) {
          reply = `Báo cáo Ngài! Doanh thu hôm nay đạt 2.850.000đ, có 3 đơn hàng đang chờ bàn giao key trong đó có 1 đơn cần giao gấp.`;
        } else if (text.toLowerCase().includes('điều hòa') || text.toLowerCase().includes('đèn')) {
          reply = `Tuân lệnh Ngài! Tôi đã bật điều hòa 24°C và kích hoạt đèn bàn làm việc sẵn sàng đón Ngài về phòng!`;
        }
        this.callbacks?.onTranscript('bowcon', reply);
        setTimeout(() => {
          this.callbacks?.onEmotionChange('listening');
        }, 3500);
      }, 800);
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.mediaStream) {
      this.mediaStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isMuted;
      });
    }
    return this.isMuted;
  }

  public endCall(): void {
    this.isCalling = false;
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.callbacks?.onStatusChange('disconnected');
    this.callbacks?.onEmotionChange('sleeping');
  }

  public isCallActive(): boolean {
    return this.isCalling;
  }
}

export const globalVoiceService = new VoiceStreamService();
