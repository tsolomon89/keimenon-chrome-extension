import { generateMessageHash, generateOccurrenceKey } from '../shared/hash.js';
import { normalizeText } from '../shared/normalize.js';

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
    
    // Primary selector: Attribute based
    let nodes = Array.from(this.context.querySelectorAll('[data-message-author-role="user"]'));
    
    // Process nodes
    for (const [index, node] of nodes.entries()) {
        const rawText = node.innerText || node.textContent;
        const text = normalizeText(rawText);
        if (!text) continue;

        const hash = await generateMessageHash(text);
        // Key needs conversationId in real implementation if we persisted, 
        // but for now ID is just unique per session/view.
        // Spec 6.3 says Key: platform + conversationId + messageHash for dedupe set.
        // But Message.id usually implies the UI key.
        // Let's keep ID as hash_index for simple UI rendering stability.
        const id = generateOccurrenceKey(hash, index);
        
        messages.push({
            id,
            platform: 'chatgpt',
            conversationId,
            index,
            text,
            charCount: text.length,
            capturedAt: Date.now(),
            author: 'user'
        });
    }

    return messages;
  }

  observe(callback) {
    if (this.observer) return;
    
    const target = this.context.querySelector('main') || this.context.body;
    
    let timeoutId;
    const debouncedCallback = () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            callback();
        }, 1000); // 1s debounce
    };

    this.observer = new MutationObserver((mutations) => {
        let shouldTrigger = false;
        for (const mutation of mutations) {
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

      const scrollContainer = this.findScrollContainer();
      if (!scrollContainer) {
          console.warn("Keimenon: Could not find scroll container for ChatGPT.");
          this.isScanning = false;
          return;
      }

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
              
              if (scrollContainer.scrollTop === 0) {
                  // Wait a bit to see if more loads
                  await new Promise(r => setTimeout(r, 1000));
                  if (scrollContainer.scrollTop === 0 && scrollContainer.scrollHeight === lastScrollHeight) {
                      break; 
                  }
              }
          }
      } finally {
          this.isScanning = false;
      }
  }

  findScrollContainer() {
      // ChatGPT often has a main element or a specific scrollable div
      // Structure changes often, so we try a few heuristics
      
      // 1. Look for the main scrollable conversational area
      const candidates = this.context.querySelectorAll('div[class*="react-scroll-to-bottom"]');
      for (const c of candidates) {
          if (c.scrollHeight > c.clientHeight) return c;
      }

      // 2. Generic fallback for overflow-y-auto
      const generic = this.context.querySelectorAll('.overflow-y-auto');
      for (const g of generic) {
          if (g.scrollHeight > g.clientHeight && g.innerText.length > 500) {
              return g;
          }
      }

      return this.context.querySelector('main') || this.context.documentElement;
  }
}
