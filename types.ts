
export enum View {
  DASHBOARD = 'DASHBOARD',
  MARKET_CHAT = 'MARKET_CHAT',
  VISUAL_ANALYSIS = 'VISUAL_ANALYSIS',
  DEEP_ANALYSIS = 'DEEP_ANALYSIS',
  LIVE_CONSULTANT = 'LIVE_CONSULTANT',
  MARKET_VIDEO = 'MARKET_VIDEO',
  MULTIMODAL_INPUT = 'MULTIMODAL_INPUT',
  ADVANCE_SCREEN = 'ADVANCE_SCREEN',
  STOCK_SCREENER = 'STOCK_SCREENER',
  LIBRARY = 'LIBRARY',
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  chartData?: any[]; // For visual graphs
  sources?: { title: string; uri: string }[]; // For clean citation display
  timestamp: Date;
}

export interface StockDataPoint {
  date: string;
  value: number;
}