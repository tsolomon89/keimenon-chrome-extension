
/**
 * Scrolls a container up primarily to load history.
 * @param {Element} scrollContainer - The element to scroll.
 * @param {Object} options - Control options.
 * @param {Function} options.shouldStop - Callback returning true if process should halt.
 * @param {number} [options.stepPx] - Pixels to scroll up per step (default 500).
 * @param {number} [options.sleepMs] - Time to wait after scroll (default 800).
 * @param {number} [options.maxNoChange] - Max iterations with no height change before stopping (default 5).
 */
export async function scrollUpRecursively(scrollContainer, options) {
    const stepPx = options.stepPx || 500;
    const sleepMs = options.sleepMs || 800;
    const maxNoChange = options.maxNoChange || 5;

    let noChangeCount = 0;
    let lastScrollHeight = scrollContainer.scrollHeight;

    // Safety limit to prevent infinite loops (though shouldStop covers most)
    let safetyLimit = 100;

    while (!options.shouldStop() && noChangeCount < maxNoChange && safetyLimit > 0) {
        safetyLimit--;
        
        // Scroll Up
        if (scrollContainer.scrollTop > 0) {
            scrollContainer.scrollTop = Math.max(0, scrollContainer.scrollTop - stepPx);
        }

        // Wait for network/render
        await new Promise(r => setTimeout(r, sleepMs));

        // Check for expansion
        const newScrollHeight = scrollContainer.scrollHeight;
        if (Math.abs(newScrollHeight - lastScrollHeight) < 10) {
            noChangeCount++;
        } else {
            noChangeCount = 0;
            // IMPORTANT: If height changed, browser usually keeps scrollTop relative to bottom or top.
            // We just update our baseline.
            lastScrollHeight = newScrollHeight;
        }

        // Top Check
        if (scrollContainer.scrollTop <= 50) {
            // Wait a bit extra to see if provider loads more at the very top
            await new Promise(r => setTimeout(r, 1000));
            
            // Re-check
            if (scrollContainer.scrollTop <= 50 && 
                Math.abs(scrollContainer.scrollHeight - lastScrollHeight) < 10) {
                // Really at top and no header expansion
                break;
            }
        }
    }
}
