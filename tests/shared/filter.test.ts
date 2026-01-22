
import { describe, it, expect } from 'vitest';
import { filterMessages } from '../../src/shared/filter.js';

describe('filterMessages', () => {
    const messages = [
        { text: 'Apple Pie', charCount: 9 },
        { text: 'Banana Split', charCount: 12 },
        { text: 'Cherry Tart', charCount: 11 },
        { text: 'A long message about nothing', charCount: 28 }
    ];

    it('filters by case-insensitive substring', () => {
        const result = filterMessages(messages, 'pie', 0);
        expect(result).toHaveLength(1);
        expect(result[0].text).toBe('Apple Pie');
    });

    it('filters by minimum length (inclusive)', () => {
        // "A long message..." is 28 chars
        // "Banana Split" is 12
        // "Cherry Tart" is 11
        // "Apple Pie" is 9
        
        const result = filterMessages(messages, '', 12);
        // Should include Banana (12) and Long (28)
        expect(result).toHaveLength(2);
        expect(result.map(m => m.text)).toContain('Banana Split');
        expect(result.map(m => m.text)).toContain('A long message about nothing');
        expect(result.map(m => m.text)).not.toContain('Cherry Tart');
    });

    it('combines query and length filter', () => {
        const result = filterMessages(messages, 'a', 12);
        // Banana (has 'a', 12 chars) -> Yes
        // Long (has 'a', 28 chars) -> Yes
        // Apple (has 'a', 9 chars) -> No (len)
        // Cherry (no 'a', 11 chars) -> No
        
        expect(result).toHaveLength(2);
    });

    it('handles empty query and zero length', () => {
        const result = filterMessages(messages, '', 0);
        expect(result).toHaveLength(4);
    });
});
