// src/components/OledEyesVisualizer.tsx
// Visualizes BOWCON's physical robot OLED eyes right on iPhone

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
  size = 'md',
  interactive = true,
  onTap,
}) => {
  const width = size === 'sm' ? 140 : size === 'md' ? 240 : 320;
  const height = size === 'sm' ? 70 : size === 'md' ? 120 : 160;

  // SVG eye shapes based on emotion
  const renderEyeShapes = () => {
    switch (emotion) {
      case 'happy':
        // Curved happy arcs (crescent moon eyes)
        return (
          <g fill="none" stroke="#00f2fe" strokeWidth="12" strokeLinecap="round">
            {/* Left Eye Arc */}
            <path d="M 40,75 Q 75,35 110,75" />
            {/* Right Eye Arc */}
            <path d="M 130,75 Q 165,35 200,75" />
          </g>
        );

      case 'thinking':
        // Narrowed thinking eyes with scanning pupil effect
        return (
          <g fill="#00f2fe">
            {/* Left Eye Frame */}
            <rect x="40" y="45" width="70" height="40" rx="16" fill="rgba(0, 242, 254, 0.2)" stroke="#00f2fe" strokeWidth="4" />
            <circle cx="85" cy="65" r="14" fill="#00f2fe">
              <animate attributeName="cx" values="60;90;60" dur="2s" repeatCount="indefinite" />
            </circle>

            {/* Right Eye Frame */}
            <rect x="130" y="45" width="70" height="40" rx="16" fill="rgba(0, 242, 254, 0.2)" stroke="#00f2fe" strokeWidth="4" />
            <circle cx="175" cy="65" r="14" fill="#00f2fe">
              <animate attributeName="cx" values="150;180;150" dur="2s" repeatCount="indefinite" />
            </circle>
          </g>
        );

      case 'speaking':
        // Speaking eyes pulsating vertically
        return (
          <g fill="#00f2fe">
            <rect x="42" y="32" width="66" height="66" rx="20">
              <animate attributeName="height" values="55;72;50;68;55" dur="0.8s" repeatCount="indefinite" />
              <animate attributeName="y" values="37;29;40;31;37" dur="0.8s" repeatCount="indefinite" />
            </rect>
            <rect x="132" y="32" width="66" height="66" rx="20">
              <animate attributeName="height" values="55;72;50;68;55" dur="0.8s" repeatCount="indefinite" />
              <animate attributeName="y" values="37;29;40;31;37" dur="0.8s" repeatCount="indefinite" />
            </rect>
          </g>
        );

      case 'sleeping':
        // Sleeping horizontal calm slit lines
        return (
          <g stroke="#00f2fe" strokeWidth="8" strokeLinecap="round">
            <line x1="45" y1="65" x2="105" y2="65" opacity="0.6" />
            <line x1="135" y1="65" x2="195" y2="65" opacity="0.6" />
          </g>
        );

      case 'listening':
      default:
        // Wide, attentive round rectangular eyes with glow
        return (
          <g fill="#00f2fe" className="oled-eye">
            {/* Left Eye */}
            <rect x="42" y="30" width="66" height="70" rx="22" filter="url(#cyanGlow)" />
            {/* Right Eye */}
            <rect x="132" y="30" width="66" height="70" rx="22" filter="url(#cyanGlow)" />
            {/* Catchlight reflections */}
            <circle cx="56" cy="44" r="6" fill="#ffffff" />
            <circle cx="146" cy="44" r="6" fill="#ffffff" />
          </g>
        );
    }
  };

  return (
    <div
      onClick={interactive ? onTap : undefined}
      className={`oled-screen-frame flex items-center justify-center cursor-pointer transition-transform active:scale-95`}
      style={{ width: `${width}px`, height: `${height}px` }}
      title={`Cảm xúc BOWCON: ${emotion}`}
    >
      <svg viewBox="0 0 240 120" width="100%" height="100%">
        <defs>
          <filter id="cyanGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* OLED Subpixel grid simulation */}
        <rect width="240" height="120" fill="#030712" />

        {/* Render Eye Shapes */}
        {renderEyeShapes()}
      </svg>
    </div>
  );
};
