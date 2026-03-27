import { BaseAdapter } from './BaseAdapter.js';
import { normalizeText, findScrollContainer } from '../shared/dom.js';
import { extractMessageContent } from '../shared/extraction.js';

/**
 * @implements {import('../shared/types').PlatformAdapter}
 */
export class ClaudeAdapter extends BaseAdapter {
  constructor(context = document) {
    super('claude', context);
  }

  isSupportedLocation(url) {
    return url.includes('claude.ai/chat/');
  }

  getConversationId(url) {
    // Extract UUID from https://claude.ai/chat/UUID...
    const match = url.match(/\/chat\/([a-f0-9-]+)/);
    return match ? match[1] : null;
  }

  isChatPage() {
    return true;
  }

  async waitForReady() {
      // Claude: ContentEditable div
      return this.waitForContent('div[contenteditable="true"]');
  }

  async runOnce() {
    const messages = [];
    const conversationId = this.getConversationId(window.location.href) || 'unknown';
    
    // Selectors
    const selectorString = [
        '.font-user-message', 
        '.\\!font-user-message', 
        '[data-testid="user-message"]',
        '.font-claude-response', 
        '[data-testid="claude-message"]',
        '[data-message-author]'
    ].join(', ');

    const nodes = Array.from(this.context.querySelectorAll(selectorString));
    
    const occurrenceMap = new Map();

    for (const [index, node] of nodes.entries()) {
        let text;

        // Use customized extraction to skip UI artifacts like thinking blocks
        const rawText = extractMessageContent(node, {
            excludeSelectors: new Set(['.font-ui'])
        });
        text = normalizeText(rawText);
        
        if (!text) continue;

        const hash = await this.getMessageHash(node, text);

        // Determine Author
        let author = 'assistant';
        if (node.getAttribute('data-message-author') === 'user' || 
            node.classList.contains('font-user-message') ||
            node.classList.contains('!font-user-message') ||
            node.matches('[data-testid="user-message"]')) {
            author = 'user';
        } else if (node.classList.contains('font-claude-response')) {
             author = 'assistant';
        }

        const id = this.getUniqueId(occurrenceMap, hash);

        messages.push({
            id,
            platform: 'claude',
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

