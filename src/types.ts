// src/types.ts
// BOWCON Mobile - The Ultimate Pocket Embodied Companion & Butler Domain Types

export type EmotionState = 'listening' | 'thinking' | 'speaking' | 'happy' | 'sleeping';

export type CallStatus = 'idle' | 'connecting' | 'connected' | 'listening' | 'speaking' | 'processing' | 'error';

export interface MessageTranscript {
  id: string;
  sender: 'boss' | 'bowcon';
  text: string;
  timestamp: string;
}

export interface RobotTelemetry {
  batteryPercent: number;
  isCharging: boolean;
  temperatureCelsius: number;
  headPanAngle?: number;
  isOnline: boolean;
  firmwareVersion?: string;
  lastHeartbeat?: string;
}

export interface SmartHomeState {
  deskLight: boolean;
  airConditioner: boolean;
  targetTemp: number;
  statusDesc?: string;
}

export interface ScreenCaptureResult {
  displayId: 1 | 2;
  timestamp: string;
  imageUrl: string;
  resolution?: string;
  note?: string;
}

export interface MorningBriefing {
  date: string;
  greeting: string;
  weather: string;
  schedule: string[];
  aiNews: string[];
  quote: string;
}

export interface SubagentTask {
  id: string;
  agent: 'TechScout' | 'CoderDevOps';
  prompt: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  result?: string;
  timestamp: string;
}
