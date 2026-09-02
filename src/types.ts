// src/types.ts
// BOWCON Mobile - Core Domain & Telemetry Types

export type EmotionState = 'happy' | 'listening' | 'thinking' | 'speaking' | 'sleeping';

export type CallStatus = 'idle' | 'connecting' | 'listening' | 'speaking' | 'processing';

export interface MessageTranscript {
  id: string;
  sender: 'boss' | 'bowcon';
  text: string;
  timestamp: string;
}

export interface ShopTelemetry {
  revenueToday: number;
  cogsToday: number;
  netProfit: number;
  profitMarginPercent: number;
  pendingFulfillmentCount: number;
  urgentOrdersCount: number;
}

export interface RobotTelemetry {
  batteryPercent: number;
  isCharging: boolean;
  temperatureCelsius: number;
  headPanAngle: number;
  isOnline: boolean;
}

export interface SmartHomeState {
  deskLight: boolean;
  airConditioner: boolean;
  targetTemp: number;
}

export interface PendingOrder {
  orderId: string;
  customerName: string;
  productName: string;
  totalAmount: number;
  costAmount: number;
  minutesWaiting: number;
  isUrgent: boolean;
}
