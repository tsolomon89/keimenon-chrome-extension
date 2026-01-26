import { generateMessageHash, generateOccurrenceKey } from '../shared/hash.js';
import { normalizeText, findScrollContainer } from '../shared/dom.js';
import { createDebouncedObserver } from '../shared/observer.js';
import { scrollUpRecursively } from '../shared/scroller.js';

/**
 * @implements {import('../shared/types').PlatformAdapter}
 */
export class GeminiAdapter {
  constructor() {
    this.name = 'gemini';
    this.observer = null;
    this.isScanning = false;
    this.nodeCache = new WeakMap();
  }

  isSupportedLocation(url) {
    return url.includes('gemini.google.com/app/');
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

    // Query for all message types at once to maintain DOM order
    const allNodes = document.querySelectorAll(
        'structured-content-container.model-response-text, ' +
        '.user-query, ' +
        '.model-response, ' +
        '.query-text, ' +
        '.response-text, ' +
        '[data-test-id="user-message"], ' +
        '[data-test-id="model-message"]'
    );

    if (allNodes.length > 0) {
        // Filter out duplicates - if a node is contained within another selected node, skip it
        nodes = Array.from(allNodes).filter(node => {
            // Check if this node is a child of any other selected node
            for (const other of allNodes) {
                if (other !== node && other.contains(node)) {
                    return false; // Skip this node, it's contained in another
                }
            }
            return true;
        });
    } else {
        // Fallback: Try to find message containers by attribute if classes fail
        nodes = Array.from(document.querySelectorAll('[data-message-id]'));
    }

    const occurrenceMap = new Map();

    for (const [index, node] of nodes.entries()) {
        const rawText = node.innerText || node.textContent;
        const text = normalizeText(rawText);
        if (!text) continue;

        let hash;
        
        // Check cache
        const cached = this.nodeCache.get(node);
        if (cached && cached.text === text) {
            hash = cached.hash;
        } else {
            hash = await generateMessageHash(text);
            this.nodeCache.set(node, { text, hash });
        }

        // Determine Author
        let author = 'assistant'; // Default to model

        // Check if it's a user message
        if (node.classList.contains('user-query') ||
            node.classList.contains('query-text') ||
            node.matches('[data-test-id="user-message"]') ||
            node.getAttribute('data-is-user') === 'true') {
            author = 'user';
        }

        // Explicitly check if it's an AI message (model response)
        if (node.tagName.toLowerCase() === 'structured-content-container' ||
            node.tagName.toLowerCase() === 'message-content' ||
            node.classList.contains('model-response-text') ||
            node.classList.contains('model-response') ||
            node.classList.contains('model-response') || // Duplicate check in original?
            node.classList.contains('response-text') ||
            node.matches('[data-test-id="model-message"]')) {
            author = 'assistant';
        }

        // Occurrence-based ID
        const occurrenceIndex = occurrenceMap.get(hash) || 0;
        occurrenceMap.set(hash, occurrenceIndex + 1);
        
        const id = generateOccurrenceKey(hash, occurrenceIndex);
        
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
    
    // Stricter target
    const target = findScrollContainer(document) || document.querySelector('main') || document.body;
    
    this.observer = createDebouncedObserver(target, callback);
    if (typeof callback === 'function') callback();
  }

  async scanFullChat(options) {
    if (this.isScanning) return;
    this.isScanning = true;

    // Gemini usually scrolls the main window or a specific main container
    // Using shared finder to be robust
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
