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
             
             // CLEAR STATE to prevent mixing chats
             lastMessages = [];

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
        
        // CLEAR STATE
        lastMessages = [];
        
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

let isStartupPhase = false;
let startupRetries = 0;
const MAX_STARTUP_RETRIES = 30; // Increased to 30 (approx 15s coverage) to handle slow loads

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

    // Reset Tracking
    isStartupPhase = true;
    startupRetries = 0;

    // Start robust startup sequence
    attemptStartupExtraction();

    // Start Observer
    adapter.observe(() => {
        // If we get an observation event, immediate extract
        // This might override the retry loop if it finds something
        extractAndSend(true); 
    });
}

async function attemptStartupExtraction() {
    if (!adapter || !activePort) return;
    if (!isStartupPhase) return;

    // 1. Check if it is a chat page (vs Home)
    // This is primarily a URL/Routing check to decide intent
    const isChat = await Promise.resolve(adapter.isChatPage());
    if (!isChat) {
         console.log('[Keimenon] Not a chat page (Home/Other). Sending IDLE.');
         isStartupPhase = false;
         activePort.postMessage({ 
             action: 'EXTENSION_READY', 
             meta: { adapter: adapter.name, status: 'idle' } 
         });
         return;
    }

    // 2. Wait for content to be ready (DOM check)
    // This ensures inputs/messages are actually loaded before scanning
    const isReady = await adapter.waitForReady();
    if (!isReady) {
         console.log('[Keimenon] Timed out waiting for chat interface ready state.');
         // We don't send idle here, we might just send empty or let the next block handle it
         // But usually if waitForReady fails (10s), we probably should stop.
    }

    // 3. Try to find messages
    const messages = await adapter.runOnce();

    if (messages.length > 0) {
        // Success! Found messages.
        console.log('[Keimenon] Startup success: found messages.');
        isStartupPhase = false;
        sendMessagesParams(messages); // Helper to send
    } else {
        // No messages yet
        
        // CRITICAL FIX: Even if verifyReady() verified the input box, 
        // the messages might still be hydrating (common in ChatGPT).
        // Do NOT give up immediately. Fall back to the retry loop.
        
        if (startupRetries >= MAX_STARTUP_RETRIES) {
             console.log('[Keimenon] Startup exhausted (Time limit). Sending empty state.');
             isStartupPhase = false;
             sendMessagesParams([]); // Truly empty
        } else {
             // Continue waiting
             const waitTime = 500;
             console.log(`[Keimenon] Startup retry ${startupRetries + 1}/${MAX_STARTUP_RETRIES} (Messages: 0)... waiting ${waitTime}ms`);
             startupRetries++;
             setTimeout(attemptStartupExtraction, waitTime);
        }
    }
}

function cleanupSession() {
    console.log('[Keimenon] Cleaning up session.');
    if (adapter) {
        adapter.disconnect();
    }
    if (extractTimeout) clearTimeout(extractTimeout);
    isScanning = false;
    isStartupPhase = false;
    stopScan();
}

let extractTimeout;
let lastMessages = [];

// Standard extraction for observer events
async function extractAndSend(fromObserver = false) {
    if (!adapter || !activePort) return;
    
    // If we are in startup phase, let the retry loop handle it UNLESS the observer explicitly fired
    // If observer fired, it implies DOM change, so it's a good time to check.
    
    if (extractTimeout) clearTimeout(extractTimeout);
    extractTimeout = setTimeout(async () => {
        const messages = await adapter.runOnce();
        
        // If we confirm messages, we exit startup phase
        if (messages.length > 0 && isStartupPhase) {
             isStartupPhase = false;
        }

        // If we are still in startup phase and messages are 0, DO NOT SEND.
        // Wait for the retry loop to fail.
        if (isStartupPhase && messages.length === 0) {
            return;
        }

        sendMessagesParams(messages);
    }, 200);
}

function sendMessagesParams(messages) {
    if (!activePort) return;
    try {
        // Calculate Delta
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
