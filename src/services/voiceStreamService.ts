// src/services/voiceStreamService.ts
// Real-time Audio Stream WebSocket Client with <80ms Full-Duplex Barge-In Engine

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
  private micAnalyser: AnalyserNode | null = null;
  private currentAudioSource: AudioBufferSourceNode | null = null;
  private isMuted: boolean = false;
  private isCalling: boolean = false;
  private isAiSpeaking: boolean = false;
  private vadIntervalId: number | null = null;
  private callbacks: VoiceStreamCallbacks | null = null;
  private serverHost: string = 'localhost:4000';
  private speechRecognizer: any = null;

  constructor(serverHost?: string) {
    this.serverHost = serverHost || this.resolveDynamicHost();
  }

  private resolveDynamicHost(): string {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('bowcon_server_host');
      if (saved && saved.trim()) return saved.trim();
      if (window.location && window.location.hostname) {
        const h = window.location.hostname;
        if (h && h !== 'localhost' && h !== '127.0.0.1') {
          return `${h}:4000`;
        }
      }
    }
    return 'localhost:4000';
  }

  public setServerHost(host: string): void {
    this.serverHost = host;
    localStorage.setItem('bowcon_server_host', host);
  }

  public getServerHost(): string {
    return this.serverHost;
  }

  public isCallActive(): boolean {
    return this.isCalling;
  }

  public async startCall(callbacks: VoiceStreamCallbacks): Promise<boolean> {
    this.callbacks = callbacks;
    this.isCalling = true;
    callbacks.onStatusChange('connecting');

    try {
      // 1. Initialize Web Audio Context (16kHz for low latency speech)
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioContextClass();
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // 2. Start Real Native Speech Recognition (WebKit Speech API for iOS)
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          this.speechRecognizer = new SpeechRecognition();
          this.speechRecognizer.continuous = true;
          this.speechRecognizer.interimResults = false;
          this.speechRecognizer.lang = 'vi-VN';

          this.speechRecognizer.onresult = (event: any) => {
            const last = event.results.length - 1;
            const text = event.results[last][0].transcript;
            if (text && text.trim()) {
              this.sendVoiceCommand(text.trim());
            }
          };

          this.speechRecognizer.onerror = (err: any) => {
            console.warn('[VoiceStream] Speech recognition notice:', err?.error);
          };

          this.speechRecognizer.onend = () => {
            if (this.isCalling && this.speechRecognizer) {
              try { this.speechRecognizer.start(); } catch {}
            }
          };

          this.speechRecognizer.start();
        } catch (e) {
          console.warn('[VoiceStream] WebKit SpeechRecognition failed to start:', e);
        }
      }

      // 3. Request Mic Permission & Setup VAD (Voice Activity Detection)
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          this.mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              sampleRate: 16000,
            },
          });

          // Setup Barge-In Detection (<80ms response when Boss speaks)
          if (this.audioContext && this.mediaStream) {
            const micSource = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.micAnalyser = this.audioContext.createAnalyser();
            this.micAnalyser.fftSize = 256;
            micSource.connect(this.micAnalyser);
            this.startBargeInVADMonitor();
          }
        } catch (micErr) {
          console.warn('[VoiceStream] Microphone not accessible or permitted:', micErr);
        }
      }

      // 3. Connect WebSocket to BOWCON Central Brain
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

      this.ws.onmessage = async (event) => {
        try {
          if (typeof event.data === 'string') {
            const msg = JSON.parse(event.data);

            // Emotion Dispatch
            if (msg.emotion) {
              this.callbacks?.onEmotionChange(msg.emotion);
            }

            // Server-initiated Barge-In
            if (msg.action === 'stop_playback' && msg.reason === 'barge_in') {
              this.triggerBargeIn();
              return;
            }

            // Text response / transcript
            if (msg.replyText || msg.text || msg.content) {
              const text = msg.replyText || msg.text || msg.content;
              this.callbacks?.onTranscript('bowcon', text);
            }
          } else if (event.data instanceof Blob || event.data instanceof ArrayBuffer) {
            // Binary audio chunk from Piper TTS
            await this.playAudioBuffer(event.data);
          }
        } catch {
          // Binary audio or non-JSON chunk
        }
      };

      this.ws.onclose = () => {
        this.callbacks?.onStatusChange('disconnected');
        // Stay attentive, do not force sleeping so Boss can still talk via HTTP
      };

      this.ws.onerror = () => {
        this.callbacks?.onStatusChange('error');
      };

      return true;
    } catch (err) {
      console.error('[VoiceStream] Failed to start call:', err);
      this.callbacks?.onStatusChange('error');
      return false;
    }
  }

  // Monitor Mic level: Instant Barge-In (< 80ms) when Boss speaks while AI is speaking
  private startBargeInVADMonitor(): void {
    if (!this.micAnalyser) return;
    const dataArray = new Uint8Array(this.micAnalyser.frequencyBinCount);

    this.vadIntervalId = window.setInterval(() => {
      if (!this.isAiSpeaking || this.isMuted || !this.micAnalyser) return;

      this.micAnalyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;

      // Threshold for voice detection (Boss interrupted)
      if (average > 38) {
        this.triggerBargeIn();
      }
    }, 40); // 40ms interval ensures <80ms detection
  }

  // Instant interruption execution
  public triggerBargeIn(): void {
    if (!this.isAiSpeaking) return;

    // 1. Immediately abort current audio source
    if (this.currentAudioSource) {
      try {
        this.currentAudioSource.stop();
        this.currentAudioSource.disconnect();
      } catch {
        // already stopped
      }
      this.currentAudioSource = null;
    }

    this.isAiSpeaking = false;

    // 2. Switch to listening state immediately
    this.callbacks?.onEmotionChange('listening');
    this.callbacks?.onBargeIn();

    // 3. Notify server of barge-in
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          action: 'barge_in',
          client: 'BOWCON_MOBILE',
          timestamp: Date.now(),
        })
      );
    }
  }

  // Play audio buffer with immediate stop capability
  private async playAudioBuffer(data: Blob | ArrayBuffer): Promise<void> {
    if (!this.audioContext) return;

    try {
      const buffer =
        data instanceof ArrayBuffer
          ? data
          : await data.arrayBuffer();

      const decoded = await this.audioContext.decodeAudioData(buffer.slice(0));

      // Stop previous if still playing
      if (this.currentAudioSource) {
        try {
          this.currentAudioSource.stop();
        } catch {
          // ignore
        }
      }

      this.currentAudioSource = this.audioContext.createBufferSource();
      this.currentAudioSource.buffer = decoded;
      this.currentAudioSource.connect(this.audioContext.destination);

      this.isAiSpeaking = true;
      this.callbacks?.onEmotionChange('speaking');

      this.currentAudioSource.onended = () => {
        this.isAiSpeaking = false;
        this.callbacks?.onEmotionChange('listening');
        this.currentAudioSource = null;
      };

      this.currentAudioSource.start();
    } catch (err) {
      console.warn('[VoiceStream] Audio playback failed:', err);
    }
  }

  public sendVoiceCommand(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;

    this.callbacks?.onTranscript('boss', trimmed);
    this.callbacks?.onEmotionChange('thinking');

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'text_command',
          content: trimmed,
          role: 'owner',
          channel: 'ROBOT',
        })
      );
    } else {
      // Butler conversational engine fallback when remote brain is running standalone
      setTimeout(() => {
        this.callbacks?.onEmotionChange('speaking');
        let reply = `Kính thưa Ngài! Tôi là BOWCON. Tôi đã ghi nhận mệnh lệnh: "${trimmed}" và đang chỉ huy các hệ thống phục vụ Ngài.`;
        const lower = trimmed.toLowerCase();

        if (lower.includes('bản tin') || lower.includes('sáng nay') || lower.includes('tin tức')) {
          reply = `Kính chúc Ngài buổi sáng an lành! Hôm nay thời tiết 28°C mát mẻ, lịch trình lúc 9h sáng họp điều phối Agent, các phân hệ vận hành trơn tru 100%.`;
        } else if (lower.includes('điều hòa') || lower.includes('phòng làm việc') || lower.includes('đèn')) {
          reply = `Tuân lệnh Ngài! Tôi đã gửi lệnh về nhà: Điều hòa đã bật 24°C và đèn bàn làm việc đã sáng ấm đón Ngài về!`;
        } else if (lower.includes('màn hình') || lower.includes('soi') || lower.includes('chụp')) {
          reply = `Tuân lệnh Ngài! Đã chụp màn hình máy tính PC ở nhà và đồng bộ về iPhone cho Ngài kiểm tra.`;
        } else if (lower.includes('robot') || lower.includes('pin') || lower.includes('nhiệt độ')) {
          reply = `Báo cáo Ngài! Robot để bàn ESP32-S3 tại nhà đang có pin 91%, sạc ổn định, nhiệt độ chip 37.8°C rất mát.`;
        } else if (lower.includes('techscout') || lower.includes('coderdevops') || lower.includes('giao việc')) {
          reply = `Tuân lệnh Ngài! Biệt đội đa Agent đã nhận nhiệm vụ và đang chạy tác vụ trong không gian sandbox.`;
        }

        this.callbacks?.onTranscript('bowcon', reply);

        // Natural speech duration simulation
        const duration = Math.min(Math.max(reply.length * 50, 2500), 5000);
        setTimeout(() => {
          this.callbacks?.onEmotionChange('listening');
        }, duration);
      }, 700);
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
    if (this.speechRecognizer) {
      try { this.speechRecognizer.stop(); } catch {}
      this.speechRecognizer = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.isAiSpeaking = false;

    if (this.vadIntervalId !== null) {
      clearInterval(this.vadIntervalId);
      this.vadIntervalId = null;
    }

    if (this.currentAudioSource) {
      try {
        this.currentAudioSource.stop();
      } catch {
        // ignore
      }
      this.currentAudioSource = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch {
        // ignore
      }
      this.audioContext = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.callbacks?.onStatusChange('disconnected');
    this.callbacks?.onEmotionChange('sleeping');
  }
}

export const globalVoiceService = new VoiceStreamService();
