// src/App.tsx
// BOWCON Mobile V4.0 — All-In-One Single Screen Embodied Robot Companion & Butler

import { useState, useEffect, useRef } from 'react';
import {
  Settings,
  Sparkles,
  Mic,
  PhoneOff,
  Sun,
  Wind,
  Monitor,
  Bot,
  Zap,
  Play,
  CheckCircle2,
  RefreshCw,
  Bell,
  X,
  BatteryCharging,
  Thermometer,
  Cpu,
} from 'lucide-react';
import { OledEyesVisualizer } from './components/OledEyesVisualizer';
import { ConnectionSettingsModal } from './components/ConnectionSettingsModal';
import { globalVoiceService } from './services/voiceStreamService';
import { globalBowconBridge } from './services/bowconBridge';
import type {
  EmotionState,
  MessageTranscript,
  ScreenCaptureResult,
  MorningBriefing,
  RobotTelemetry,
} from './types';

export function App() {
  // State Management
  const [emotion, setEmotion] = useState<EmotionState>('listening');
  const [isCalling, setIsCalling] = useState<boolean>(false);
  const [callDuration, setCallDuration] = useState<number>(0);
  const [bargeInNotice, setBargeInNotice] = useState<boolean>(false);
  const [voiceStatusText, setVoiceStatusText] = useState<string>('Sẵn sàng tiếp lệnh Ngài');

  // Transcripts for Live Subtitles
  const [transcripts, setTranscripts] = useState<MessageTranscript[]>([
    {
      id: 'welcome',
      sender: 'bowcon',
      text: 'Kính chào Ngài! Tôi là BOWCON. Tôi luôn túc trực lắng nghe mệnh lệnh của Ngài!',
      timestamp: '00:00',
    },
  ]);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [briefingModal, setBriefingModal] = useState<MorningBriefing | null>(null);
  const [screenshotModal, setScreenshotModal] = useState<ScreenCaptureResult | null>(null);
  const [telemetryModal, setTelemetryModal] = useState<RobotTelemetry | null>(null);

  // Action loading states
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [isRinging, setIsRinging] = useState<boolean>(false);
  const [toastText, setToastText] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastText(msg);
    setTimeout(() => setToastText(null), 3000);
  };

  // Timer counter for voice call
  useEffect(() => {
    if (!isCalling) return;
    const timer = window.setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, [isCalling]);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Auto-scroll transcript box
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts, bargeInNotice]);

  // Toggle Hands-Free Voice Call
  const handleToggleVoiceCall = async () => {
    if (isCalling) {
      globalVoiceService.endCall();
      setIsCalling(false);
      setCallDuration(0);
      setEmotion('sleeping');
      setVoiceStatusText('Đã tạm dừng đàm thoại');
    } else {
      setIsCalling(true);
      setVoiceStatusText('Đang kết nối luồng đàm thoại...');

      await globalVoiceService.startCall({
        onStatusChange: (status) => {
          if (status === 'connected') setVoiceStatusText('Đang đàm thoại trực tiếp');
          if (status === 'connecting') setVoiceStatusText('Đang bắt tay máy chủ...');
          if (status === 'disconnected') setVoiceStatusText('Đã ngắt kết nối thoại');
          if (status === 'error') setVoiceStatusText('Chế độ thoại ngoại tuyến (Butler Standalone)');
        },
        onEmotionChange: (emo) => setEmotion(emo),
        onTranscript: (sender, text) => {
          setTranscripts((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              sender,
              text,
              timestamp: formatTimer(callDuration),
            },
          ]);
        },
        onBargeIn: () => {
          // Barge-in trigger (<80ms interruption)
          setBargeInNotice(true);
          setVoiceStatusText('⚡ Ngắt lời tức thì (<80ms) — Đang nghe Ngài!');
          setTimeout(() => setBargeInNotice(false), 2400);
        },
      });
    }
  };

  // 1. Phím Tắt: Bản Tin Sáng (get_morning_briefing)
  const handleActionBriefing = async () => {
    setEmotion('thinking');
    triggerToast('🌅 Đang tổng hợp Bản Tin Buổi Sáng...');
    const data = await globalBowconBridge.getMorningBriefing();
    setBriefingModal(data);
    setEmotion('speaking');
    setTranscripts((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        sender: 'bowcon',
        text: `Báo cáo Ngài! Hôm nay ${data.date}. ${data.weather}. Lịch trình: ${data.schedule.join(' • ')}`,
        timestamp: formatTimer(callDuration),
      },
    ]);
  };

  // 2. Phím Tắt: Bật Điều Hòa & Đèn (desktop_smarthome_control)
  const handleActionSmartHome = async () => {
    setEmotion('thinking');
    const res = await globalBowconBridge.controlSmartHome(true, true, 24);
    setEmotion('happy');
    triggerToast('❄️ Đã bật điều hòa 24°C & đèn bàn làm việc!');
    setTranscripts((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        sender: 'bowcon',
        text: res.message,
        timestamp: formatTimer(callDuration),
      },
    ]);
    setTimeout(() => setEmotion('listening'), 3000);
  };

  // 3. Phím Tắt: Soi PC Ở Nhà (desktop_capture_screenshot)
  const handleActionScreenshot = async (displayId: 1 | 2 = 2) => {
    setIsCapturing(true);
    setEmotion('thinking');
    triggerToast(`👁️ Đang chụp ảnh Màn ${displayId} máy tính PC ở nhà...`);
    const shot = await globalBowconBridge.captureScreenshot(displayId);
    setScreenshotModal(shot);
    setIsCapturing(false);
    setEmotion('listening');
    setTranscripts((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        sender: 'bowcon',
        text: `Đã chụp ảnh Màn ${displayId} (${shot.resolution}) máy tính PC ở nhà cho Ngài kiểm tra.`,
        timestamp: formatTimer(callDuration),
      },
    ]);
  };

  // 4. Phím Tắt: Thăm Dò Robot (robot_sensors_telemetry)
  const handleActionTelemetry = async () => {
    setEmotion('thinking');
    const telem = await globalBowconBridge.getRobotTelemetry();
    setTelemetryModal(telem);
    setEmotion('listening');
    setTranscripts((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        sender: 'bowcon',
        text: `Robot ESP32-S3 tại nhà: Pin ${telem.batteryPercent}%, ${telem.isCharging ? 'đang sạc' : 'dùng pin'}, nhiệt độ chip ${telem.temperatureCelsius}°C.`,
        timestamp: formatTimer(callDuration),
      },
    ]);
  };

  // Ring Bell for Robot
  const handleRingBell = async () => {
    setIsRinging(true);
    const res = await globalBowconBridge.ringRobotBell();
    triggerToast(`🔔 ${res.message}`);
    setTimeout(() => setIsRinging(false), 2000);
  };

  // Cycle Emotion on tap
  const handleTapEyes = () => {
    const sequence: EmotionState[] = ['happy', 'listening', 'thinking', 'speaking', 'sleeping'];
    const next = sequence[(sequence.indexOf(emotion) + 1) % sequence.length];
    setEmotion(next);
  };

  return (
    <div className="single-screen-app">
      {/* Toast Notification */}
      {toastText && (
        <div className="butler-toast">
          <Sparkles size={13} color="#00f2fe" />
          <span>{toastText}</span>
        </div>
      )}

      {/* ===================================================================
          1. HEADER TRÊN CÙNG: Logo 40px + BOWCON V4.0 + Online + Settings
          =================================================================== */}
      <header className="app-header">
        <div className="header-brand">
          <img
            src="/bowcon-logo.png"
            alt="BOWCON Logo"
            className="brand-logo-40"
          />
          <div className="brand-info">
            <div className="brand-title">
              <span>BOWCON</span>
              <span className="badge-v4">V4.0</span>
              <Sparkles size={12} color="#00f2fe" />
            </div>
            <div className="status-online-tag">
              <span className="status-dot-green" />
              <span>Online / Sẵn sàng</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsSettingsOpen(true)}
          className="btn-settings-gear"
          title="Cấu hình IP Server PC hoặc Cloudflare Tunnel"
        >
          <Settings size={17} />
        </button>
      </header>

      {/* ===================================================================
          2. GƯƠNG MẶT ROBOT OLED LỚN (CHIẾM TRUNG TÂM)
          =================================================================== */}
      <div className="oled-face-section">
        {/* Sound Wave Ripple Rings when speaking or listening */}
        {(emotion === 'listening' || emotion === 'speaking' || isCalling) && (
          <div className="sound-rings-layer">
            <div className="sound-ring-item" />
            <div className="sound-ring-item" />
            <div className="sound-ring-item" />
          </div>
        )}

        {/* OLED Eyes Screen */}
        <OledEyesVisualizer emotion={emotion} size="lg" onTap={handleTapEyes} />

        {/* Emotion status tag */}
        <div className="emotion-badge">
          <span className="dot" />
          <span>
            CẢM XÚC: <strong style={{ textTransform: 'uppercase' }}>{emotion}</strong>
          </span>
          {isCalling && (
            <span style={{ color: '#38bdf8', marginLeft: '4px' }}>• {formatTimer(callDuration)}</span>
          )}
        </div>
      </div>

      {/* ===================================================================
          3. KHUNG PHỤ ĐỀ NỔI TRỰC TIẾP (LIVE TRANSCRIPT BOX)
          =================================================================== */}
      <div className="live-transcript-box">
        {bargeInNotice && (
          <div className="barge-in-badge">
            <Zap size={11} />
            <span>Ngắt lời (&lt;80ms) — BOWCON đang nghe Ngài!</span>
          </div>
        )}

        {transcripts.map((t) => (
          <div
            key={t.id}
            className={`transcript-entry ${t.sender === 'boss' ? 'entry-boss' : 'entry-bowcon'}`}
          >
            <div className="entry-sender">
              {t.sender === 'boss' ? '👑 Ngài' : '🤖 BOWCON'} • {t.timestamp}
            </div>
            <div>{t.text}</div>
          </div>
        ))}
        <div ref={transcriptEndRef} />
      </div>

      {/* ===================================================================
          4. NÚT MICRO ĐÀM THOẠI TRỰC TIẾP (VOICE CALL BUTTON)
          =================================================================== */}
      <div className="voice-call-wrapper">
        <button
          onClick={handleToggleVoiceCall}
          className={`btn-voice-mic ${isCalling ? 'calling' : ''}`}
          title={isCalling ? 'Kết thúc cuộc gọi thoại' : 'Bật đàm thoại trực tiếp rảnh tay'}
        >
          {isCalling ? <PhoneOff size={28} /> : <Mic size={32} />}
        </button>

        <div className="voice-hint-text">
          {isCalling ? (
            <>
              <span className="status-dot-green" />
              <span>{voiceStatusText}</span>
            </>
          ) : (
            <span>Chạm micro để đàm thoại 2 chiều với BOWCON</span>
          )}
        </div>
      </div>

      {/* ===================================================================
          5. 4 PHÍM TẮT ĐẠI QUẢN GIA (1-CHẠM GỬI LỆNH VỀ NHÀ)
          =================================================================== */}
      <div className="butler-shortcuts-grid">
        {/* 1. Bản Tin Sáng */}
        <button onClick={handleActionBriefing} className="shortcut-btn">
          <div className="shortcut-icon-box box-amber">
            <Sun size={18} />
          </div>
          <div className="shortcut-text">
            <span className="shortcut-title">Bản Tin Sáng</span>
            <span className="shortcut-desc">Chào ngày mới & Lịch trình</span>
          </div>
        </button>

        {/* 2. Bật Điều Hòa & Đèn */}
        <button onClick={handleActionSmartHome} className="shortcut-btn">
          <div className="shortcut-icon-box box-cyan">
            <Wind size={18} />
          </div>
          <div className="shortcut-text">
            <span className="shortcut-title">Bật Điều Hòa & Đèn</span>
            <span className="shortcut-desc">24°C + Đèn bàn làm việc</span>
          </div>
        </button>

        {/* 3. Soi PC Ở Nhà */}
        <button onClick={() => handleActionScreenshot(2)} className="shortcut-btn">
          <div className="shortcut-icon-box box-blue">
            <Monitor size={18} />
          </div>
          <div className="shortcut-text">
            <span className="shortcut-title">Soi PC Ở Nhà</span>
            <span className="shortcut-desc">Chụp ảnh màn hình máy tính</span>
          </div>
        </button>

        {/* 4. Thăm Dò Robot */}
        <button onClick={handleActionTelemetry} className="shortcut-btn">
          <div className="shortcut-icon-box box-emerald">
            <Bot size={18} />
          </div>
          <div className="shortcut-text">
            <span className="shortcut-title">Thăm Dò Robot</span>
            <span className="shortcut-desc">Pin % & Chuông gọi bàn</span>
          </div>
        </button>
      </div>

      {/* ===================================================================
          POPUP MODAL 1: BẢN TIN SÁNG CHI TIẾT
          =================================================================== */}
      {briefingModal && (
        <div className="modal-overlay" onClick={() => setBriefingModal(null)}>
          <div className="modal-content-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <Sun size={17} color="#f59e0b" />
                <span>Bản Tin Buổi Sáng</span>
              </h3>
              <button onClick={() => setBriefingModal(null)} className="btn-close-modal">
                <X size={15} />
              </button>
            </div>

            <div style={{ fontSize: '11px', color: '#38bdf8', fontFamily: 'JetBrains Mono', marginBottom: '8px' }}>
              {briefingModal.date}
            </div>

            <div
              style={{
                background: 'rgba(0, 242, 254, 0.1)',
                border: '1px solid rgba(0, 242, 254, 0.25)',
                borderRadius: '12px',
                padding: '10px 12px',
                fontSize: '12px',
                color: '#e0f2fe',
                lineHeight: 1.45,
                marginBottom: '12px',
              }}
            >
              👑 {briefingModal.greeting}
            </div>

            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase' }}>
                Thời tiết
              </div>
              <p style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '2px' }}>{briefingModal.weather}</p>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase' }}>
                Lịch trình công việc
              </div>
              <ul style={{ paddingLeft: '16px', fontSize: '12px', color: '#cbd5e1', lineHeight: 1.45, marginTop: '2px' }}>
                {briefingModal.schedule.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', color: '#34d399', fontWeight: 700, textTransform: 'uppercase' }}>
                Tin công nghệ AI
              </div>
              <ul style={{ paddingLeft: '16px', fontSize: '12px', color: '#cbd5e1', lineHeight: 1.45, marginTop: '2px' }}>
                {briefingModal.aiNews.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>

            <button
              onClick={() => {
                setBriefingModal(null);
                triggerToast('Đang phát giọng đọc bản tin qua loa thoại...');
              }}
              className="btn-action-primary"
            >
              <Play size={14} />
              <span>Nghe Đọc Bản Tin Này</span>
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================
          POPUP MODAL 2: SOI MÀN HÌNH PC PHÓNG TO
          =================================================================== */}
      {screenshotModal && (
        <div className="modal-overlay" onClick={() => setScreenshotModal(null)}>
          <div className="modal-content-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <Monitor size={17} color="#38bdf8" />
                <span>
                  Ảnh Chụp Màn {screenshotModal.displayId} ({screenshotModal.resolution})
                </span>
              </h3>
              <button onClick={() => setScreenshotModal(null)} className="btn-close-modal">
                <X size={15} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <button
                onClick={() => handleActionScreenshot(2)}
                disabled={isCapturing}
                className={`btn-action-secondary ${screenshotModal.displayId === 2 ? 'active' : ''}`}
                style={{
                  background: screenshotModal.displayId === 2 ? 'rgba(0, 242, 254, 0.2)' : undefined,
                  borderColor: screenshotModal.displayId === 2 ? '#00f2fe' : undefined,
                }}
              >
                Màn 2 (Chính)
              </button>
              <button
                onClick={() => handleActionScreenshot(1)}
                disabled={isCapturing}
                className={`btn-action-secondary ${screenshotModal.displayId === 1 ? 'active' : ''}`}
                style={{
                  background: screenshotModal.displayId === 1 ? 'rgba(0, 242, 254, 0.2)' : undefined,
                  borderColor: screenshotModal.displayId === 1 ? '#00f2fe' : undefined,
                }}
              >
                Màn 1 (Phụ)
              </button>
            </div>

            <div className="screenshot-preview-wrapper">
              <img
                src={screenshotModal.imageUrl}
                alt="PC Screenshot"
                className="screenshot-preview-img"
              />
            </div>

            <div style={{ fontSize: '10.5px', color: '#94a3b8', fontFamily: 'JetBrains Mono', marginBottom: '8px' }}>
              Chụp lúc: {screenshotModal.timestamp} • {screenshotModal.note}
            </div>

            <div className="modal-actions">
              <button
                onClick={() => handleActionScreenshot(screenshotModal.displayId)}
                className="btn-action-secondary"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
              >
                <RefreshCw size={13} className={isCapturing ? 'animate-spin' : ''} />
                <span>Chụp Lại</span>
              </button>

              <button
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = screenshotModal.imageUrl;
                  link.download = `pc-screen-${screenshotModal.displayId}.png`;
                  link.click();
                  triggerToast('Đã lưu ảnh chụp về iPhone!');
                }}
                className="btn-action-primary"
                style={{ flex: 1 }}
              >
                <CheckCircle2 size={13} />
                <span>Lưu Về iPhone</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          POPUP MODAL 3: THĂM DÒ ROBOT ESP32-S3
          =================================================================== */}
      {telemetryModal && (
        <div className="modal-overlay" onClick={() => setTelemetryModal(null)}>
          <div className="modal-content-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <Bot size={17} color="#34d399" />
                <span>Robot Để Bàn Tại Nhà</span>
              </h3>
              <button onClick={() => setTelemetryModal(null)} className="btn-close-modal">
                <X size={15} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px' }}>
              <div style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '8px', textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', color: '#34d399', fontSize: '10px' }}>
                  <BatteryCharging size={12} />
                  <span>PIN</span>
                </div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#00f2fe', fontFamily: 'JetBrains Mono', marginTop: '2px' }}>
                  {telemetryModal.batteryPercent}%
                </div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '8px', textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', color: '#f59e0b', fontSize: '10px' }}>
                  <Thermometer size={12} />
                  <span>NHIỆT ĐỘ</span>
                </div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#00f2fe', fontFamily: 'JetBrains Mono', marginTop: '2px' }}>
                  {telemetryModal.temperatureCelsius}°C
                </div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '8px', textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', color: '#38bdf8', fontSize: '10px' }}>
                  <Cpu size={12} />
                  <span>TRẠNG THÁI</span>
                </div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#34d399', fontFamily: 'JetBrains Mono', marginTop: '4px' }}>
                  {telemetryModal.isCharging ? 'Đang Sạc' : 'Dùng Pin'}
                </div>
              </div>
            </div>

            <p style={{ fontSize: '11.5px', color: '#94a3b8', lineHeight: 1.45, marginBottom: '14px' }}>
              Phần sụn: <code style={{ color: '#00f2fe' }}>{telemetryModal.firmwareVersion}</code>. Nhịp tim phản hồi: {telemetryModal.lastHeartbeat}. Robot đang đặt trên bàn làm việc của Ngài.
            </p>

            <button
              onClick={handleRingBell}
              disabled={isRinging}
              className="btn-action-primary"
              style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
            >
              <Bell size={14} className={isRinging ? 'animate-bounce' : ''} />
              <span>{isRinging ? 'Đang phát chuông loa robot...' : 'Phát Chuông Loa Robot Tại Nhà'}</span>
            </button>
          </div>
        </div>
      )}

      {/* POPUP MODAL 4: CÀI ĐẶT IP SERVER */}
      <ConnectionSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}

export default App;
