import { ChatGPTAdapter } from './ChatGPTAdapter.js';
import { ClaudeAdapter } from './ClaudeAdapter.js';
import { GrokAdapter } from './GrokAdapter.js';
import { GeminiAdapter } from './GeminiAdapter.js';

export class AdapterFactory {
  static createAdapter(url) {
    if (url.includes('chatgpt.com') || url.includes('chat.openai.com')) {
      return new ChatGPTAdapter();
    }
    if (url.includes('claude.ai')) {
      return new ClaudeAdapter();
    }
    if (url.includes('grok.com')) {
      return new GrokAdapter();
    }
    if (url.includes('gemini.google.com')) {
      return new GeminiAdapter();
    }
    return null;
  }
}
