import { ChatGPTAdapter } from './ChatGPTAdapter.js';
import { ClaudeAdapter } from './ClaudeAdapter.js';

export class AdapterFactory {
  static createAdapter(url) {
    if (url.includes('chatgpt.com') || url.includes('chat.openai.com')) {
      return new ChatGPTAdapter();
    }
    if (url.includes('claude.ai')) {
      return new ClaudeAdapter();
    }
    return null;
  }
}
