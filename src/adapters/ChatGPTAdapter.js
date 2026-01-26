import { generateMessageHash, generateOccurrenceKey } from '../shared/hash.js';
import { normalizeText, findScrollContainer } from '../shared/dom.js';
import { createDebouncedObserver } from '../shared/observer.js';
import { scrollUpRecursively } from '../shared/scroller.js';

/**
 * @implements {import('../shared/types').PlatformAdapter}
 */
export class ChatGPTAdapter {
  constructor(context = document) {
    this.name = 'chatgpt';
    this.observer = null;
    this.isScanning = false;
    this.context = context;
  }

  isSupportedLocation(url) {
    return url.includes('chatgpt.com/c/') || url.includes('chat.openai.com/c/');
  }

  getConversationId(url) {
    // Extract UUID from https://chatgpt.com/c/UUID...
    const match = url.match(/\/c\/([a-f0-9-]+)/);
    return match ? match[1] : null;
  }

  async runOnce() {
    const messages = [];
    const conversationId = this.context.location ? this.getConversationId(this.context.location.href) : 'mock-conversation';
    
    // Primary selector: Attribute based (both user and assistant)
    let nodes = Array.from(this.context.querySelectorAll('[data-message-author-role]'));
    
    // Process nodes
    const occurrenceMap = new Map();
    
    for (const [index, node] of nodes.entries()) {
        const rawText = node.innerText || node.textContent;
        const text = normalizeText(rawText);
        if (!text) continue;

        const role = node.getAttribute('data-message-author-role');
        const author = role === 'user' ? 'user' : 'assistant';

        const hash = await generateMessageHash(text);
        
        // Occurrence-based ID (Stable against deletion of siblings)
        const occurrenceIndex = occurrenceMap.get(hash) || 0;
        occurrenceMap.set(hash, occurrenceIndex + 1);
        
        const id = generateOccurrenceKey(hash, occurrenceIndex);
        
        messages.push({
            id,
            platform: 'chatgpt',
            conversationId,
            index, // Keep global index for sorting/ordering if needed
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
    
    // Use the specific container (e.g. .react-scroll-to-bottom) if found, otherwise main/body
    const target = this.findScrollContainer() || this.context.querySelector('main') || this.context.body;
    
    this.observer = createDebouncedObserver(target, callback);
  }


  disconnect() {
    if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
    }
    this.isScanning = false;
  }

  async scanFullChat(options) {
      if (this.isScanning) return;
      this.isScanning = true;

      // Use shared finder (defaults to context-aware search)
      const scrollContainer = findScrollContainer(this.context);
      
      if (!scrollContainer) {
          console.warn("Keimenon: Could not find scroll container for ChatGPT.");
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
}
