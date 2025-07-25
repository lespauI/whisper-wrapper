/**
 * SentenceSegmentationService - Handles intelligent text segmentation for proper sentence alignment
 * This service splits transcribed text into sentences and maintains alignment between 
 * original and translated text for the ongoing translation feature.
 */

class SentenceSegmentationService {
    constructor() {
        this.pendingText = '';
        this.completedSentences = [];
        this.sentenceId = 0;
        
        // Configuration
        this.minSentenceLength = 3;
        this.maxPendingLength = 500; // Max characters to keep in pending
        
        console.log('📝 SentenceSegmentationService: Initialized');
    }
    
    /**
     * Process incoming text chunk and extract complete sentences
     * @param {string} text - New text chunk to process
     * @param {boolean} isComplete - Whether this is the final chunk (force completion)
     * @returns {Array} - Array of sentence objects
     */
    processTextChunk(text, isComplete = false) {
        if (typeof text !== 'string' || (!text && !isComplete)) {
            console.warn('📝 SentenceSegmentationService: Invalid text input:', text);
            return [];
        }
        
        // Clean and normalize the text
        const cleanedText = this.cleanText(text);
        
        // Merge with pending text
        this.pendingText = this.mergePendingText(cleanedText);
        
        console.log(`📝 SentenceSegmentationService: Processing "${cleanedText}" (pending: "${this.pendingText}")`);
        
        // Extract complete sentences
        const sentences = this.extractCompleteSentences(this.pendingText, isComplete);
        
        // Create sentence segments
        const sentenceSegments = sentences.map(sentenceText => 
            this.createSentenceSegment(sentenceText)
        );
        
        console.log(`📝 SentenceSegmentationService: Extracted ${sentences.length} complete sentences`);
        
        return sentenceSegments;
    }
    
    /**
     * Clean and normalize text
     * @param {string} text - Raw text
     * @returns {string} - Cleaned text
     * @private
     */
    cleanText(text) {
        return text
            .trim()
            .replace(/\s+/g, ' ') // Normalize whitespace
            .replace(/([.!?])\s+/g, '$1 ') // Normalize sentence endings
            .replace(/\.\.\./g, '…') // Replace multiple dots with ellipsis
            .replace(/([?!])\1+([?!])\2*/g, '$1$2') // "??!!" -> "?!"
            .replace(/([.!?])\1+/g, '$1'); // Remove other duplicate punctuation
    }
    
    /**
     * Merge new text with pending text
     * @param {string} newText - New text to add
     * @returns {string} - Combined text
     * @private
     */
    mergePendingText(newText) {
        let combinedText = this.pendingText;
        
        // Add space between pending and new text if needed
        if (combinedText && newText && !combinedText.endsWith(' ') && !newText.startsWith(' ')) {
            combinedText += ' ';
        }
        
        combinedText += newText;
        
        // Prevent pending text from growing too large
        if (combinedText.length > this.maxPendingLength) {
            // Find a good breaking point (preferably after punctuation)
            const breakPoint = this.findSafeBreakPoint(combinedText, this.maxPendingLength - 100);
            if (breakPoint > 0) {
                combinedText = combinedText.substring(breakPoint).trim();
            }
        }
        
        return combinedText;
    }
    
    /**
     * Find a safe point to break long text
     * @param {string} text - Text to break
     * @param {number} maxLength - Maximum length before break
     * @returns {number} - Break point index
     * @private
     */
    findSafeBreakPoint(text, maxLength) {
        if (text.length <= maxLength) {
            return -1;
        }
        
        // Look for sentence endings near the max length
        const searchStart = Math.max(0, maxLength - 50);
        const searchText = text.substring(searchStart, maxLength);
        
        const sentenceEnders = /[.!?]/g;
        let lastMatch = -1;
        let match;
        
        while ((match = sentenceEnders.exec(searchText)) !== null) {
            lastMatch = match.index;
        }
        
        if (lastMatch >= 0) {
            return searchStart + lastMatch + 1;
        }
        
        // Fall back to word boundary
        const words = text.substring(0, maxLength).split(' ');
        return words.slice(0, -1).join(' ').length;
    }
    
    /**
     * Extract complete sentences from text
     * @param {string} text - Text to process
     * @param {boolean} forceComplete - Force completion of pending sentences
     * @returns {Array} - Array of complete sentences
     * @private
     */
    extractCompleteSentences(text, forceComplete = false) {
        const sentences = [];
        
        // Define sentence-ending patterns for different languages
        const sentenceEnders = /[.!?]+(?:\s|$)/g;
        const abbreviations = this.getCommonAbbreviations();
        
        let lastIndex = 0;
        let match;
        
        while ((match = sentenceEnders.exec(text)) !== null) {
            const potentialSentence = text.substring(lastIndex, match.index + match[0].length).trim();
            
            // Check if this is a real sentence ending (not an abbreviation)
            if (this.isRealSentenceEnding(potentialSentence, abbreviations)) {
                if (potentialSentence.length >= this.minSentenceLength) {
                    sentences.push(potentialSentence);
                    lastIndex = match.index + match[0].length;
                }
            }
        }
        
        // Update pending text with remaining content
        const remainingText = text.substring(lastIndex).trim();
        
        if (forceComplete && remainingText.length >= this.minSentenceLength) {
            // If we're forcing completion, add the remaining text as a sentence
            sentences.push(remainingText);
            this.pendingText = '';
        } else {
            // Keep remaining text as pending
            this.pendingText = remainingText;
        }
        
        return sentences;
    }
    
