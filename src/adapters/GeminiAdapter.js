import { generateMessageHash, generateOccurrenceKey } from '../shared/hash.js';
import { normalizeText } from '../shared/normalize.js';

/**
 * @implements {import('../shared/types').PlatformAdapter}
 */
export class GeminiAdapter {
  constructor() {
    this.name = 'gemini';
    this.observer = null;
    this.isScanning = false;
  }

  isSupportedLocation(url) {
    return url.includes('gemini.google.com');
  }

  getConversationId(url) {
    // URL often looks like https://gemini.google.com/app/HASH
    const match = url.match(/\/app\/([a-zA-Z0-9-]+)/);
    return match ? match[1] : 'current-session';
  }

  async runOnce() {
    const messages = [];
    const conversationId = this.getConversationId(window.location.href);

    // Selectors for Gemini
    // Based on research: user prompts often in `user-query` or similar containers.
    // Also checking for `[data-message-id]` where author is user.
    
    // Potential candidates based on common Angular/internal Google class names:
    // .conversation-container .user-query
    // .message-container[data-is-user="true"]
    
    // We will scan for multiple possibilities.
    
    // We will scan for both user and model messages.
    let nodes = [];
    
    // Broaden selectors to capture both sides
    // User: .user-query, .query-text
    // Model: .model-response, .response-text
    const allNodes = document.querySelectorAll('.user-query, .model-response, .query-text, .response-text, [data-test-id="user-message"], [data-test-id="model-message"]');
    
    if (allNodes.length > 0) {
        nodes = Array.from(allNodes);
    } else {
        // Fallback: Try to find message containers by attribute if classes fail
        nodes = Array.from(document.querySelectorAll('[data-message-id]'));
    }

    for (const [index, node] of nodes.entries()) {
        const rawText = node.innerText || node.textContent;
        const text = normalizeText(rawText);
        if (!text) continue;

        // Determine Author
        let author = 'assistant'; // Default to model
        if (node.classList.contains('user-query') || 
            node.classList.contains('query-text') || 
            node.matches('[data-test-id="user-message"]') ||
            node.getAttribute('data-is-user') === 'true') {
            author = 'user';
        }

        const hash = await generateMessageHash(text);
        const id = generateOccurrenceKey(hash, index);
        
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

  observe(callback) {
    if (this.observer) return;
    
    // Main scroll container or body
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

    // Gemini usually scrolls the main window or a specific main container
    const scrollContainer = document.querySelector('main') || document.documentElement;

    let noChangeCount = 0;
    let lastScrollHeight = scrollContainer.scrollHeight;

    try {
      while (!options.shouldStop() && noChangeCount < 5) {
        // Scroll up a bit
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
             // If we hit top, break.
             // But sometimes Gemini loads more on top?
             // Assuming similar behavior to ChatGPT for now.
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
