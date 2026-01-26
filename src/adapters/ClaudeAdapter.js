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
    this.nodeCache = new WeakMap();
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
        let text;
        let hash;

        // Check cache first (keyed by original node)
        // We assume that if the node reference is same, the text is likely same unless mutated.
        // We will double check raw text length or something cheap if strictly needed, 
        // but for now we rely on the fact that once a message is fully streamed, it rarely changes.
        // However, during streaming, text changes. So we must verify text content.
        
        // To verify text content efficiently, we might need to get innerText. 
        // But getting innerText causes reflow. 
        // Is there a way to avoid reflow? likely not. 
        // But we can avoid the Clone + Remove overhead if we cache the dirty check result?
        // Actually, let's just do the text extraction. It's the HASHING that is expensive (SHA-256).
        // Text normalization is relatively cheap.
        
        // For Claude, we have to clone to remove artifacts. This IS expensive.
        // Optimization: Check if node.innerText is same as cached.rawText? 
        // But .font-ui might be present.
        
        // Let's try to just cache the result of the expensive operation (Clone+Clean+Hash)
        // invalidating if the simple textContent length changed markedly?
        
        // Safer approach: Do the extraction, but cache the HASH.
        // Extraction cost: Clone + Remove. 
        // Can we avoid Clone? only if we can select text nodes.
        
        // Let's stick to: Extract text -> Check Cache -> (Hash or Reuse).
        
        const clone = node.cloneNode(true);
        const thinkingBlocks = clone.querySelectorAll('.font-ui');
        thinkingBlocks.forEach(block => block.remove());
        const rawText = clone.innerText || clone.textContent; 
        text = normalizeText(rawText);
        
        if (!text) continue;

        const cached = this.nodeCache.get(node);
        if (cached && cached.text === text) {
            hash = cached.hash;
        } else {
            hash = await generateMessageHash(text);
            this.nodeCache.set(node, { text, hash });
        }

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
     const target = findScrollContainer(document) || document.querySelector('[class*="ChatMessageList"], [class*="scroller"]') || document.body;
     
     this.observer = createDebouncedObserver(target, callback);
     if (typeof callback === 'function') callback();
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