    /**
     * Check if a potential sentence ending is real (not an abbreviation)
     * @param {string} sentence - Potential sentence
     * @param {Set} abbreviations - Known abbreviations
     * @returns {boolean} - True if real sentence ending
     * @private
     */
    isRealSentenceEnding(sentence, abbreviations) {
        // Check if the sentence ends with a known abbreviation
        const words = sentence.trim().split(/\s+/);
        const lastWord = words[words.length - 1];
        
        if (lastWord && lastWord.endsWith('.')) {
            const wordWithoutPunctuation = lastWord.replace(/\.$/, '').toLowerCase();
            
            // Check against known abbreviations
            if (abbreviations.has(wordWithoutPunctuation)) {
                return false;
            }
            
            // Check for patterns like "Mr.", "Dr.", etc.
            if (/^[A-Z][a-z]?$/.test(lastWord.replace(/\.$/, ''))) {
                if (abbreviations.has(wordWithoutPunctuation)) {
                    return false;
                }
            }
        }
        
        // Also check if the sentence is short and ends right after an abbreviation
        // (like "Mr. Smith" where "Smith" doesn't end with period but follows "Mr.")
        if (words.length >= 2) {
            const secondToLastWord = words[words.length - 2];
            if (secondToLastWord && secondToLastWord.endsWith('.')) {
                const wordWithoutPunctuation = secondToLastWord.replace(/\.$/, '').toLowerCase();
                if (abbreviations.has(wordWithoutPunctuation)) {
                    // This is a short sentence that follows an abbreviation
                    return false;
                }
            }
        }
        
        // Check for numbers with decimals (like "3.14")
        if (/\d+\.\d*$/.test(sentence.trim())) {
            return false;
        }
        
        // Check for URLs or file extensions
        if (/\w+\.\w+$/.test(sentence.trim())) {
            const lastPart = sentence.trim().split(' ').pop();
            if (lastPart.includes('.') && !lastPart.match(/[.!?]\s*$/)) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Get common abbreviations for different languages
     * @returns {Set} - Set of abbreviations
     * @private
     */
    getCommonAbbreviations() {
        const abbreviations = new Set([
            // English
            'mr', 'mrs', 'ms', 'dr', 'prof', 'rev', 'fr', 'sr', 'jr',
            'vs', 'etc', 'inc', 'ltd', 'corp', 'co', 'ave', 'st', 'rd',
            'blvd', 'apt', 'no', 'vol', 'pp', 'ed', 'eds', 'ph', 'phd',
            'md', 'ba', 'ma', 'bs', 'ms', 'llb', 'jd', 'ca', 'cpa',
            
            // Spanish
            'sr', 'sra', 'srta', 'dr', 'dra', 'prof', 'ing', 'lic',
            'mtro', 'mtra', 'c', 'av', 'blvr', 'col', 'fracc',
            
            // French
            'mr', 'mme', 'mlle', 'dr', 'prof', 'st', 'ste', 'ave',
            'bd', 'fg', 'pl', 'r', 'rte', 'sq',
            
            // German
            'hr', 'fr', 'dr', 'prof', 'ing', 'str', 'pl', 'geb',
            'ca', 'bzw', 'inkl', 'zzgl', 'mwst', 'nr', 'tel',
            
            // Italian
            'sig', 'sigg', 'sigra', 'dott', 'prof', 'ing', 'avv',
            'via', 'vle', 'pza', 'corso', 'largo',
            
            // Common across languages
            'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
            'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'
        ]);
        
        return abbreviations;
    }
    
    /**
     * Create sentence segment object
     * @param {string} text - Sentence text
     * @returns {Object} - Sentence segment
     * @private
     */
    createSentenceSegment(text) {
        const segment = {
            id: `sentence_${++this.sentenceId}`,
            text: text.trim(),
            isComplete: true,
            confidence: this.calculateConfidence(text),
            wordCount: text.trim().split(/\s+/).length,
            timestamp: Date.now()
        };
        
        // Add to completed sentences
        this.completedSentences.push(segment);
        
        console.log(`📝 SentenceSegmentationService: Created sentence segment "${segment.text}" (confidence: ${segment.confidence})`);
        
        return segment;
    }
    
    /**
     * Calculate confidence score for sentence completeness
     * @param {string} text - Sentence text
     * @returns {number} - Confidence score (0-1)
     * @private
     */
    calculateConfidence(text) {
        let confidence = 0.5; // Base confidence
        
        // Boost confidence for proper sentence endings
        if (/[.!?]+$/.test(text.trim())) {
            confidence += 0.3;
        }
        
        // Boost confidence for reasonable length
        const wordCount = text.trim().split(/\s+/).length;
        if (wordCount >= 3 && wordCount <= 20) {
            confidence += 0.2;
        } else if (wordCount > 20) {
            confidence -= 0.1; // Long sentences might be merged
        }
        
        // Boost confidence for starting with capital letter
        if (/^[A-Z]/.test(text.trim())) {
            confidence += 0.1;
        }
        
        // Reduce confidence for incomplete indicators
        if (text.includes('...') || text.includes('…')) {
            confidence -= 0.2;
        }
        
        // Ensure confidence is between 0 and 1
        return Math.max(0, Math.min(1, confidence));
    }
    
    /**
     * Validate sentence text
     * @param {string} text - Text to validate
     * @returns {boolean} - True if valid sentence
     */
    validateSentence(text) {
        if (!text || typeof text !== 'string') {
            return false;
        }
        
        const trimmed = text.trim();
        
        // Must have minimum length
        if (trimmed.length < this.minSentenceLength) {
            return false;
        }
        
        // Must contain at least one letter
        if (!/[a-zA-Z]/.test(trimmed)) {
            return false;
        }
        
        // Should not be only punctuation
        if (/^[^\w\s]+$/.test(trimmed)) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Force completion of pending text as a sentence
     * @returns {Array} - Array of sentence segments
     */
    forceCompletePending() {
        if (!this.pendingText || this.pendingText.trim().length < this.minSentenceLength) {
            return [];
        }
        
        console.log(`📝 SentenceSegmentationService: Force completing pending: "${this.pendingText}"`);
        
        const segment = this.createSentenceSegment(this.pendingText);
        this.pendingText = '';
        
        return [segment];
    }
    
    /**
     * Get current pending text
     * @returns {string} - Pending text
     */
    getPendingText() {
        return this.pendingText;
    }
    
    /**
     * Clear pending text
     */
    clearPending() {
        this.pendingText = '';
        console.log('📝 SentenceSegmentationService: Pending text cleared');
    }
    
    /**
     * Get completed sentences
     * @returns {Array} - Array of completed sentence segments
     */
    getCompletedSentences() {
        return [...this.completedSentences];
    }
    
    /**
     * Clear completed sentences history
     */
    clearCompleted() {
        this.completedSentences = [];
        console.log('📝 SentenceSegmentationService: Completed sentences cleared');
    }
    
    /**
     * Reset the service state
     */
    reset() {
        this.pendingText = '';
        this.completedSentences = [];
        this.sentenceId = 0;
        console.log('📝 SentenceSegmentationService: Service reset');
    }
    
    /**
     * Get service statistics
     * @returns {Object} - Service statistics
     */
    getStats() {
        const totalWords = this.completedSentences.reduce((sum, sentence) => 
            sum + sentence.wordCount, 0);
            
        const avgConfidence = this.completedSentences.length > 0 
            ? this.completedSentences.reduce((sum, sentence) => 
                sum + sentence.confidence, 0) / this.completedSentences.length 
            : 0;
        
        return {
            completedSentences: this.completedSentences.length,
            pendingTextLength: this.pendingText.length,
            totalWords,
            averageConfidence: Math.round(avgConfidence * 100) / 100,
            averageWordsPerSentence: this.completedSentences.length > 0 
                ? Math.round(totalWords / this.completedSentences.length) 
                : 0
        };
    }
    
    /**
     * Process multiple text chunks in sequence
     * @param {Array} textChunks - Array of text chunks
     * @param {boolean} isComplete - Whether this is the final batch
     * @returns {Array} - Array of all sentence segments
     */
    processMultipleChunks(textChunks, isComplete = false) {
        let allSegments = [];
        
        textChunks.forEach((chunk, index) => {
            const isLastChunk = index === textChunks.length - 1;
            const segments = this.processTextChunk(chunk, isComplete && isLastChunk);
            allSegments = allSegments.concat(segments);
        });
        
        return allSegments;
    }
    
    /**
     * Get service configuration
     * @returns {Object} - Current configuration
     */
    getConfig() {
        return {
            minSentenceLength: this.minSentenceLength,
            maxPendingLength: this.maxPendingLength
        };
    }
    
    /**
     * Update service configuration
     * @param {Object} config - New configuration
     */
    updateConfig(config) {
        if (config.minSentenceLength !== undefined) {
            this.minSentenceLength = Math.max(1, config.minSentenceLength);
        }
        
        if (config.maxPendingLength !== undefined) {
            this.maxPendingLength = Math.max(100, config.maxPendingLength);
        }
        
        console.log('📝 SentenceSegmentationService: Configuration updated:', this.getConfig());
    }
}

module.exports = SentenceSegmentationService;