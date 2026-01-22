
import { describe, it, expect } from 'vitest';
import { AdapterFactory } from '../../src/adapters/AdapterFactory.js';
import { ChatGPTAdapter } from '../../src/adapters/ChatGPTAdapter.js';
import { ClaudeAdapter } from '../../src/adapters/ClaudeAdapter.js';

describe('AdapterFactory', () => {
    it('returns ChatGPTAdapter for chatgpt.com', () => {
        const adapter = AdapterFactory.createAdapter('https://chatgpt.com/c/123');
        expect(adapter).toBeInstanceOf(ChatGPTAdapter);
    });

    it('returns ChatGPTAdapter for chat.openai.com', () => {
        const adapter = AdapterFactory.createAdapter('https://chat.openai.com/c/123');
        expect(adapter).toBeInstanceOf(ChatGPTAdapter);
    });

    it('returns ClaudeAdapter for claude.ai', () => {
        const adapter = AdapterFactory.createAdapter('https://claude.ai/chat/abc');
        expect(adapter).toBeInstanceOf(ClaudeAdapter);
    });

    it('returns null for unknown domains', () => {
        const adapter = AdapterFactory.createAdapter('https://google.com');
        expect(adapter).toBeNull();
    });
});
