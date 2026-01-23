
// MOCK CHROME API FOR LOCAL PREVIEW

window.chrome = {
    runtime: {
        onMessage: {
            addListener: (callback) => {
                window.onMessageCallback = callback;
            }
        },
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
            callback([{ id: 1, url: 'https://claude.ai/chat/mock-id' }]);
        },
        sendMessage: async (tabId, msg) => {
            console.log('[Mock] tabs.sendMessage:', msg);
            if (msg.action === 'PING') return { status: 'pong', adapter: 'mock-adapter' };
            if (msg.action === 'GET_MESSAGES') return { status: 'ok' };
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

// Mock Test Data
const MOCK_MESSAGES = [
    { id: '1', index: 0, author: 'user', text: 'Hello, this is a mock message for testing the UI. It is short.', charCount: 65, capturedAt: Date.now() },
    { id: '2', index: 1, author: 'user', text: 'This is a much longer message to test the expansion logic. It should be truncated because it is definitely going to be over 300 characters. We want to see if the "Show More" button appears correctly and if the styling looks premium enough for our high standards. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.', charCount: 450, capturedAt: Date.now() },
    { id: '3', index: 2, author: 'user', text: 'Another message here. #3. Just checking spacing.', charCount: 48, capturedAt: Date.now() },
    { id: '4', index: 3, author: 'user', text: 'Hidden candidate? Try hiding me!', charCount: 32, capturedAt: Date.now() }
];

function mockSendMessages() {
    if (window.onMessageCallback) {
        console.log('[Mock] Sending MESSAGES_UPDATED');
        window.onMessageCallback({
            action: 'MESSAGES_UPDATED',
            payload: { messages: MOCK_MESSAGES },
            meta: { adapter: 'mock-adapter', capabilities: { scan: true } }
        }, {}, () => {});
        
        // Also simulate EXTENSION_READY
        // window.onMessageCallback({
        //     action: 'EXTENSION_READY',
        //     meta: { adapter: 'mock-adapter', capabilities: { scan: true } }
        // }, {}, () => {});
    }
}
