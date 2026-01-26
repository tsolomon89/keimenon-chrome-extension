import { generateMessageHash, generateOccurrenceKey } from '../shared/hash.js';
import { normalizeText, findScrollContainer } from '../shared/dom.js';
import { createDebouncedObserver } from '../shared/observer.js';
import { scrollUpRecursively } from '../shared/scroller.js';

/**
 * @implements {import('../shared/types').PlatformAdapter}
 */
export class GrokAdapter {
  constructor() {
    this.name = 'grok';
    this.observer = null;
    this.isScanning = false;
  }

  isSupportedLocation(url) {
    // Strict Chat URL patterns
    return url.includes('grok.com/c/') || url.includes('x.com/i/grok'); 
    // Note: x.com/i/grok is often the SPA which then loads sessions. 
    // If strict chat URL is distinct on x.com, we should use that, 
    // but often it stays /i/grok. The user specifically asked for patterns like "grok.com/c/".
    // I will enforce /c/ for grok.com, and keep x.com/i/grok as is (since it's usually the chat interface itself).
  }

  getConversationId(url) {
      // Url might be https://x.com/i/grok or https://grok.com/chat/123...
      // For now we'll use a simple fallback or extract if clear pattern exists
      const match = url.match(/\/chat\/([a-zA-Z0-9-]+)/);
      if (match) return match[1];
      
      // If we are on x.com/i/grok, the conversation ID isn't always in URL.
      // We'll return 'current-session' which effectively means "whatever is on screen"
      return 'current-session';
  }

  async runOnce() {
    const messages = [];
    const conversationId = this.getConversationId(window.location.href);

    // Grok Strategy based on User provided HTML:
    // User messages have class "message-bubble" AND "bg-surface-l1" (User color)
    // Model messages likely have a different bg class (e.g., bg-surface-l2 or similar) or just lack the user one.
    // The text content is inside .message-bubble -> .response-content-markdown -> p
    
    // 1. Select all message bubbles
    // 1. Select all message bubbles
    const bubbles = Array.from(document.querySelectorAll('.message-bubble'));
    
    const occurrenceMap = new Map();

    // 2. Capture ALL bubbles, distinguish by class
    for (const [index, node] of bubbles.entries()) {
        // Text is likely deep inside. The snippet shows:
        // .response-content-markdown -> p
        
        const markdownContainer = node.querySelector('.response-content-markdown');
        let text = '';
        
        if (markdownContainer) {
            // Get text from all paragraphs or just innerText
            text = normalizeText(markdownContainer.innerText);
        } else {
            // Fallback if structure is slightly different
            text = normalizeText(node.innerText);
        }

        if (!text) continue;

        // Determine Author
        // User has `bg-surface-l1` (or similar user color class)
        // Model is assumed to be the other state.
        const author = node.classList.contains('bg-surface-l1') ? 'user' : 'assistant';

        const hash = await generateMessageHash(text);
        
        // Occurrence-based ID
        const occurrenceIndex = occurrenceMap.get(hash) || 0;
        occurrenceMap.set(hash, occurrenceIndex + 1);

        const id = generateOccurrenceKey(hash, occurrenceIndex);
        
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

  observe(callback) {
     if (this.observer) return;
    
    const target = findScrollContainer(document) || document.querySelector('main') || document.body;
    this.observer = createDebouncedObserver(target, callback);
  }

  async scanFullChat(options) {
      if (this.isScanning) return;
      this.isScanning = true;

      // Grok scroll container assumption
      const scrollContainer = findScrollContainer(document);
      
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
