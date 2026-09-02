// src/App.tsx
// BOWCON Mobile - Main Application Controller

import { useState } from 'react';
import { Radio, Settings, LayoutDashboard } from 'lucide-react';
import { LiveVoiceCall } from './components/LiveVoiceCall';
import { ExecutiveDashboard } from './components/ExecutiveDashboard';
import { ConnectionSettingsModal } from './components/ConnectionSettingsModal';

export function App() {
  const [isCallActive, setIsCallActive] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 relative selection:bg-cyan-500 selection:text-black">
      {/* If Voice Call is triggered, show immersive Call Screen */}
      {isCallActive ? (
        <LiveVoiceCall onEndCall={() => setIsCallActive(false)} />
      ) : (
        <>
          {/* Main Executive Command Center */}
          <ExecutiveDashboard onStartVoiceCall={() => setIsCallActive(true)} />

          {/* FLOATING BOTTOM ACTION BAR (iPhone iOS Safe Area) */}
          <div className="fixed bottom-0 left-0 right-0 z-40 p-3 pb-6 bg-[#07090e]/90 backdrop-blur-xl border-t border-slate-800/80 flex items-center justify-around max-w-lg mx-auto">
            {/* Dashboard Button */}
            <button
              onClick={() => setIsCallActive(false)}
              className="flex flex-col items-center gap-1 text-cyan-400 p-1.5 transition-all"
            >
              <LayoutDashboard className="w-5 h-5" />
              <span className="text-[10px] font-semibold">Điều Hành</span>
            </button>

            {/* BIG CALL AI BUTTON */}
            <button
              onClick={() => setIsCallActive(true)}
              className="relative -top-3 p-4 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-500 text-slate-950 shadow-xl shadow-cyan-500/30 active:scale-95 transition-all border-2 border-slate-900 flex items-center justify-center"
              title="Gọi đàm thoại trực tiếp với BOWCON"
            >
              <Radio className="w-7 h-7 text-slate-950 animate-pulse" />
            </button>

            {/* Settings Button */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex flex-col items-center gap-1 text-slate-400 hover:text-white p-1.5 transition-all"
            >
              <Settings className="w-5 h-5" />
              <span className="text-[10px] font-semibold">Cài Đặt</span>
            </button>
          </div>
        </>
      )}

      {/* Settings Modal */}
      <ConnectionSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}

export default App;
