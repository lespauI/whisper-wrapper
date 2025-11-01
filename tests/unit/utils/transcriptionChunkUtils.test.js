const {
  normalizeWhitespace,
  findOverlap,
  dedupeWithTail,
  preprocessChunkText
} = require('../../../src/utils/transcriptionChunkUtils');

describe('transcriptionChunkUtils', () => {
  describe('normalizeWhitespace', () => {
    it('collapses whitespace and removes space before punctuation', () => {
      const input = 'Hello\tworld   !  This  is\f a\v test  , ok ?';
      const out = normalizeWhitespace(input);
      expect(out).toBe('Hello world! This is a test, ok?');
    });
    it('handles empty input', () => {
      expect(normalizeWhitespace('')).toBe('');
      expect(normalizeWhitespace(null)).toBe('');
      expect(normalizeWhitespace(undefined)).toBe('');
    });
  });

  describe('findOverlap', () => {
    it('finds case-insensitive overlap at the boundary', () => {
      const tail = '... this is the end of the previous'.slice(-25);
      const next = 'previous sentence continues here';
      const overlap = findOverlap(tail, next, 5);
      expect(overlap).toBeGreaterThanOrEqual(8); // "previous" is 8 chars
    });
    it('returns 0 when no overlap', () => {
      expect(findOverlap('abcdef', 'ghijkl', 2)).toBe(0);
    });
  });

  describe('dedupeWithTail', () => {
    it('removes duplicated prefix based on overlap', () => {
      const prevTail = 'The quick brown fox jumps over the lazy dog';
      const next = 'the lazy dog and runs away';
      const deduped = dedupeWithTail(prevTail, next, 4);
      expect(deduped).toBe('and runs away');
    });
    it('keeps original when overlap is below threshold', () => {
      const prevTail = 'Hello there';
      const next = 'General Kenobi';
      expect(dedupeWithTail(prevTail, next, 6)).toBe(next);
    });
  });

  describe('preprocessChunkText', () => {
    it('normalizes whitespace, fixes hyphen splits and dedupes overlap', () => {
      const prevTail = 'We will demon-';
      const next = 'strate     the    feature  .  '; // also ensure punctuation spacing
      const out = preprocessChunkText(next, prevTail);
      expect(out).toBe('strate the feature.');
    });
    it('returns empty for falsy input', () => {
      expect(preprocessChunkText('', 'abc')).toBe('');
      expect(preprocessChunkText(null, 'abc')).toBe('');
    });
  });
});
