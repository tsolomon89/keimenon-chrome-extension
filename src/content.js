import { AdapterFactory } from './adapters/AdapterFactory.js';

// Lifecycle State
let activePort = null;
let adapter = null;
let isScanning = false;
let scanController = null;

function init() {
    adapter = AdapterFactory.createAdapter(window.location.href);
    if (!adapter) return console.log('[Keimenon] No adapter for this page.');

    console.log(`[Keimenon] Initialized adapter: ${adapter.name}`);

    // Listen for long-lived connection from Side Panel
    chrome.runtime.onConnect.addListener((port) => {
        if (port.name === 'sidepanel-connection') {
            console.log('[Keimenon] Sidepanel connected.');
            handleNewConnection(port);
        }
    });
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
            meta: { adapter: adapter.name, capabilities: {}, status: 'idle' } 
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

    extractAndSend();
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

// ... startScan / stopScan can remain mostly same, but use activePort.postMessage instead of runtime.sendMessage ...
// For brevity, assuming startScan/stopScan are adapted or we wrap postMessage. 
// Ideally we update them to use activePort too. 

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
