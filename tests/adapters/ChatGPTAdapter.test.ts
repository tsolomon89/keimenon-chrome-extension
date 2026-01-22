
import { describe, it, expect, beforeEach } from 'vitest';
import { ChatGPTAdapter } from '../../src/adapters/ChatGPTAdapter.js';

describe('ChatGPTAdapter (DOM)', () => {
    let adapter: ChatGPTAdapter;

    beforeEach(() => {
        document.body.innerHTML = '';
        adapter = new ChatGPTAdapter();
    });

    it('extracts messages with data-message-author-role="user"', async () => {
        document.body.innerHTML = `
            <div data-message-author-role="user">Hello World</div>
            <div data-message-author-role="assistant">I am AI</div>
            <div data-message-author-role="user">Second Message</div>
        `;

        const messages = await adapter.runOnce();
        
        expect(messages).toHaveLength(2);
        expect(messages[0].text).toBe('Hello World');
        expect(messages[0].author).toBe('user');
        expect(messages[1].text).toBe('Second Message');
    });

    it('generates unique IDs for identical messages (dedupe logic)', async () => {
        // "Dedupe logic: must not collapse legitimate repeated prompts"
        document.body.innerHTML = `
            <div data-message-author-role="user">Repeat</div>
            <div data-message-author-role="user">Repeat</div>
        `;

        const messages = await adapter.runOnce();
        
        expect(messages).toHaveLength(2);
        expect(messages[0].text).toBe('Repeat');
        expect(messages[1].text).toBe('Repeat');
        
        expect(messages[0].id).not.toBe(messages[1].id);
        // ID format contains hash + index, so they must differ by index suffix
        expect(messages[0].id).toContain('_0');
        expect(messages[1].id).toContain('_1');
    });

    it('ignores empty messages', async () => {
        document.body.innerHTML = `
            <div data-message-author-role="user">   </div>
        `;
        const messages = await adapter.runOnce();
        expect(messages).toHaveLength(0);
    });
});
