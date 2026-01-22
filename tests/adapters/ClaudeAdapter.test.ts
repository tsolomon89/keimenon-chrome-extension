
import { describe, it, expect, beforeEach } from 'vitest';
import { ClaudeAdapter } from '../../src/adapters/ClaudeAdapter.js';

describe('ClaudeAdapter (DOM)', () => {
    let adapter: ClaudeAdapter;

    beforeEach(() => {
        document.body.innerHTML = '';
        adapter = new ClaudeAdapter();
    });

    it('extracts messages with .font-user-message class', async () => {
        document.body.innerHTML = `
            <div class="font-user-message">Claude query</div>
            <div class="font-claude-message">Response</div>
        `;

        const messages = await adapter.runOnce();
        
        expect(messages).toHaveLength(1);
        expect(messages[0].text).toBe('Claude query');
        expect(messages[0].platform).toBe('claude');
    });

    it('handles nested text content correctly', async () => {
        document.body.innerHTML = `
            <div class="font-user-message">
                <p>Line 1</p>
                <p>Line 2</p>
            </div>
        `;
        // innerText behavior in JSDOM might be slightly simple, but normalized text handles newlines
        // Note: JSDOM innerText implementation is sometimes basic. 
        // We will assume JSDOM returns "Line 1\nLine 2" or close to it.
        const messages = await adapter.runOnce();
        expect(messages[0].text).toContain('Line 1');
        expect(messages[0].text).toContain('Line 2');
    });
});
