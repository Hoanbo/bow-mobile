// src/components/ExecutiveDashboard.tsx
// Mobile Command Center for Shop of BOW, Smart Home, Robot & Vision

import React, { useState } from 'react';
import { 
  ShoppingBag, 
  Home, 
  Bot, 
  Eye, 
  Layers, 
  Sparkles, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  Lightbulb, 
  Wind, 
  BatteryCharging, 
  Thermometer, 
  Volume2, 
  Monitor,
  RefreshCw,
  Send,
  Radio
} from 'lucide-react';
import type { PendingOrder, ShopTelemetry, RobotTelemetry, SmartHomeState } from '../types';

interface Props {
  onStartVoiceCall: () => void;
}

export const ExecutiveDashboard: React.FC<Props> = ({ onStartVoiceCall }) => {
  const [activeTab, setActiveTab] = useState<'shop' | 'smarthome' | 'vision' | 'agents'>('shop');

  // Telemetry States
  const [shopData] = useState<ShopTelemetry>({
    revenueToday: 2850000,
    cogsToday: 1650000,
    netProfit: 1200000,
    profitMarginPercent: 42.1,
    pendingFulfillmentCount: 3,
    urgentOrdersCount: 1,
  });

  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([
    {
      orderId: 'BOW-ORD-9921',
      customerName: 'Tuấn Anh (Hà Nội)',
      productName: 'Netflix Premium 4K (1 Tháng)',
      totalAmount: 450000,
      costAmount: 320000,
      minutesWaiting: 18,
      isUrgent: true,
    },
    {
      orderId: 'BOW-ORD-9922',
      customerName: 'Hoàng Minh',
      productName: 'Key Windows 11 Pro Retail',
      totalAmount: 180000,
      costAmount: 90000,
      minutesWaiting: 8,
      isUrgent: false,
    },
  ]);

  const [smartHome, setSmartHome] = useState<SmartHomeState>({
    deskLight: false,
    airConditioner: false,
    targetTemp: 24,
  });

  const [robotStatus] = useState<RobotTelemetry>({
    batteryPercent: 88,
    isCharging: false,
    temperatureCelsius: 38.5,
    headPanAngle: 0,
    isOnline: true,
  });

  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [isCapturingScreen, setIsCapturingScreen] = useState<boolean>(false);
  const [agentTaskInput, setAgentTaskInput] = useState<string>('');
  const [agentLogs, setAgentLogs] = useState<string[]>([
    '🤖 [BOWCON] Hệ thống Central Brain V4.0.0 đang hoạt động hoàn hảo trên máy chủ Dual-Xeon.',
    '🕵️ [TechScout] Đã quét tin tức AI sáng nay: Model reasoning mới ra mắt.',
  ]);

  // Handle 1-Click Handover
  const handleFulfillOrder = (orderId: string) => {
    setPendingOrders((prev) => prev.filter((o) => o.orderId !== orderId));
    setAgentLogs((prev) => [
      `✅ [BOWCON] Đã bàn giao 1-click thành công đơn ${orderId} cho khách hàng! Lợi nhuận tạm tính: +130.000đ`,
      ...prev,
    ]);
  };

  // Handle Capture Remote Screen
  const handleCaptureScreen = (display: 'screen_2' | 'screen_1') => {
    setIsCapturingScreen(true);
    setTimeout(() => {
      // Simulate base64 screen vision response from PC
      setScreenshotUrl(
        display === 'screen_2'
          ? 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=600&q=80'
          : 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80'
      );
      setIsCapturingScreen(false);
      setAgentLogs((prev) => [
        `👁️ [ScreenVision] Đã chụp ảnh thành công ${display === 'screen_2' ? 'Màn hình chính (Màn 2)' : 'Màn hình phụ (Màn 1)'} của Ngài.`,
        ...prev,
      ]);
    }, 1200);
  };

  return (
    <div className="flex flex-col min-h-screen pb-24 px-4 pt-12 select-none">
      {/* HEADER: Persona & Voice Call Trigger */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span className="text-[11px] font-mono tracking-widest text-cyan-400 uppercase">
              Autonomous Level 4.0
            </span>
          </div>
          <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
            BOWCON
            <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              V4.0 Mobile
            </span>
          </h1>
        </div>

        {/* CALL BOWCON FLOATING BUTTON */}
        <button
          onClick={onStartVoiceCall}
          className="btn-neon-cyan px-4 py-2 text-xs flex items-center gap-2 font-bold tracking-wide shadow-lg shadow-cyan-500/20 active:scale-95 transition-transform"
        >
          <Radio className="w-4 h-4 animate-pulse" />
          Gọi Đàm Thoại
        </button>
      </div>

      {/* TOP NAVIGATION TABS */}
      <div className="grid grid-cols-4 gap-1 p-1 bg-slate-900/80 border border-slate-800 rounded-2xl mb-5">
        <button
          onClick={() => setActiveTab('shop')}
          className={`py-2 rounded-xl text-xs font-medium flex flex-col items-center gap-1 transition-all ${
            activeTab === 'shop'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          Shop
        </button>
        <button
          onClick={() => setActiveTab('smarthome')}
          className={`py-2 rounded-xl text-xs font-medium flex flex-col items-center gap-1 transition-all ${
            activeTab === 'smarthome'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Home className="w-4 h-4" />
          Nhà & Robot
        </button>
        <button
          onClick={() => setActiveTab('vision')}
          className={`py-2 rounded-xl text-xs font-medium flex flex-col items-center gap-1 transition-all ${
            activeTab === 'vision'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Eye className="w-4 h-4" />
          Mắt Thần
        </button>
        <button
          onClick={() => setActiveTab('agents')}
          className={`py-2 rounded-xl text-xs font-medium flex flex-col items-center gap-1 transition-all ${
            activeTab === 'agents'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          Đa Agent
        </button>
      </div>

      {/* TAB 1: SHOP OF BOW EXECUTIVE COPILOT */}
      {activeTab === 'shop' && (
        <div className="space-y-4 animate-fade-in">
          {/* Revenue & Profit Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="glass-panel p-3.5">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>Doanh thu hôm nay</span>
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-lg font-bold text-white font-mono">
                {shopData.revenueToday.toLocaleString('vi-VN')} đ
              </div>
              <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                +18.4% so với hôm qua
              </div>
            </div>

            <div className="glass-panel p-3.5">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>Lợi nhuận ròng</span>
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="text-lg font-bold text-amber-300 font-mono">
                {shopData.netProfit.toLocaleString('vi-VN')} đ
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Tỷ suất biên: <strong className="text-cyan-400">{shopData.profitMarginPercent}%</strong>
              </div>
            </div>
          </div>

          {/* Pending Fulfillment Queue */}
          <div className="glass-panel p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Hàng Đợi Chờ Bàn Giao</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-mono">
                {pendingOrders.length} đơn
              </span>
            </div>

            {pendingOrders.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs flex flex-col items-center gap-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                Đã bàn giao toàn bộ đơn hàng! Không có đơn nghẽn.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingOrders.map((order) => (
                  <div
                    key={order.orderId}
                    className={`p-3 rounded-xl border ${
                      order.isUrgent
                        ? 'bg-rose-500/10 border-rose-500/40'
                        : 'bg-slate-800/60 border-slate-700/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono font-bold text-cyan-300">
                        {order.orderId}
                      </span>
                      {order.isUrgent && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold border border-rose-500/40 animate-pulse">
                          CẦN GIAO GẤP ({order.minutesWaiting}p)
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-white font-medium mb-1">
                      {order.productName}
                    </div>
                    <div className="text-[11px] text-slate-400 mb-2">
                      Khách: {order.customerName} • Giá: {order.totalAmount.toLocaleString('vi-VN')} đ
                    </div>

                    <button
                      onClick={() => handleFulfillOrder(order.orderId)}
                      className="w-full py-1.5 rounded-lg btn-neon-cyan text-xs flex items-center justify-center gap-1 font-bold"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Bàn Giao Ngay 1-Click
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SMART HOME & PHYSICAL ROBOT */}
      {activeTab === 'smarthome' && (
        <div className="space-y-4 animate-fade-in">
          {/* Smart Home Control Toggles */}
          <div className="glass-panel p-4">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Home className="w-4 h-4 text-cyan-400" />
              Điều Khiển Nhà Thông Minh
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {/* Desk Light */}
              <button
                onClick={() => setSmartHome((prev) => ({ ...prev, deskLight: !prev.deskLight }))}
                className={`p-3.5 rounded-xl border flex flex-col items-start gap-2 transition-all ${
                  smartHome.deskLight
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-200'
                    : 'bg-slate-800/60 border-slate-700/50 text-slate-400'
                }`}
              >
                <Lightbulb className={`w-5 h-5 ${smartHome.deskLight ? 'text-amber-400' : ''}`} />
                <div className="text-left">
                  <div className="text-xs font-bold text-white">Đèn Bàn Làm Việc</div>
                  <div className="text-[11px]">{smartHome.deskLight ? 'Đang bật' : 'Đã tắt'}</div>
                </div>
              </button>

              {/* Air Conditioner */}
              <button
                onClick={() =>
                  setSmartHome((prev) => ({ ...prev, airConditioner: !prev.airConditioner }))
                }
                className={`p-3.5 rounded-xl border flex flex-col items-start gap-2 transition-all ${
                  smartHome.airConditioner
                    ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-200'
                    : 'bg-slate-800/60 border-slate-700/50 text-slate-400'
                }`}
              >
                <Wind className={`w-5 h-5 ${smartHome.airConditioner ? 'text-cyan-400 animate-spin' : ''}`} />
                <div className="text-left">
                  <div className="text-xs font-bold text-white">Điều Hòa Phòng</div>
                  <div className="text-[11px]">
                    {smartHome.airConditioner ? `Bật (${smartHome.targetTemp}°C)` : 'Đã tắt'}
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Physical Robot Status Card (ESP32-S3) */}
          <div className="glass-panel p-4">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-cyan-400" />
                Thể Xác Robot ESP32-S3 (Ở Nhà)
              </span>
              <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Online
              </span>
            </h3>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
                <div className="flex items-center gap-1 text-slate-400 text-xs mb-1">
                  <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
                  Mức Pin
                </div>
                <div className="text-lg font-bold text-white font-mono">
                  {robotStatus.batteryPercent}%
                </div>
                <div className="text-[10px] text-slate-400">Cổng sạc: Type-C sẵn sàng</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
                <div className="flex items-center gap-1 text-slate-400 text-xs mb-1">
                  <Thermometer className="w-3.5 h-3.5 text-amber-400" />
                  Nhiệt Độ Chip
                </div>
                <div className="text-lg font-bold text-white font-mono">
                  {robotStatus.temperatureCelsius}°C
                </div>
                <div className="text-[10px] text-emerald-400">Tản nhiệt tối ưu</div>
              </div>
            </div>

            {/* Broadcast Voice to Robot Speaker */}
            <button
              onClick={() => {
                setAgentLogs((prev) => [
                  '📢 [RobotLoa] Đã phát chuông chào hỏi qua loa MAX98357 của Robot ở phòng làm việc.',
                  ...prev,
                ]);
              }}
              className="w-full py-2 rounded-xl bg-slate-800/80 border border-cyan-500/30 text-xs text-cyan-200 hover:bg-cyan-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 font-medium"
            >
              <Volume2 className="w-4 h-4 text-cyan-400" />
              Phát Chuông Loa Robot Ở Nhà
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: REMOTE SCREEN VISION */}
      {activeTab === 'vision' && (
        <div className="space-y-4 animate-fade-in">
          <div className="glass-panel p-4">
            <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
              <Monitor className="w-4 h-4 text-cyan-400" />
              Mắt Thần Soi Màn Hình Máy Tính PC
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Chụp và xem ảnh màn hình máy tính làm việc ở nhà theo thời gian thực:
            </p>

            {/* Select Screen Buttons */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                disabled={isCapturingScreen}
                onClick={() => handleCaptureScreen('screen_2')}
                className="btn-neon-cyan py-2 text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCapturingScreen ? 'animate-spin' : ''}`} />
                Màn 2 (Chính Bên Trái)
              </button>
              <button
                disabled={isCapturingScreen}
                onClick={() => handleCaptureScreen('screen_1')}
                className="py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 hover:bg-slate-700 active:scale-95 flex items-center justify-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCapturingScreen ? 'animate-spin' : ''}`} />
                Màn 1 (Phụ Bên Phải)
              </button>
            </div>

            {/* Image Preview Box */}
            {screenshotUrl ? (
              <div className="rounded-xl overflow-hidden border border-cyan-500/30 shadow-lg relative">
                <img
                  src={screenshotUrl}
                  alt="Remote Desktop"
                  className="w-full h-48 object-cover"
                />
                <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 text-[10px] font-mono text-cyan-400">
                  Đã cập nhật vừa xong
                </div>
              </div>
            ) : (
              <div className="h-40 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
                <Eye className="w-8 h-8 text-slate-600" />
                Chưa chụp ảnh màn hình nào. Bấm nút phía trên để xem!
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: MULTI-AGENT SWARM */}
      {activeTab === 'agents' && (
        <div className="space-y-4 animate-fade-in">
          <div className="glass-panel p-4">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              Biệt Đội Đa Agent Chuyên Trách
            </h3>

            <div className="space-y-2 mb-4">
              <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-between text-xs">
                <span className="font-bold text-cyan-300">🕵️ TechScoutAgent</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                  Săn tin công nghệ
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-between text-xs">
                <span className="font-bold text-amber-300">💻 CoderDevOpsAgent</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                  Sandbox & Viết mã
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-300">📊 ShopOperationsAgent</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                  Vận hành đơn hàng
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-between text-xs">
                <span className="font-bold text-purple-300">🤖 HardwareVisionAgent</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                  Cảm biến & Mắt Robot
                </span>
              </div>
            </div>

            {/* Quick Task Dispatcher */}
            <div className="flex gap-2">
              <input
                type="text"
                value={agentTaskInput}
                onChange={(e) => setAgentTaskInput(e.target.value)}
                placeholder="Giao nhiệm vụ cho Biệt đội..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
              />
              <button
                onClick={() => {
                  if (!agentTaskInput.trim()) return;
                  setAgentLogs((prev) => [
                    `⚡ [PhânCông] Đã giao việc cho Biệt đội: "${agentTaskInput}"`,
                    ...prev,
                  ]);
                  setAgentTaskInput('');
                }}
                className="btn-neon-cyan px-3 py-1.5 text-xs font-bold"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Activity Log Feed */}
          <div className="glass-panel p-3.5">
            <h4 className="text-xs font-bold text-slate-300 mb-2 font-mono uppercase tracking-wider">
              Nhật Ký Hoạt Động Của Hệ Thống
            </h4>
            <div className="space-y-1.5 max-h-44 overflow-y-auto font-mono text-[11px] text-slate-400">
              {agentLogs.map((log, idx) => (
                <div key={idx} className="p-1.5 rounded bg-slate-900/60 border border-slate-800">
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
