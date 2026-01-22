
export interface Message {
  id: string; // hash + index
  platform: 'chatgpt' | 'claude';
  conversationId: string;
  index: number; // DOM order
  text: string; // normalized
  charCount: number;
  capturedAt: number; // timestamp
  meta?: Record<string, any>;
  author: 'user'; // We only extract user messages
}

export interface PlatformAdapter {
  name: string;
  
  // Lifecycle / Capability
  isSupportedLocation(url: string): boolean;
  getConversationId(url: string): string | null;
  disconnect(): void;

  // Extraction
  runOnce(): Promise<Message[]>;
  observe(callback: () => void): void;
  
  // Harvesting
  scanFullChat?(options: ScanOptions): Promise<void>;
}

export interface ScanOptions {
  onProgress: (count: number) => void;
  shouldStop: () => boolean;
}

export interface ExtractionResult {
  messages: Message[];
  conversationId: string;
  platform: string;
}
