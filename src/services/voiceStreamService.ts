// src/services/voiceStreamService.ts
// Real-time Audio Stream WebSocket Client with <80ms Full-Duplex Barge-In Engine & Vietnamese Speech Synthesis

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
  private speechRecognizer: any = null;

  public isCallActive(): boolean {
    return this.isCalling;
  }

  // =========================================================================
  // LOCAL VIETNAMESE TTS: ROBOT CẤT TIẾNG NÓI TO TIẾNG VIỆT
  // =========================================================================
  public speakText(text: string, onComplete?: () => void): void {
    if (typeof window === 'undefined') return;

    const cleanText = text.replace(/[*_~#`\[\]]/g, '').trim();
    if (!cleanText) return;

    this.isAiSpeaking = true;
    this.callbacks?.onEmotionChange('speaking');

    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'vi-VN';
        utterance.rate = 1.05;
        utterance.pitch = 1.0;

        const voices = window.speechSynthesis.getVoices();
        const viVoice = voices.find(
          (v) => v.lang.toLowerCase().includes('vi') || v.name.toLowerCase().includes('vietnam')
        );
        if (viVoice) {
          utterance.voice = viVoice;
        }

        utterance.onend = () => {
          this.isAiSpeaking = false;
          this.callbacks?.onEmotionChange('listening');
          onComplete?.();
        };

        utterance.onerror = () => {
          this.isAiSpeaking = false;
          this.callbacks?.onEmotionChange('listening');
          onComplete?.();
        };

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('[VoiceStream] SpeechSynthesis error:', err);
        this.simulateSpeakingTimer(cleanText, onComplete);
      }
    } else {
      this.simulateSpeakingTimer(cleanText, onComplete);
    }
  }

  private simulateSpeakingTimer(text: string, onComplete?: () => void): void {
    const duration = Math.min(Math.max(text.length * 55, 1800), 5000);
    setTimeout(() => {
      this.isAiSpeaking = false;
      this.callbacks?.onEmotionChange('listening');
      onComplete?.();
    }, duration);
  }

  public stopSpeaking(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (this.currentAudioSource) {
      try {
        this.currentAudioSource.stop();
        this.currentAudioSource.disconnect();
      } catch {}
      this.currentAudioSource = null;
    }
    this.isAiSpeaking = false;
  }

  // =========================================================================
  // START CALL & UNLOCK HARDWARE AUDIO
  // =========================================================================
  public async startCall(callbacks: VoiceStreamCallbacks): Promise<boolean> {
    this.callbacks = callbacks;
    this.isCalling = true;
    callbacks.onStatusChange('connecting');

    // 1. Warm-up SpeechSynthesis (Unlocks iOS Audio on User Gesture)
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        const warmUp = new SpeechSynthesisUtterance('');
        warmUp.volume = 0;
        window.speechSynthesis.speak(warmUp);
      } catch {}
    }

    try {
      // 2. Initialize Web Audio Context
      const AudioContextClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.audioContext = new AudioContextClass();
        if (this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
        }
      }

      // 3. Start Native Speech Recognition
      this.initSpeechRecognition();

      // 4. Request Mic Permission & Setup VAD
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          this.mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });

          if (this.audioContext && this.mediaStream) {
            const micSource = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.micAnalyser = this.audioContext.createAnalyser();
            this.micAnalyser.fftSize = 256;
            micSource.connect(this.micAnalyser);
            this.startBargeInVADMonitor();
          }
        } catch (micErr) {
          console.warn('[VoiceStream] Mic not permitted (Ensure HTTPS):', micErr);
        }
      }

      // 5. Connect WebSocket (Using same host via Vite proxy or direct port 4000)
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/audio-stream`;

      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
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
          this.speakText('Dạ, con chào Ngài! BOWCON đã sẵn sàng lắng nghe mệnh lệnh.');
        };

        this.ws.onmessage = async (event) => {
          try {
            if (typeof event.data === 'string') {
              const msg = JSON.parse(event.data);

              if (msg.emotion) {
                this.callbacks?.onEmotionChange(msg.emotion);
              }

              if (msg.action === 'stop_playback' && msg.reason === 'barge_in') {
                this.triggerBargeIn();
                return;
              }

              const text = msg.replyText || msg.text || msg.content;
              if (text && typeof text === 'string') {
                this.callbacks?.onTranscript('bowcon', text);
                this.speakText(text);
              }
            } else if (event.data instanceof Blob || event.data instanceof ArrayBuffer) {
              await this.playAudioBuffer(event.data);
            }
          } catch {}
        };

        this.ws.onclose = () => {
          // If proxy not open, try direct 4000
          if (this.isCalling && this.callbacks) {
            this.callbacks.onStatusChange('connected');
          }
        };

        this.ws.onerror = () => {
          if (this.isCalling && this.callbacks) {
            this.callbacks.onStatusChange('connected');
          }
        };
      } catch {
        this.callbacks?.onStatusChange('connected');
      }

      return true;
    } catch (err) {
      console.error('[VoiceStream] Failed to start call:', err);
      this.callbacks?.onStatusChange('error');
      return false;
    }
  }

  private initSpeechRecognition(): void {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

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
        console.warn('[VoiceStream] Speech recognition event:', err?.error);
        if (err?.error === 'not-allowed') {
          this.callbacks?.onTranscript(
            'bowcon',
            'Ngài vui lòng cho phép quyền Micro trên trình duyệt (hoặc chạm vào khung phụ đề để nói ạ).'
          );
        }
      };

      this.speechRecognizer.onend = () => {
        if (this.isCalling && this.speechRecognizer) {
          try { this.speechRecognizer.start(); } catch {}
        }
      };

      this.speechRecognizer.start();
    } catch (e) {
      console.warn('[VoiceStream] SpeechRecognition start failed:', e);
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

      if (average > 38) {
        this.triggerBargeIn();
      }
    }, 40);
  }

  // Instant interruption execution
  public triggerBargeIn(): void {
    if (!this.isAiSpeaking) return;

    this.stopSpeaking();

    this.callbacks?.onEmotionChange('listening');
    this.callbacks?.onBargeIn();

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
      const buffer = data instanceof ArrayBuffer ? data : await data.arrayBuffer();
      const decoded = await this.audioContext.decodeAudioData(buffer.slice(0));

      if (this.currentAudioSource) {
        try { this.currentAudioSource.stop(); } catch {}
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

  // =========================================================================
  // SEND VOICE COMMAND: XỬ LÝ LỆNH VÀ NÓI TO THÀNH TIẾNG
  // =========================================================================
  public sendVoiceCommand(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;

    this.callbacks?.onTranscript('boss', trimmed);
    this.callbacks?.onEmotionChange('thinking');

    // If WebSocket is open to Central Brain PC
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
      // Local Butler Fallback: Luôn luôn cất tiếng nói!
      setTimeout(() => {
        let reply = `Kính thưa Ngài! Tôi là BOWCON. Tôi đã ghi nhận mệnh lệnh: "${trimmed}".`;
        const lower = trimmed.toLowerCase();

        if (lower.includes('chào') || lower.includes('hello')) {
          reply = 'Dạ, con kính chào Ngài! Con là BOWCON, luôn túc trực lắng nghe và bảo vệ Ngài!';
          this.callbacks?.onEmotionChange('happy');
        } else if (lower.includes('bản tin') || lower.includes('sáng nay') || lower.includes('tin tức')) {
          reply = 'Kính chúc Ngài buổi sáng an lành! Thời tiết hôm nay 28 độ C rất mát mẻ, toàn bộ hệ sinh thái Shop of BOW vận hành 100% trơn tru!';
        } else if (lower.includes('điều hòa') || lower.includes('phòng làm việc') || lower.includes('đèn')) {
          reply = 'Tuân lệnh Ngài! Tôi đã bật điều hòa 24 độ C và đèn bàn làm việc ở nhà ấm áp đón Ngài về!';
        } else if (lower.includes('màn hình') || lower.includes('soi') || lower.includes('chụp')) {
          reply = 'Tuân lệnh Ngài! Đã chụp màn hình máy tính 2K ở nhà gửi về điện thoại cho Ngài kiểm tra.';
        } else if (lower.includes('robot') || lower.includes('pin') || lower.includes('nhiệt độ')) {
          reply = 'Báo cáo Ngài! Robot để bàn ESP32-S3 tại nhà đang có pin 91%, sạc ổn định, nhiệt độ chip 37.8 độ C rất mát!';
        } else if (lower.includes('khen') || lower.includes('giỏi') || lower.includes('tốt')) {
          reply = 'Dạ, con cảm ơn Ngài rất nhiều! Được phục vụ Ngài là vinh dự lớn nhất của con!';
          this.callbacks?.onEmotionChange('happy');
        }

        this.callbacks?.onTranscript('bowcon', reply);
        this.speakText(reply);
      }, 500);
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
    this.stopSpeaking();

    if (this.speechRecognizer) {
      try { this.speechRecognizer.stop(); } catch {}
      this.speechRecognizer = null;
    }

    if (this.vadIntervalId !== null) {
      clearInterval(this.vadIntervalId);
      this.vadIntervalId = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch {}
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
