
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
            callback([{ id: 1, url: 'https://claude.ai/chat/mock-id' }]);
        },
        sendMessage: async (tabId, msg) => {
            console.log('[Mock] tabs.sendMessage:', msg);
            if (msg.action === 'PING') return { status: 'pong', adapter: 'mock-adapter' };
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

// Mock Test Data
const MOCK_MESSAGES = [
    { id: '1', index: 0, author: 'user', text: 'Hello, I need help optimizing a Python script.', charCount: 44, capturedAt: Date.now() },
    { id: '2', index: 1, author: 'user', text: 'Here is the current code:\n\n```python\ndef slow_function(n):\n    result = 0\n    for i in range(n):\n        for j in range(n):\n            result += i * j\n    return result\n```\n\nIt runs very slowly for large N. How can I speed this up using NumPy?', charCount: 248, capturedAt: Date.now() },
    { id: '3', index: 2, author: 'user', text: 'That worked great! Now, can you explain how the vectorization actually works under the hood? I am trying to understand the memory layout implications.', charCount: 152, capturedAt: Date.now() },
    { id: '4', index: 3, author: 'user', text: 'I also have a question about SQL. If I have a table `users` and a table `orders`, how do I find users who have placed exactly 3 orders in the last month? Please provide a standard SQL query.', charCount: 191, capturedAt: Date.now() },
    { id: '5', index: 4, author: 'user', text: 'Hidden thought process test... maybe I should hide this one?', charCount: 60, capturedAt: Date.now() },
    { id: '6', index: 5, author: 'user', text: '# Markdown Test\n\n- Item 1\n- Item 2\n\n> Blockquote test.\n\nThis is a **bold** and *italic* test with some `inline code`.', charCount: 118, capturedAt: Date.now() },
    { id: '7', index: 6, author: 'user', text: 'This is a very long message to test the "Show More" functionality. It repeats to ensure we hit the limit. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.\n\nRepeating for length:\nLorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.', charCount: 660, capturedAt: Date.now() }
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
