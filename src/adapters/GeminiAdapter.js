import { BaseAdapter } from './BaseAdapter.js';
import { normalizeText } from '../shared/dom.js';
import { extractMessageContent } from '../shared/extraction.js';

/**
 * @implements {import('../shared/types').PlatformAdapter}
 */
export class GeminiAdapter extends BaseAdapter {
  constructor(context = document) {
    super('gemini', context);
  }

  isSupportedLocation(url) {
    return url.includes('gemini.google.com/app/');
  }

  getConversationId(url) {
    // URL often looks like https://gemini.google.com/app/HASH
    const match = url.match(/\/app\/([a-zA-Z0-9-]+)/);
    return match ? match[1] : 'current-session';
  }

  isChatPage() {
    // Exclude the main /app/ landing page which has no conversation ID in URL usually,
    // or specifically check for the prompt area or welcome message to distinguish.
    // Better: Helper method to check if URL has an ID or if DOM has chat elements.
    if (this.context.location.href.endsWith('/app') || this.context.location.href.endsWith('/app/')) {
        return false;
    }
    return true;
  }

  async waitForReady() {
    // Gemini: rich-textarea
    return this.waitForContent('.rich-textarea, [role="textbox"]');
  }

  async runOnce() {
    const messages = [];
    const conversationId = this.getConversationId(window.location.href);

    // Scan logic...
    let nodes = [];

    const allNodes = this.context.querySelectorAll(
        'structured-content-container.model-response-text, ' +
        '.user-query, ' +
        '.model-response, ' +
        '.query-text, ' +
        '.response-text, ' +
        '[data-test-id="user-message"], ' +
        '[data-test-id="model-message"]'
    );

    if (allNodes.length > 0) {
        // Filter out duplicates
        nodes = Array.from(allNodes).filter(node => {
            for (const other of allNodes) {
                if (other !== node && other.contains(node)) {
                    return false;
                }
            }
            return true;
        });
    } else {
        nodes = Array.from(this.context.querySelectorAll('[data-message-id]'));
    }

    const occurrenceMap = new Map();

    for (const [index, node] of nodes.entries()) {
        const rawText = extractMessageContent(node);
        const text = normalizeText(rawText);
        if (!text) continue;

        const hash = await this.getMessageHash(node, text);

        let author = 'assistant';
        if (node.classList.contains('user-query') ||
            node.classList.contains('query-text') ||
            node.matches('[data-test-id="user-message"]') ||
            node.getAttribute('data-is-user') === 'true') {
            author = 'user';
        }

        if (node.tagName.toLowerCase() === 'structured-content-container' ||
            node.tagName.toLowerCase() === 'message-content' ||
            node.classList.contains('model-response-text') ||
            node.classList.contains('model-response') ||
            node.classList.contains('response-text') ||
            node.matches('[data-test-id="model-message"]')) {
            author = 'assistant';
        }

        const id = this.getUniqueId(occurrenceMap, hash);
        
        messages.push({
            id,
            platform: 'gemini',
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
