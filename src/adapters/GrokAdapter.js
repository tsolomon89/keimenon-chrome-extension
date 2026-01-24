import { generateMessageHash, generateOccurrenceKey } from '../shared/hash.js';
import { normalizeText } from '../shared/normalize.js';

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
    return url.includes('x.com/i/grok') || url.includes('grok.com');
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
        const id = generateOccurrenceKey(hash, index);
        
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
    
    const target = document.querySelector('main') || document.body;
    
    let timeoutId;
    const debouncedCallback = () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            callback();
        }, 1000); 
    };

    this.observer = new MutationObserver((mutations) => {
        let shouldTrigger = false;
        for (const mutation of mutations) {
             // Basic activity check
            if (mutation.addedNodes.length > 0) {
                shouldTrigger = true;
                break;
            }
        }
        if (shouldTrigger) {
            debouncedCallback();
        }
    });

    this.observer.observe(target, { childList: true, subtree: true });
  }

  async scanFullChat(options) {
      if (this.isScanning) return;
      this.isScanning = true;

      // Grok scroll container assumption
      const scrollContainer = document.querySelector('main') || document.documentElement;
      
      let noChangeCount = 0;
      let lastScrollHeight = scrollContainer.scrollHeight;

      try {
          while (!options.shouldStop() && noChangeCount < 5) {
              scrollContainer.scrollTop -= 500; 
              
              await new Promise(r => setTimeout(r, 800));

              const newScrollHeight = scrollContainer.scrollHeight;
              if (Math.abs(newScrollHeight - lastScrollHeight) < 10) {
                  noChangeCount++;
              } else {
                  noChangeCount = 0;
                  lastScrollHeight = newScrollHeight;
              }
              
              if (scrollContainer.scrollTop <= 50) {
                  await new Promise(r => setTimeout(r, 1000));
                  if (scrollContainer.scrollTop <= 50 && scrollContainer.scrollHeight === lastScrollHeight) {
                      break; 
                  }
              }
          }
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
