(async () => {
    // Dynamically import the main content script as a module
    const src = chrome.runtime.getURL('src/content.js');
    await import(src);
})();
