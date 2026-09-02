// src/components/LiveVoiceCall.tsx
// Fullscreen Immersive Voice Call Experience for iPhone

import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  PhoneOff, 
  Volume2, 
  Sparkles, 
  Radio, 
  Send,
  Zap,
  Activity,
  Bot
} from 'lucide-react';
import { OledEyesVisualizer } from './OledEyesVisualizer';
import { globalVoiceService } from '../services/voiceStreamService';
import type { EmotionState, MessageTranscript } from '../types';

interface Props {
  onEndCall: () => void;
}

export const LiveVoiceCall: React.FC<Props> = ({ onEndCall }) => {
  const [emotion, setEmotion] = useState<EmotionState>('listening');
  const [callDuration, setCallDuration] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [textInput, setTextInput] = useState<string>('');
  const [transcripts, setTranscripts] = useState<MessageTranscript[]>([
    {
      id: 'welcome',
      sender: 'bowcon',
      text: 'Kính chào Ngài! Tôi là BOWCON. Hệ thống kết nối thoại thời gian thực đã sẵn sàng, tôi đang lắng nghe Ngài!',
      timestamp: '00:00',
    },
  ]);
  const [statusText, setStatusText] = useState<string>('Đang đàm thoại trực tiếp');
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Timer counter
  useEffect(() => {
    const timer = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Connect Voice Service
  useEffect(() => {
    globalVoiceService.startCall({
      onStatusChange: (status) => {
        if (status === 'connected') setStatusText('Đang đàm thoại trực tiếp');
        if (status === 'connecting') setStatusText('Đang bắt tay máy chủ...');
        if (status === 'disconnected') setStatusText('Đã ngắt kết nối thoại');
        if (status === 'error') setStatusText('Chế độ thoại ngoại tuyến');
      },
      onEmotionChange: (emo) => setEmotion(emo),
      onTranscript: (sender, text) => {
        setTranscripts((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            sender,
            text,
            timestamp: formatTime(callDuration),
          },
        ]);
      },
      onBargeIn: () => {
        setStatusText('⚡ Ngài đã ngắt lời — BOWCON đang nghe!');
        setTimeout(() => setStatusText('Đang đàm thoại trực tiếp'), 2000);
      },
    });

    return () => {
      // Don't terminate on unmount unless explicit
    };
  }, []);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  const handleSendPrompt = (promptText: string) => {
    globalVoiceService.sendVoiceCommand(promptText);
  };

  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    globalVoiceService.sendVoiceCommand(textInput);
    setTextInput('');
  };

  const handleToggleMute = () => {
    const muted = globalVoiceService.toggleMute();
    setIsMuted(muted);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between bg-[#07090e] text-slate-100 px-4 pt-12 pb-8 overflow-hidden select-none">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* TOP BAR: Call Status & Time */}
      <div className="relative z-10 flex items-center justify-between px-2">
        <div className="flex items-center gap-2.5">
          <img
            src="/bowcon-logo.png"
            alt="BOWCON"
            className="w-9 h-9 rounded-xl border border-cyan-500/40 shadow-sm object-cover"
          />
          <div>
            <h1 className="text-base font-bold tracking-wider text-white flex items-center gap-1.5">
              BOWCON V4.0
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            </h1>
            <p className="text-xs text-cyan-400/80 font-mono">{statusText}</p>
          </div>
        </div>

        {/* Call Timer Badge */}
        <div className="px-3 py-1 rounded-full bg-slate-900/80 border border-cyan-500/20 text-xs font-mono text-slate-300 flex items-center gap-1.5 shadow-lg">
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
          {formatTime(callDuration)}
        </div>
      </div>

      {/* CENTER: GRAND OLED EYES & PULSE RINGS */}
      <div className="relative z-10 flex flex-col items-center justify-center my-auto py-4">
        {/* Radiating Sound Rings when listening or speaking */}
        {(emotion === 'listening' || emotion === 'speaking') && (
          <div className="absolute w-72 h-72 pointer-events-none flex items-center justify-center">
            <div className="sound-ring w-64 h-64" />
            <div className="sound-ring w-80 h-80" />
            <div className="sound-ring w-96 h-96" />
          </div>
        )}

        {/* OLED Eyes Screen */}
        <div className="relative">
          <OledEyesVisualizer emotion={emotion} size="lg" onTap={() => {
            // Cycle emotion on tap for delightful micro-interaction
            const order: EmotionState[] = ['happy', 'listening', 'thinking', 'speaking', 'sleeping'];
            const next = order[(order.indexOf(emotion) + 1) % order.length];
            setEmotion(next);
          }} />
          <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-400 font-mono">
            <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>Mắt cảm xúc: <strong className="text-cyan-300 uppercase">{emotion}</strong></span>
          </div>
        </div>

        {/* Quick Voice Prompt Shortcuts */}
        <div className="mt-6 flex flex-wrap justify-center gap-2 max-w-xs">
          <button
            onClick={() => handleSendPrompt('Báo cáo doanh thu và đơn hàng hôm nay')}
            className="px-3 py-1.5 rounded-full bg-slate-800/80 border border-cyan-500/30 text-xs text-cyan-200 hover:bg-cyan-500/20 transition-all active:scale-95 flex items-center gap-1"
          >
            <Zap className="w-3 h-3 text-amber-400" />
            Doanh thu hôm nay
          </button>
          <button
            onClick={() => handleSendPrompt('Bật điều hòa 24 độ và bật đèn bàn làm việc')}
            className="px-3 py-1.5 rounded-full bg-slate-800/80 border border-cyan-500/30 text-xs text-cyan-200 hover:bg-cyan-500/20 transition-all active:scale-95 flex items-center gap-1"
          >
            <Zap className="w-3 h-3 text-cyan-400" />
            Bật điều hòa 24°C
          </button>
          <button
            onClick={() => handleSendPrompt('Kiểm tra hàng đợi bàn giao đơn hàng gấp')}
            className="px-3 py-1.5 rounded-full bg-slate-800/80 border border-cyan-500/30 text-xs text-cyan-200 hover:bg-cyan-500/20 transition-all active:scale-95 flex items-center gap-1"
          >
            <Bot className="w-3 h-3 text-emerald-400" />
            Đơn chờ bàn giao
          </button>
        </div>
      </div>

      {/* LIVE TRANSCRIPT CONSOLE */}
      <div className="relative z-10 w-full max-h-36 overflow-y-auto mb-4 px-3 py-2.5 rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-md shadow-inner text-xs space-y-2">
        {transcripts.map((t) => (
          <div
            key={t.id}
            className={`flex flex-col ${t.sender === 'boss' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[85%] px-3 py-1.5 rounded-xl ${
                t.sender === 'boss'
                  ? 'bg-cyan-500/20 text-cyan-100 border border-cyan-500/30 rounded-br-none'
                  : 'bg-slate-800/80 text-slate-200 border border-slate-700/50 rounded-bl-none'
              }`}
            >
              <div className="text-[10px] text-slate-400 mb-0.5 font-mono">
                {t.sender === 'boss' ? '👑 Ngài' : '🤖 BOWCON'} • {t.timestamp}
              </div>
              <p className="leading-relaxed text-[12px]">{t.text}</p>
            </div>
          </div>
        ))}
        <div ref={transcriptEndRef} />
      </div>

      {/* TEXT INPUT BAR (FOR NOISY ENVIRONMENTS) */}
      <form onSubmit={handleInputSubmit} className="relative z-10 flex items-center gap-2 mb-4">
        <input
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="Nói hoặc nhập lệnh gửi BOWCON..."
          className="flex-1 bg-slate-900/90 border border-cyan-500/30 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
        />
        <button
          type="submit"
          className="p-2 rounded-xl bg-cyan-500 text-slate-950 hover:bg-cyan-400 active:scale-95 transition-all shadow-md"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      {/* BOTTOM CONTROLS: MUTE, SPEAKER, END CALL */}
      <div className="relative z-10 flex items-center justify-around px-6 pt-2 border-t border-slate-800/60">
        {/* Mute Mic Button */}
        <button
          onClick={handleToggleMute}
          className={`p-3.5 rounded-2xl flex flex-col items-center gap-1 transition-all active:scale-90 ${
            isMuted
              ? 'bg-rose-500/20 border border-rose-500/40 text-rose-400'
              : 'bg-slate-800/70 border border-slate-700/60 text-slate-200'
          }`}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          <span className="text-[10px] font-medium">{isMuted ? 'Đã tắt mic' : 'Mic bật'}</span>
        </button>

        {/* END CALL BUTTON */}
        <button
          onClick={() => {
            globalVoiceService.endCall();
            onEndCall();
          }}
          className="p-4 rounded-full bg-rose-600 text-white shadow-lg shadow-rose-600/40 hover:bg-rose-500 active:scale-90 transition-all flex items-center justify-center"
          title="Kết thúc cuộc gọi"
        >
          <PhoneOff className="w-7 h-7" />
        </button>

        {/* Audio Output Button */}
        <button
          onClick={() => {
            // Speaker toggle
          }}
          className="p-3.5 rounded-2xl bg-slate-800/70 border border-slate-700/60 text-slate-200 flex flex-col items-center gap-1 transition-all active:scale-90"
        >
          <Volume2 className="w-5 h-5 text-cyan-400" />
          <span className="text-[10px] font-medium">Loa thoại</span>
        </button>
      </div>
    </div>
  );
};
