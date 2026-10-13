import { describe, it, expect } from 'vitest';
import { chunkText, MAX_CHUNKS } from '../src/services/chunkingService.js';

describe('chunkText', () => {
  it('returns no chunks for empty or whitespace-only text', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   \n\t  ')).toEqual([]);
  });

  it('returns a single chunk for short text', () => {
    const chunks = chunkText('A short document.');
    expect(chunks).toEqual(['A short document.']);
  });

  it('collapses extra whitespace', () => {
    const chunks = chunkText('hello    world\n\nagain');
    expect(chunks[0]).toBe('hello world again');
  });

  it('never creates a chunk longer than 1200 characters', () => {
    const text = Array.from({ length: 3000 }, (_, i) => `w${i}`).join(' ');
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((c) => expect(c.length).toBeLessThanOrEqual(1200));
  });

  it('repeats the last 200 characters of a chunk at the start of the next', () => {
    const text = Array.from({ length: 3000 }, (_, i) => `w${i}`).join(' ');
    const chunks = chunkText(text);
    for (let i = 0; i < chunks.length - 1; i++) {
      expect(chunks[i + 1].slice(0, 200)).toBe(chunks[i].slice(-200));
    }
  });

  it('stops at the maximum number of chunks for very long documents', () => {
    const chunks = chunkText('a'.repeat(300000));
    expect(chunks).toHaveLength(MAX_CHUNKS);
  });
});