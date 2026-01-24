
import { ChatGPTAdapter } from '../adapters/ChatGPTAdapter.js';

// MOCK CHROME API FOR LOCAL PREVIEW

window.chrome = {
    runtime: {
        onMessage: {
            addListener: (callback) => {
                window.onMessageCallback = callback;
            }
        },
        getManifest: () => ({ version: '1.2.0', oauth2: {} }), // Mock manifest without OAuth to test disabled state
        sendMessage: async (msg) => {
            console.log('[Mock] sendMessage:', msg);
            if (msg.action === 'GET_MESSAGES') {
                // Simulate async response after "getting" messages
                setTimeout(mockSendMessages, 500);
            }
            if (msg.action === 'SCAN_FULL_CHAT') {
                setTimeout(() => {
                   if (window.onMessageCallback) {
                       window.onMessageCallback({ action: 'SCAN_COMPLETE' }, {}, () => {});
                   }
                }, 2000);
            }
        }
    },
    tabs: {
        query: (query, callback) => {
            callback([{ id: 1, url: 'https://chatgpt.com/c/mock-id' }]);
        },
        sendMessage: async (tabId, msg) => {
            console.log('[Mock] tabs.sendMessage:', msg);
            if (msg.action === 'PING') return { status: 'pong', adapter: 'chatgpt' };
            if (msg.action === 'GET_MESSAGES') {
                setTimeout(mockSendMessages, 100);
                return { status: 'ok' };
            }
            return {};
        },
        reload: () => console.log('[Mock] tabs.reload()')
    },
    storage: {
        local: {
            get: (keys, callback) => callback({}),
            set: (data, callback) => {
                console.log('[Mock] storage.set:', data);
                if (callback) callback();
            }
        }
    }
};

async function mockSendMessages() {
    if (window.onMessageCallback) {
        console.log('[Mock] Sending MESSAGES_UPDATED');
        
        // 1. Get the iframe document
        const iframe = document.getElementById('mockBrowserFrame');
        if (!iframe) {
            console.error('Mock browser frame not found!');
            return;
        }

        const doc = iframe.contentDocument || iframe.contentWindow.document;
        
        // 2. Use the REAL adapter to scrape the mock page
        const adapter = new ChatGPTAdapter(doc);
        const messages = await adapter.runOnce();
        
        console.log('[Mock] Scraped messages:', messages);

        window.onMessageCallback({
            action: 'MESSAGES_UPDATED',
            payload: { messages: messages },
            meta: { adapter: 'chatgpt', capabilities: { scan: true } }
        }, {}, () => {});
    }
}

// Make sure window.chrome is available globaly
window.chrome = window.chrome;
