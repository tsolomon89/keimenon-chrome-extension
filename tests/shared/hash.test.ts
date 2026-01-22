
import { describe, it, expect } from 'vitest';
import { generateMessageHash, generateOccurrenceKey } from '../../src/shared/hash.js';

describe('generateMessageHash', () => {
    it('returns a SHA-256 derived hex string', async () => {
        const hash = await generateMessageHash('test');
        expect(hash).toMatch(/^[a-f0-9]{16}$/); // We truncate to 16
    });

    it('returns consistent hash for same content', async () => {
         const h1 = await generateMessageHash('hello world');
         const h2 = await generateMessageHash('hello world');
         expect(h1).toBe(h2);
    });

    it('returns different hash for different content', async () => {
        const h1 = await generateMessageHash('hello');
        const h2 = await generateMessageHash('world');
        expect(h1).not.toBe(h2);
    });
});

describe('generateOccurrenceKey', () => {
    it('combines hash and index', () => {
        const key = generateOccurrenceKey('abc', 5);
        expect(key).toBe('abc_5');
    });
    
    it('preserves deduplication via unique indices', () => {
        // "Dedupe logic" requirement: Don't conflate same text as same occurrence
        const hash = 'abc'; // same hash
        const k1 = generateOccurrenceKey(hash, 0);
        const k2 = generateOccurrenceKey(hash, 1);
        expect(k1).not.toBe(k2);
        expect(k1).toContain('abc');
        expect(k2).toContain('abc');
    });
});
