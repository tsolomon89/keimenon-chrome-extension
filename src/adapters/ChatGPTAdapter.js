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
    this.nodeCache = new WeakMap();
  }

  isSupportedLocation(url) {
    return url.includes('chatgpt.com') || url.includes('chat.openai.com');
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
    
    // Fallback: If no nodes found via attributes, try common class names
    if (nodes.length === 0) {
        // Common OpenAI class names (subject to change, but good defaults)
        nodes = Array.from(this.context.querySelectorAll('.text-message, .message-content, [class*="conversation-turn"]'));
        if (nodes.length > 0) {
            console.log('[Keimenon] Found nodes via fallback selectors:', nodes.length);
        }
    }
    
    // Process nodes
    const occurrenceMap = new Map();
    
    for (const [index, node] of nodes.entries()) {
        const rawText = node.innerText || node.textContent;
        const text = normalizeText(rawText);
        if (!text) continue;

        let hash;
        const cached = this.nodeCache.get(node);
        if (cached && cached.text === text) {
            hash = cached.hash;
        } else {
            hash = await generateMessageHash(text);
            this.nodeCache.set(node, { text, hash });
        }

        const role = node.getAttribute('data-message-author-role');
        let author = 'assistant';
        
        if (role === 'user') {
            author = 'user';
        } else if (!role) {
             // Heuristic for fallback selectors
             if (node.querySelector('.font-user-message') || node.matches('.font-user-message')) {
                 author = 'user';
             }
        }
        
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
    const target = findScrollContainer(this.context) || this.context.querySelector('main') || this.context.body;
    
    console.log('[Keimenon] ChatGPTAdapter.observe starting on target:', target);
    this.observer = createDebouncedObserver(target, callback);
    
    // Immediate initial run to catch already loaded content
    if (typeof callback === 'function') callback();
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
