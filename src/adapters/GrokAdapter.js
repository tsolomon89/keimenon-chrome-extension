import { BaseAdapter } from './BaseAdapter.js';
import { normalizeText } from '../shared/dom.js';

/**
 * @implements {import('../shared/types').PlatformAdapter}
 */
export class GrokAdapter extends BaseAdapter {
  constructor(context = document) {
    super('grok', context);
  }

  isSupportedLocation(url) {
    return url.includes('grok.com/c/') || url.includes('x.com/i/grok'); 
  }

  getConversationId(url) {
      const match = url.match(/\/chat\/([a-zA-Z0-9-]+)/);
      if (match) return match[1];
      return 'current-session';
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
            text = normalizeText(markdownContainer.innerText);
        } else {
            text = normalizeText(node.innerText);
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
