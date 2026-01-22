import { AdapterFactory } from './adapters/AdapterFactory.js';

let adapter = null;
let isScanning = false;
let scanController = null;

async function init() {
    adapter = AdapterFactory.createAdapter(window.location.href);
    if (!adapter) {
        return;
    }

    console.log(`[Keimenon] Initialized adapter: ${adapter.name}`);


    // Notify sidepanel that we are ready
    chrome.runtime.sendMessage({ 
        action: 'EXTENSION_READY',
        meta: {
            adapter: adapter.name,
            capabilities: {
                scan: typeof adapter.scanFullChat === 'function'
            }
        }
    }).catch(() => {});

    await extractAndSend();

    adapter.observe(() => {
        extractAndSend();
    });

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'GET_MESSAGES') {
            extractAndSend();
            sendResponse({ status: 'ok' });
        } else if (request.action === 'SCAN_FULL_CHAT') {
            startScan();
            sendResponse({ status: 'started' });
        } else if (request.action === 'STOP_SCAN') {
            stopScan();
            sendResponse({ status: 'stopped' });
        } else if (request.action === 'PING') {
             sendResponse({ status: 'pong', adapter: adapter?.name });
        }
    });
}

let extractTimeout;
async function extractAndSend() {
    if (!adapter) return;
    if (extractTimeout) clearTimeout(extractTimeout);

    extractTimeout = setTimeout(async () => {
        const messages = await adapter.runOnce();
        chrome.runtime.sendMessage({
            action: 'MESSAGES_UPDATED',
            payload: { messages },
            meta: { 
                count: messages.length, 
                adapter: adapter.name,
                capabilities: {
                    scan: typeof adapter.scanFullChat === 'function'
                }
            }
        }).catch(() => {
            // Ignore errors if side panel is closed
        });
    }, 200);
}

async function startScan() {
    if (!adapter || typeof adapter.scanFullChat !== 'function') return;
    if (isScanning) return;
    
    isScanning = true;
    let shouldStop = false;
    
    scanController = {
        stop: () => { shouldStop = true; }
    };

    try {
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
        chrome.runtime.sendMessage({ action: 'SCAN_COMPLETE' }).catch(() => {});
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
