import { generateMessageHash, generateOccurrenceKey } from '../shared/hash.js';
import { normalizeText } from '../shared/normalize.js';

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
    
    const userMessageNodes = Array.from(document.querySelectorAll('.font-user-message'));
    
    for (const [index, node] of userMessageNodes.entries()) {
        const rawText = node.innerText || node.textContent; 
        const text = normalizeText(rawText);
        if (!text) continue;

        const hash = await generateMessageHash(text);
        const id = generateOccurrenceKey(hash, index);

        messages.push({
            id,
            platform: 'claude',
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
     
     const target = document.querySelector('[class*="ChatMessageList"], [class*="scroller"]') || document.body;

     this.observer = new MutationObserver((mutations) => {
        callback();
     });

     this.observer.observe(target, { childList: true, subtree: true });
  }

  async scanFullChat(options) {
      if (this.isScanning) return;
      this.isScanning = true;

      const scrollContainer = this.findScrollContainer();
      if (!scrollContainer) {
          console.warn("Keimenon: Could not find scroll container for Claude.");
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
                  // Spec: After each increment, rescan for new user messages.
                  // The observer *should* catch this if we are observing the list.
                  // But we can also call options.onProgress if provided, or rely on mutation observer callback.
              }
              
              if (scrollContainer.scrollTop === 0) {
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
      return document.querySelector('.overflow-y-auto[class*="flex-1"]') || document.documentElement;
  }

  disconnect() {
      if (this.observer) {
          this.observer.disconnect();
          this.observer = null;
      }
      this.isScanning = false;
  }
}

