
/**
 * Finds the main scrollable container using common heuristics.
 * @param {Document|Element} context - The root context to search in.
 * @returns {Element} The found scroll container or documentElement.
 */
export function findScrollContainer(context = document) {
    // 1. React Scroll to Bottom (ChatGPT specific but common in React apps)
    const candidates = context.querySelectorAll('div[class*="react-scroll-to-bottom"]');
    for (const c of candidates) {
        if (c.scrollHeight > c.clientHeight) return c;
    }

    // 2. Generic overflow-y-auto (Tailwind/CSS common)
    // Check for large content to avoid small sidebars
    const generic = context.querySelectorAll('.overflow-y-auto');
    for (const g of generic) {
        if (g.scrollHeight > g.clientHeight && g.innerText.length > 200) {
            return g;
        }
    }

    // 3. Platform Specific fallback heuristics (Claude, etc)
    const scrollers = context.querySelectorAll('[class*="scroller"], [class*="ChatMessageList"]');
    for (const s of scrollers) {
         if (s.scrollHeight > s.clientHeight) return s;
    }

    // 4. Main or Body Fallback
    return context.querySelector('main') || context.documentElement;
}

/**
 * Common text normalization wrapper.
 * Re-exports normalizeText for convenience if we move logical things here.
 */
export { normalizeText } from './normalize.js';
