
/**
 * Creates a debounced MutationObserver.
 * @param {Element} target - The DOM element to observe.
 * @param {Function} callback - The function to call after debounce.
 * @param {Object} options - Observer options (childList, subtree, etc.).
 * @param {number} delayMs - Debounce delay in milliseconds (default 1000).
 * @returns {MutationObserver} The created observer instance.
 */
export function createDebouncedObserver(target, callback, options = { childList: true, subtree: true }, delayMs = 1000) {
    let timeoutId;

    const debouncedCallback = () => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            callback();
        }, delayMs);
    };

    const observer = new MutationObserver((mutations) => {
        let shouldTrigger = false;
        // Basic optimization: check if nodes were added
        // (Most chat updates involve adding nodes)
        for (const mutation of mutations) {
            if (mutation.addedNodes.length > 0 || mutation.type === 'characterData') {
                shouldTrigger = true;
                break;
            }
        }
        
        // If we want to be safe and catch everything, we might drop the check,
        // but existing adapters had this check.
        if (shouldTrigger) {
            debouncedCallback();
        }
    });

    observer.observe(target, options);
    return observer;
}
