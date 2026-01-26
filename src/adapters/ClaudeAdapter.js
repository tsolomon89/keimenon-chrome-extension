import { generateMessageHash, generateOccurrenceKey } from '../shared/hash.js';
import { normalizeText, findScrollContainer } from '../shared/dom.js';
import { createDebouncedObserver } from '../shared/observer.js';
import { scrollUpRecursively } from '../shared/scroller.js';

/**
 * @implements {import('../shared/types').PlatformAdapter}
 */
export class ClaudeAdapter {
  constructor() {
    this.name = 'claude';
    this.observer = null;
    this.isScanning = false;
  }

  isSupportedLocation(url) {
    return url.includes('claude.ai/chat/');
  }

  getConversationId(url) {
    // Extract UUID from https://claude.ai/chat/UUID...
    const match = url.match(/\/chat\/([a-f0-9-]+)/);
    return match ? match[1] : null;
  }

  async runOnce() {
    const messages = [];
    const conversationId = this.getConversationId(window.location.href) || 'unknown';
    
    const selectorString = [
        '.font-user-message', 
        '.\\!font-user-message', 
        '[data-testid="user-message"]',
        '.font-claude-response', 
        '[data-testid="claude-message"]',
        '[data-message-author]'
    ].join(', ');

    const nodes = document.querySelectorAll(selectorString);
    const messageNodes = Array.from(nodes);
    
    const occurrenceMap = new Map();

    for (const [index, node] of messageNodes.entries()) {
        // Clone node to manipulate it without affecting the DOM
        const clone = node.cloneNode(true);
        
        // Remove Chain of Thought / Reasoning blocks (identified by .font-ui)
        const thinkingBlocks = clone.querySelectorAll('.font-ui');
        thinkingBlocks.forEach(block => block.remove());

        const rawText = clone.innerText || clone.textContent; 
        const text = normalizeText(rawText);
        if (!text) continue;

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

        const hash = await generateMessageHash(text);
        
        // Occurrence-based ID
        const occurrenceIndex = occurrenceMap.get(hash) || 0;
        occurrenceMap.set(hash, occurrenceIndex + 1);
        
        const id = generateOccurrenceKey(hash, occurrenceIndex);

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

  observe(callback) {
     if (this.observer) return;
     
     // Stricter target: typically the scrollable list
     const target = this.findScrollContainer() || document.querySelector('[class*="ChatMessageList"], [class*="scroller"]') || document.body;
     
     this.observer = createDebouncedObserver(target, callback);
  }

  async scanFullChat(options) {
      if (this.isScanning) return;
      this.isScanning = true;

      // Note: Claude has specific scroll containers sometimes, but shared finder
      // usually catches scroller classes too.
      // But let's rely on shared finder first.
      const scrollContainer = findScrollContainer(document);

      if (!scrollContainer) {
          console.warn("Keimenon: Could not find scroll container for Claude.");
          this.isScanning = false;
          return;
      }

      try {
          await scrollUpRecursively(scrollContainer, {
              shouldStop: options.shouldStop
          });
      } finally {
          this.isScanning = false;
      }
  }

  disconnect() {
      if (this.observer) {
          this.observer.disconnect();
          this.observer = null;
      }
      this.isScanning = false;
  }
}

