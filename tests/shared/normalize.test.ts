
import { describe, it, expect } from 'vitest';
import { normalizeText } from '../../src/shared/normalize.js';

describe('normalizeText', () => {
    it('trims leading and trailing whitespace', () => {
        expect(normalizeText('  hello  ')).toBe('hello');
    });

    it('replaces non-breaking spaces with spaces', () => {
        expect(normalizeText('hello\u00A0world')).toBe('hello world');
    });

    it('normalizes CRLF to LF', () => {
        expect(normalizeText('line1\r\nline2')).toBe('line1\nline2');
    });

    it('handles empty input gracefully', () => {
        expect(normalizeText('')).toBe('');
        // @ts-ignore
        expect(normalizeText(null)).toBe('');
        // @ts-ignore
        expect(normalizeText(undefined)).toBe('');
    });
    
    it('preserves internal newlines', () => {
        const text = `Paragraph 1.
        
        Paragraph 2.`;
        // Assuming implementation handles this or just trims ends.
        // Current implementation: replaces CRLF then trims.
        // Let's verify strict behavior.
        const expected = `Paragraph 1.
        
        Paragraph 2.`;
        expect(normalizeText(text)).toBe(expected.trim()); // Only trims ends
    });
});
