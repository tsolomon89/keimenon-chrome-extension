import { generateMessageHash, generateOccurrenceKey } from '../shared/hash.js';
import { findScrollContainer } from '../shared/dom.js';
import { createDebouncedObserver } from '../shared/observer.js';
import { scrollUpRecursively } from '../shared/scroller.js';

/**
 * Base class for all platform adapters.
 * Implements shared logic for observation, scanning, and caching.
 * @implements {import('../shared/types').PlatformAdapter}
 */
export class BaseAdapter {
    /**
     * @param {string} name - The unique name of the platform (e.g., 'chatgpt').
     * @param {Document|Element} context - The context to scan (defaults to document).
     */
    constructor(name, context = document) {
        this.name = name;
        this.context = context;
        this.observer = null;
        this.isScanning = false;
        this.nodeCache = new WeakMap();
    }

    /**
     * Checks if the current URL is supported by this adapter.
     * @abstract
     * @param {string} url 
     * @returns {boolean}
     */
    isSupportedLocation(url) {
        throw new Error('isSupportedLocation must be implemented by subclass');
    }

    /**
     * @abstract
     * @returns {Promise<Array<import('../shared/types').Message>>}
     */
    async runOnce() {
        throw new Error('runOnce must be implemented by subclass');
    }

    /**
     * Shared helper to resolve message hash from cache or generate new one.
     * @param {Element} node 
     * @param {string} text 
     * @returns {Promise<string>}
     */
    async getMessageHash(node, text) {
        const cached = this.nodeCache.get(node);
        if (cached && cached.text === text) {
            return cached.hash;
        }
        const hash = await generateMessageHash(text);
        this.nodeCache.set(node, { text, hash });
        return hash;
    }

    /**
     * Generates a unique ID for a message based on its hash and occurrence index.
     * @param {Map<string, number>} occurrenceMap 
     * @param {string} hash 
     * @returns {string}
     */
    getUniqueId(occurrenceMap, hash) {
        const occurrenceIndex = occurrenceMap.get(hash) || 0;
        occurrenceMap.set(hash, occurrenceIndex + 1);
        return generateOccurrenceKey(hash, occurrenceIndex);
    }

    /**
     * Sets up a debounced observer on the scroll container.
     * @param {Function} callback 
     */
    observe(callback) {
        if (this.observer) return;

        const target = this.getScrollContainer() || this.context.querySelector('main') || this.context.body;
        console.log(`[Keimenon] ${this.name}Adapter.observe starting on target:`, target);
        
        this.observer = createDebouncedObserver(target, callback);

        // Immediate initial run
        if (typeof callback === 'function') callback();
    }

    /**
     * Cleans up the observer.
     */
    disconnect() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        this.isScanning = false;
    }

    /**
     * Performs a full history scan by scrolling up.
     * @param {Object} options 
     */
    async scanFullChat(options) {
        if (this.isScanning) return;
        this.isScanning = true;

        const scrollContainer = this.getScrollContainer();

        if (!scrollContainer) {
            console.warn(`Keimenon: Could not find scroll container for ${this.name}.`);
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

    /**
     * Helper to find the scroll container.
     * can be overridden if a platform needs specific logic.
     * @returns {Element|null}
     */
    getScrollContainer() {
        return findScrollContainer(this.context);
    }
}
