
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChatGPTAdapter } from '../src/adapters/ChatGPTAdapter.js';
import { ClaudeAdapter } from '../src/adapters/ClaudeAdapter.js';
import { JSDOM } from 'jsdom';

describe('Adapters', () => {
    let dom;

    beforeEach(() => {
        dom = new JSDOM('<!DOCTYPE html><body></body>', {
            url: 'https://chatgpt.com/c/1234-5678'
        });
        global.document = dom.window.document;
        global.window = dom.window;
        global.MutationObserver = vi.fn(() => ({
            observe: vi.fn(),
            disconnect: vi.fn()
        }));
    });

    describe('ChatGPTAdapter', () => {
        it('detects supported URLs correctly', () => {
            const adapter = new ChatGPTAdapter();
            expect(adapter.isSupportedLocation('https://chatgpt.com/c/123-abc')).toBe(true);
            expect(adapter.isSupportedLocation('https://chat.openai.com/c/123-abc')).toBe(true);
            expect(adapter.isSupportedLocation('https://claude.ai/chat/abc')).toBe(false);
        });

        it('extracts conversation ID', () => {
            const adapter = new ChatGPTAdapter();
            expect(adapter.getConversationId('https://chatgpt.com/c/1234-5678-abcd')).toBe('1234-5678-abcd');
        });

        it('extracts messages', async () => {
            const adapter = new ChatGPTAdapter();
            
            // Mock DOM
            const userMsg = document.createElement('div');
            userMsg.setAttribute('data-message-author-role', 'user');
            userMsg.textContent = 'Hello World';
            document.body.appendChild(userMsg);

            const result = await adapter.runOnce();
            expect(result).toHaveLength(1);
            expect(result[0].text).toBe('Hello World');
            expect(result[0].author).toBe('user');
        });
    });

    describe('ClaudeAdapter', () => {
        it('detects supported URLs correctly', () => {
            const adapter = new ClaudeAdapter();
            expect(adapter.isSupportedLocation('https://claude.ai/chat/123-abc')).toBe(true);
            expect(adapter.isSupportedLocation('https://chatgpt.com/')).toBe(false);
        });
        
         it('extracts messages', async () => {
            const adapter = new ClaudeAdapter();
            
            // Mock DOM for Claude
            const userMsg = document.createElement('div');
            userMsg.className = 'font-user-message';
            userMsg.textContent = 'Claude Prompt';
            document.body.appendChild(userMsg);

            const result = await adapter.runOnce();
            expect(result).toHaveLength(1);
            expect(result[0].text).toBe('Claude Prompt');
        });
    });
});
