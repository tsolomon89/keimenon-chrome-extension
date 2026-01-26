import { AdapterFactory } from './adapters/AdapterFactory.js';

// Lifecycle State
let activePort = null;
let adapter = null;
let isScanning = false;
let scanController = null;

function init() {
    adapter = AdapterFactory.createAdapter(window.location.href);
    if (!adapter) console.log('[Keimenon] No adapter for this page.');
    else console.log(`[Keimenon] Initialized adapter: ${adapter.name}`);

    // Listen for long-lived connection from Side Panel
    chrome.runtime.onConnect.addListener((port) => {
        if (port.name === 'sidepanel-connection') {
            console.log('[Keimenon] Sidepanel connected.');
            handleNewConnection(port);
        }
    });

    // SPA Navigation Detection
    let lastUrl = window.location.href;
    
    // METHOD 1: Wrapper / Polling (Robust)
    setInterval(() => {
        const currentUrl = window.location.href;
        if (currentUrl !== lastUrl) {
            // console.debug('[Keimenon] URL Changed (Poller)');
            lastUrl = currentUrl;
            handleNavigation();
        }
    }, 1000);

    // METHOD 2: MutationObserver for major body changes (often signals navigation or re-render)
    const bodyObserver = new MutationObserver(() => {
        const currentUrl = window.location.href;
        if (currentUrl !== lastUrl) {
           // console.debug('[Keimenon] URL Changed (Observer)');
           lastUrl = currentUrl;
           handleNavigation();
        }
    });
    bodyObserver.observe(document.body, { childList: true });
}

function handleNavigation() {
    // Check if adapter supports new location
    // Note: Use the existing factory logic if possible, or just check current adapter
    const currentUrl = window.location.href;
    
    // Check if we need to switch adapter (e.g. going from ChatGPT to Grok? Unlikely in same tab, but possible)
    // Or if we just need to re-scan.
    
    // Re-evaluate adapter for the new URL
    const newAdapter = AdapterFactory.createAdapter(currentUrl);
    
    // Case 1: Same platform, just navigation
    if (adapter && newAdapter && adapter.name === newAdapter.name) {
        if (adapter.isSupportedLocation(currentUrl)) {
             console.log('[Keimenon] SPA Navigation within same platform.');
             // Disconnect old observer
             if (adapter.disconnect) adapter.disconnect();
             // Re-start session (finds new elements)
             if (activePort) startSession();
        } else {
            console.log('[Keimenon] Navigated to unsupported area of same platform.');
            if (adapter.disconnect) adapter.disconnect();
            if (activePort) {
                activePort.postMessage({ 
                    action: 'EXTENSION_READY', 
                    meta: { adapter: adapter.name, status: 'idle' } 
                });
            }
        }
    } 
    // Case 2: Platform switch or new platform found
    else if (newAdapter) {
        console.log(`[Keimenon] Platform switched to ${newAdapter.name}`);
        if (adapter && adapter.disconnect) adapter.disconnect();
        adapter = newAdapter;
        if (activePort) startSession();
    }
    // Case 3: No adapter for this URL
    else {
        console.log('[Keimenon] Navigated to unsupported platform.');
        if (adapter && adapter.disconnect) adapter.disconnect();
        adapter = null;
        if (activePort) {
            activePort.postMessage({ 
                action: 'EXTENSION_READY', 
                meta: { adapter: 'none', status: 'idle' } 
            });
        }
    }
}

function handleNewConnection(port) {
    if (activePort) {
        activePort.disconnect(); // Disconnect old if exists
        cleanupSession();
    }
    
    activePort = port;
    
    // Check if we should start observing immediately
    // Only observe if on a chat page (not home page)
    if (adapter && adapter.isSupportedLocation(window.location.href)) {
        startSession();
    } else {
        console.log('[Keimenon] Connected but idle (Home Page or Unsupported View).');
        // Notify panel we are ready but idle?
        port.postMessage({ 
            action: 'EXTENSION_READY', 
            meta: { adapter: adapter ? adapter.name : 'none', capabilities: {}, status: 'idle' } 
        });
    }

    port.onDisconnect.addListener(() => {
        console.log('[Keimenon] Sidepanel disconnected.');
        cleanupSession();
        activePort = null;
    });

    // Handle messages from Side Panel via Port
    port.onMessage.addListener((msg) => {
         if (msg.action === 'GET_MESSAGES') {
             extractAndSend();
         } else if (msg.action === 'SCAN_FULL_CHAT') {
             startScan();
         } else if (msg.action === 'STOP_SCAN') {
             stopScan();
         } else if (msg.action === 'PING') {
             port.postMessage({ status: 'pong' });
         }
    });
}

