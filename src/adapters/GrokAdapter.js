import { BaseAdapter } from './BaseAdapter.js';
import { normalizeText } from '../shared/dom.js';
import { extractMessageContent } from '../shared/extraction.js';

/**
 * @implements {import('../shared/types').PlatformAdapter}
 */
export class GrokAdapter extends BaseAdapter {
  constructor(context = document) {
    super('grok', context);
  }

  isSupportedLocation(url) {
    return url.includes('grok.com');
  }

  getConversationId(url) {
      // Regular chat: /c/{id}
      const chatMatch = url.match(/\/c\/([a-zA-Z0-9-]+)/);
      if (chatMatch) return chatMatch[1];
      // Project chat: /project/{projectId}?chat={chatId}
      const projectChatMatch = url.match(/[?&]chat=([a-zA-Z0-9-]+)/);
      if (projectChatMatch) return projectChatMatch[1];
      return 'current-session';
  }

  isChatPage() {
      // Grok URL logic might need adjustment if home is same as chat base
      return true;
  }

  async waitForReady() {
    // Grok: textarea
    return this.waitForContent('textarea');
  }

  async runOnce() {
    const messages = [];
    const conversationId = this.getConversationId(window.location.href);

    // 1. Select all message bubbles
    const bubbles = Array.from(this.context.querySelectorAll('.message-bubble'));
    
    const occurrenceMap = new Map();

    for (const [index, node] of bubbles.entries()) {
        const markdownContainer = node.querySelector('.response-content-markdown');
        let text = '';
        
        if (markdownContainer) {
            text = normalizeText(extractMessageContent(markdownContainer));
        } else {
            text = normalizeText(extractMessageContent(node));
        }

        if (!text) continue;

        const hash = await this.getMessageHash(node, text);
        const author = node.classList.contains('bg-surface-l1') ? 'user' : 'assistant';
        const id = this.getUniqueId(occurrenceMap, hash);
        
        messages.push({
            id,
            platform: 'grok',
            conversationId,
            index,
            text,
            charCount: text.length,
            capturedAt: Date.now(),
            author
        });
    }

    return messages;
  }
}
