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
    
    let nodes = [];
    
    // 1. Look for explicit user query classes used in some versions:
    const queryNodes = document.querySelectorAll('.user-query');
    if (queryNodes.length > 0) {
        nodes = Array.from(queryNodes);
    } else {
        // 2. Generic look for Message Item where it might be user
        // Gemini often uses `infinite-scroller` -> `virtual-scroller` -> `div`
        // We look for the text content within the chat bubble logic.
        
        // This selector targets the User's text bubble often found in recent builds
        // 'text-body' is generic, so we need to be careful.
        // Often Gemini user messages are in a container `user-message` or similar logic.
        
        // Let's try iterating all `message-content` if available and infer author?
        // No, that's hard. 
        
        // Try searching for the edit icon wrapper often present on user messages
        // or check for `[data-test-id="user-query"]` or `[aria-label^="Edit"]` parent?
        
        // Fallback: Using a broad selector for now to ensure we get *something* for the user to refine in future:
        // `query-text` is a class often used.
        nodes = Array.from(document.querySelectorAll('user-query, .query-text, [data-test-id="user-message"]'));
    }

    for (const [index, node] of nodes.entries()) {
        const rawText = node.innerText || node.textContent;
        const text = normalizeText(rawText);
        if (!text) continue;

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
            author: 'user'
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

  disconnect() {
    if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
    }
    this.isScanning = false;
  }
}
