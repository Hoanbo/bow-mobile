// src/components/OledEyesVisualizer.tsx
// Grand OLED Robot Face with 5 Micro-Emotions and Natural Blink for iPhone

import React from 'react';
import type { EmotionState } from '../types';

interface Props {
  emotion: EmotionState;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onTap?: () => void;
}

export const OledEyesVisualizer: React.FC<Props> = ({
  emotion,
  size = 'lg',
  interactive = true,
  onTap,
}) => {
  // Screen-proportional dimensions for zero-scroll single screen
  const width = size === 'sm' ? 160 : size === 'md' ? 220 : 250;
  const height = size === 'sm' ? 84 : size === 'md' ? 110 : 125;

  const renderEyeShapes = () => {
    switch (emotion) {
      case 'happy':
        // Mắt cười hình trăng khuyết khi chào Ngài (Curved crescent moon arches)
        return (
          <g fill="none" stroke="#00f2fe" strokeWidth="10" strokeLinecap="round" filter="url(#cyanEyeGlow)">
            <path d="M 44,76 Q 80,36 116,76" />
            <path d="M 144,76 Q 180,36 216,76" />
          </g>
        );

      case 'thinking':
        // Mắt hơi nheo, đồng tử quét ngang xử lý dữ liệu (Narrowed frame with laser-scanning pupil)
        return (
          <g filter="url(#cyanEyeGlow)">
            {/* Left Eye Socket */}
            <rect
              x="42"
              y="46"
              width="74"
              height="36"
              rx="14"
              fill="rgba(0, 242, 254, 0.15)"
              stroke="#00f2fe"
              strokeWidth="3.5"
            />
            {/* Left Scanning Pupil */}
            <circle cx="79" cy="64" r="11" fill="#00f2fe">
              <animate
                attributeName="cx"
                values="56;102;56"
                dur="1.4s"
                repeatCount="indefinite"
                calcMode="spline"
                keySplines="0.4 0 0.2 1; 0.4 0 0.2 1"
              />
            </circle>

            {/* Right Eye Socket */}
            <rect
              x="144"
              y="46"
              width="74"
              height="36"
              rx="14"
              fill="rgba(0, 242, 254, 0.15)"
              stroke="#00f2fe"
              strokeWidth="3.5"
            />
            {/* Right Scanning Pupil */}
            <circle cx="181" cy="64" r="11" fill="#00f2fe">
              <animate
                attributeName="cx"
                values="158;204;158"
                dur="1.4s"
                repeatCount="indefinite"
                calcMode="spline"
                keySplines="0.4 0 0.2 1; 0.4 0 0.2 1"
              />
            </circle>
          </g>
        );

      case 'speaking':
        // Mắt dao động nhấp nháy theo biên độ giọng đọc của AI (Audio-reactive oscillating heights)
        return (
          <g fill="#00f2fe" filter="url(#cyanEyeGlow)">
            <rect x="46" y="28" width="70" height="72" rx="22">
              <animate
                attributeName="height"
                values="72;44;80;36;72"
                dur="0.65s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="y"
                values="28;42;24;46;28"
                dur="0.65s"
                repeatCount="indefinite"
              />
            </rect>

            <rect x="144" y="28" width="70" height="72" rx="22">
              <animate
                attributeName="height"
                values="72;44;80;36;72"
                dur="0.65s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="y"
                values="28;42;24;46;28"
                dur="0.65s"
                repeatCount="indefinite"
              />
            </rect>
            {/* Catchlights */}
            <circle cx="62" cy="42" r="5" fill="#ffffff" />
            <circle cx="160" cy="42" r="5" fill="#ffffff" />
          </g>
        );

      case 'sleeping':
        // Mắt nhắm dạng đường chỉ ngang khi nghỉ ngơi
        return (
          <g stroke="#00f2fe" strokeWidth="7" strokeLinecap="round" opacity="0.65" filter="url(#cyanEyeGlow)">
            <line x1="48" y1="64" x2="112" y2="64" />
            <line x1="148" y1="64" x2="212" y2="64" />
          </g>
        );

      case 'listening':
      default:
        // Mắt mở to tròn, có catchlight trắng và chớp mắt tự nhiên (Natural eyelid blink)
        return (
          <g filter="url(#cyanEyeGlow)">
            {/* Left Eye with Eyelid Blink Animation */}
            <rect
              x="44"
              y="26"
              width="72"
              height="74"
              rx="24"
              fill="#00f2fe"
            >
              <animateTransform
                attributeName="transform"
                type="scale"
                additive="sum"
                values="1 1; 1 1; 1 0.08; 1 1; 1 1"
                keyTimes="0; 0.85; 0.88; 0.91; 1"
                dur="3.8s"
                repeatCount="indefinite"
                transform-origin="80 63"
              />
            </rect>
            {/* Left Eye Pure White Catchlight */}
            <circle cx="60" cy="40" r="6" fill="#ffffff" />
            <circle cx="94" cy="74" r="3.5" fill="rgba(255, 255, 255, 0.7)" />

            {/* Right Eye with Eyelid Blink Animation */}
            <rect
              x="144"
              y="26"
              width="72"
              height="74"
              rx="24"
              fill="#00f2fe"
            >
              <animateTransform
                attributeName="transform"
                type="scale"
                additive="sum"
                values="1 1; 1 1; 1 0.08; 1 1; 1 1"
                keyTimes="0; 0.85; 0.88; 0.91; 1"
                dur="3.8s"
                repeatCount="indefinite"
                transform-origin="180 63"
              />
            </rect>
            {/* Right Eye Pure White Catchlight */}
            <circle cx="160" cy="40" r="6" fill="#ffffff" />
            <circle cx="194" cy="74" r="3.5" fill="rgba(255, 255, 255, 0.7)" />
          </g>
        );
    }
  };

  return (
    <div
      onClick={interactive ? onTap : undefined}
      className="oled-screen-frame"
      style={{ width: `${width}px`, height: `${height}px` }}
      title={`Cảm xúc BOWCON: ${emotion} (Chạm để tương tác)`}
    >
      <svg viewBox="0 0 260 128" width="100%" height="100%">
        <defs>
          <filter id="cyanEyeGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* OLED Deep Black Background */}
        <rect width="260" height="128" fill="#010306" />

        {/* Eyes Drawing */}
        {renderEyeShapes()}
      </svg>
    </div>
  );
};
