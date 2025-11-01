/**
 * Utilities for processing ongoing transcription chunks
 * CommonJS exports to allow easy Jest require() in Node environment
 */

/**
 * Normalize whitespace in text
 * - Collapse tabs and vertical whitespace to single spaces
 * - Collapse multiple spaces
 * - Remove space before punctuation
 * - Trim ends
 */
function normalizeWhitespace(text) {
    return (text || '')
        .replace(/[\t\f\v]+/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .replace(/\s+([,.!?;:])/g, '$1')
        .trim();
}

/**
 * Find the length of the longest case-insensitive overlap where
 * the suffix of prevTail equals the prefix of nextText
 */
function findOverlap(prevTail, nextText, minChars = 15) {
    if (!prevTail || !nextText) return 0;
    const maxLen = Math.min(prevTail.length, nextText.length);
    for (let len = maxLen; len >= minChars; len--) {
        const suffix = prevTail.slice(-len);
        const prefix = nextText.slice(0, len);
        if (suffix.toLowerCase() === prefix.toLowerCase()) {
            return len;
        }
    }
    return 0;
}

/**
 * Remove duplicated prefix of newText if it overlaps with transcript tail
 */
function dedupeWithTail(prevTail, newText, minChars = 12) {
    const overlap = findOverlap(prevTail, newText, minChars);
    if (overlap > 0) {
        return newText.slice(overlap).trimStart();
    }
    return newText;
}

/**
 * Preprocess chunk text: normalize, fix common hyphen artifacts, and de-duplicate overlap
 */
function preprocessChunkText(text, prevTail) {
    if (!text) return '';
    let t = normalizeWhitespace(text);
    t = t.replace(/-\s+/g, '');
    t = dedupeWithTail(prevTail || '', t);
    return t;
}

module.exports = {
    normalizeWhitespace,
    findOverlap,
    dedupeWithTail,
    preprocessChunkText
};