function startSession() {
    if (!adapter) return;
    console.log('[Keimenon] Starting observation session.');
    
    // Send initial ready state
    if (activePort) {
        activePort.postMessage({ 
            action: 'EXTENSION_READY',
            meta: {
                adapter: adapter.name,
                capabilities: {
                    scan: typeof adapter.scanFullChat === 'function'
                }
            }
        });
    }

    // Initial extraction
    extractAndSend();
    
    // Warm-up Polling: Retry scanning 3 times over 1.5 seconds to catch SPA rendering lag
    // This fixes the "Black Screen" issue where URL changes before DOM is ready
    let retries = 0;
    const warmUp = setInterval(() => {
        retries++;
        extractAndSend();
        if (retries >= 3) clearInterval(warmUp);
    }, 500);

    // Start Observer
    // Delay observer attachment slightly to ensure we target the *new* container if possible?
    // No, standard observe is fine, but we might need to re-find target if it changes.
    // For now, relies on the fact that mutation on body/main will trigger if we fallback.
    adapter.observe(() => {
        extractAndSend();
    });
}

function cleanupSession() {
    console.log('[Keimenon] Cleaning up session.');
    if (adapter) {
        adapter.disconnect();
    }
    if (extractTimeout) clearTimeout(extractTimeout);
    isScanning = false;
    stopScan();
}

let extractTimeout;
let lastMessages = [];

async function extractAndSend() {
    if (!adapter || !activePort) return;
    
    if (extractTimeout) clearTimeout(extractTimeout);
    extractTimeout = setTimeout(async () => {
        const messages = await adapter.runOnce();
        
        if (activePort) {
            try {
                // Calculate Delta
                // Optimization: If the new messages strictly extend the old ones (same ID prefix), send Delta.
                // Otherwise (edits, deletions, reloads), send Full Update.
                
                let isAppendOnly = false;
                let delta = [];
                
                if (messages.length > lastMessages.length && lastMessages.length > 0) {
                    // Check if prefix matches
                    const prefixLength = lastMessages.length;
                    const prefixMatch = lastMessages.every((m, i) => m.id === messages[i].id);
                    
                    if (prefixMatch) {
                        isAppendOnly = true;
                        delta = messages.slice(prefixLength);
                    }
                }
                
                if (isAppendOnly && delta.length > 0) {
                    // Send Append Action
                    activePort.postMessage({
                        action: "MESSAGES_APPEND",
                        payload: { messages: delta },
                        meta: {
                            count: messages.length,
                            adapter: adapter.name,
                            capabilities: {
                                scan: typeof adapter.scanFullChat === "function"
                            }
                        }
                    });
                } else {
                    // Send Full Update (Default)
                    activePort.postMessage({
                        action: "MESSAGES_UPDATED",
                        payload: { messages },
                        meta: {
                            count: messages.length,
                            adapter: adapter.name,
                            capabilities: {
                                scan: typeof adapter.scanFullChat === "function"
                            }
                        }
                    });
                }
                
                lastMessages = messages;

            } catch (e) {
                console.warn("[Keimenon] Failed to post message (disconnected?)");
                cleanupSession();
            }
        }
    }, 200);
}

// Updating startScan to use activePort for completion
async function startScan() {
    if (!adapter || typeof adapter.scanFullChat !== 'function') return;
    if (isScanning) return;
    
    isScanning = true;
    let shouldStop = false;
    
    scanController = {
        stop: () => { shouldStop = true; }
    };

    try {
        if (activePort) activePort.postMessage({ action: 'SCAN_STARTED' }); // Optional feedback
        await adapter.scanFullChat({
            onProgress: (count) => {},
            shouldStop: () => shouldStop
        });
    } catch (err) {
        console.error("Scan failed", err);
    } finally {
        isScanning = false;
        scanController = null;
        extractAndSend();
        if (activePort) activePort.postMessage({ action: 'SCAN_COMPLETE' });
    }
}

function stopScan() {
    if (scanController) {
        scanController.stop();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
