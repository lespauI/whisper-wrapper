# Translation Pipeline Architecture

## Overview

The translation pipeline handles the conversion of transcribed text from the source language to the target language using local Ollama models. It's designed to provide accurate, context-aware translations while maintaining real-time performance.

## Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Translation Pipeline                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [Sentence Input] → [Context Analysis] → [Prompt Generation] → [Ollama]     │
│         │                    │                    │              │          │
│         │                    │                    │              ↓          │
│         │                    │                    │         [Post-Process]  │
│         │                    │                    │              │          │
│         │                    ↓                    ↓              ↓          │
│         └─────────→ [Context Memory] ←──── [Quality Check] → [Output]       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Translation Context Manager

**Purpose**: Maintains conversation context for better translation accuracy

```javascript
class TranslationContextManager {
    constructor() {
        this.conversationContext = [];
        this.domainVocabulary = new Map();
        this.speakerProfiles = new Map();
        this.maxContextLength = 10; // Keep last 10 sentences for context
    }
    
    addSentenceToContext(originalText, translatedText, metadata) {
        const contextEntry = {
            original: originalText,
            translated: translatedText,
            timestamp: metadata.timestamp,
            language: metadata.sourceLanguage,
            confidence: metadata.confidence
        };
        
        this.conversationContext.push(contextEntry);
        
        // Maintain context window
        if (this.conversationContext.length > this.maxContextLength) {
            this.conversationContext.shift();
        }
        
        // Extract domain vocabulary
        this.extractDomainTerms(originalText, translatedText);
    }
    
    getRelevantContext(currentSentence) {
        // Return contextual sentences that might help with translation
        const relevantContext = this.conversationContext
            .slice(-3) // Last 3 sentences for immediate context
            .map(entry => ({
                original: entry.original,
                translated: entry.translated
            }));
            
        return relevantContext;
    }
    
    extractDomainTerms(original, translated) {
        // Simple domain term extraction
        const technicalTerms = this.findTechnicalTerms(original);
        technicalTerms.forEach(term => {
            if (!this.domainVocabulary.has(term.toLowerCase())) {
                this.domainVocabulary.set(term.toLowerCase(), {
                    original: term,
                    translated: this.findCorrespondingTranslation(term, original, translated),
                    frequency: 1
                });
            } else {
                const existing = this.domainVocabulary.get(term.toLowerCase());
                existing.frequency++;
            }
        });
    }
}
```

### 2. Translation Prompt Generator

**Purpose**: Creates optimized prompts for different translation scenarios

```javascript
class TranslationPromptGenerator {
    constructor() {
        this.promptTemplates = {
            standard: this.getStandardTemplate(),
            technical: this.getTechnicalTemplate(),
            conversational: this.getConversationalTemplate(),
            formal: this.getFormalTemplate()
        };
    }
    
    generatePrompt(text, sourceLanguage, targetLanguage, context = {}) {
        const template = this.selectTemplate(text, context);
        
        const prompt = template
            .replace('{{SOURCE_LANGUAGE}}', this.getLanguageName(sourceLanguage))
            .replace('{{TARGET_LANGUAGE}}', this.getLanguageName(targetLanguage))
            .replace('{{TEXT}}', text)
            .replace('{{CONTEXT}}', this.formatContext(context))
            .replace('{{DOMAIN_TERMS}}', this.formatDomainTerms(context.domainVocabulary));
            
        return prompt;
    }
    
    getStandardTemplate() {
        return `You are a professional translator. Translate the following text from {{SOURCE_LANGUAGE}} to {{TARGET_LANGUAGE}}.

Requirements:
- Maintain the original meaning and tone
- Use natural {{TARGET_LANGUAGE}} expressions
- Preserve any technical terms appropriately
- Keep the same level of formality

{{CONTEXT}}

{{DOMAIN_TERMS}}

Text to translate:
{{TEXT}}

Translation:`;
    }
    
    getConversationalTemplate() {
        return `You are translating a live conversation from {{SOURCE_LANGUAGE}} to {{TARGET_LANGUAGE}}.

Context: This is part of an ongoing conversation. Previous exchanges:
{{CONTEXT}}

Guidelines:
- Use natural, conversational {{TARGET_LANGUAGE}}
- Maintain the speaker's tone and intent
- Keep the flow of conversation natural
- Use appropriate colloquialisms when suitable

Current text to translate:
{{TEXT}}

Translation:`;
    }
    
    getTechnicalTemplate() {
        return `You are translating technical content from {{SOURCE_LANGUAGE}} to {{TARGET_LANGUAGE}}.

Domain vocabulary (use these translations for consistency):
{{DOMAIN_TERMS}}

Previous context:
{{CONTEXT}}

Requirements:
- Maintain technical accuracy
- Use established terminology
- Keep technical concepts precise
- Preserve any specific technical formatting

Text to translate:
{{TEXT}}

Translation:`;
    }
    
    selectTemplate(text, context) {
        // Simple heuristic to select appropriate template
        const technicalIndicators = [
            'API', 'database', 'server', 'application', 'system', 'configuration',
            'algorithm', 'function', 'variable', 'object', 'method', 'class'
        ];
        
        const conversationalIndicators = [
            'hello', 'hi', 'how are you', 'thanks', 'please', 'sorry', 'yes', 'no',
            'what do you think', 'I think', 'maybe', 'probably'
        ];
        
        const textLower = text.toLowerCase();
        
        const technicalScore = technicalIndicators.reduce((score, term) => 
            score + (textLower.includes(term.toLowerCase()) ? 1 : 0), 0);
            
        const conversationalScore = conversationalIndicators.reduce((score, term) => 
            score + (textLower.includes(term.toLowerCase()) ? 1 : 0), 0);
        
        if (technicalScore > conversationalScore && technicalScore > 0) {
            return this.promptTemplates.technical;
        } else if (conversationalScore > 0) {
            return this.promptTemplates.conversational;
        } else {
            return this.promptTemplates.standard;
        }
    }
}
```

### 3. Translation Quality Checker

**Purpose**: Validates and improves translation quality

```javascript
class TranslationQualityChecker {
    constructor() {
        this.qualityThresholds = {
            minLength: 2, // Minimum characters
            maxLengthRatio: 3.0, // Max ratio of translated to original length
            minSimilarity: 0.3 // Minimum semantic similarity
        };
    }
    
    async checkTranslationQuality(original, translated, sourceLanguage, targetLanguage) {
        const qualityMetrics = {
            isValid: true,
            confidence: 1.0,
            issues: [],
            suggestions: []
        };
        
        // Length validation
        const lengthIssue = this.checkLength(original, translated);
        if (lengthIssue) {
            qualityMetrics.issues.push(lengthIssue);
            qualityMetrics.confidence *= 0.8;
        }
        
        // Content validation
        const contentIssues = this.checkContent(original, translated);
        if (contentIssues.length > 0) {
            qualityMetrics.issues.push(...contentIssues);
            qualityMetrics.confidence *= 0.7;
        }
        
        // Language detection
        const languageIssue = await this.checkTargetLanguage(translated, targetLanguage);
        if (languageIssue) {
            qualityMetrics.issues.push(languageIssue);
            qualityMetrics.confidence *= 0.6;
            qualityMetrics.isValid = false;
        }
        
        return qualityMetrics;
    }
    
    checkLength(original, translated) {
        if (translated.length < this.qualityThresholds.minLength) {
            return {
                type: 'length',
                severity: 'high',
                message: 'Translation too short',
                suggestion: 'Retry with more context'
            };
        }
        
        const lengthRatio = translated.length / original.length;
        if (lengthRatio > this.qualityThresholds.maxLengthRatio) {
            return {
                type: 'length',
                severity: 'medium',
                message: 'Translation significantly longer than original',
                suggestion: 'Check for unnecessary explanations'
            };
        }
        
        return null;
    }
    
    checkContent(original, translated) {
        const issues = [];
        
        // Check for untranslated text (same as original)
        if (original.trim().toLowerCase() === translated.trim().toLowerCase()) {
            issues.push({
                type: 'content',
                severity: 'high',
                message: 'Translation identical to original',
                suggestion: 'Retry translation'
            });
        }
        
        // Check for translation artifacts
        const artifacts = ['{{', '}}', '[TRANSLATION]', 'TRANSLATE:', 'Translation:'];
        const hasArtifacts = artifacts.some(artifact => 
            translated.toLowerCase().includes(artifact.toLowerCase()));
            
        if (hasArtifacts) {
            issues.push({
                type: 'content',
                severity: 'high',
                message: 'Translation contains processing artifacts',
                suggestion: 'Clean up translation output'
            });
        }
        
        return issues;
    }
    
    async checkTargetLanguage(translated, expectedLanguage) {
        // Simple language detection based on character patterns
        const languagePatterns = {
            'es': /[ñáéíóúü]/i,
            'fr': /[àâäçéèêëïîôöùûüÿ]/i,
            'de': /[äöüß]/i,
            'it': /[àèéìíîòóù]/i,
            'pt': /[ãçáâàéêíóôõú]/i,
            'ru': /[а-яё]/i,
            'zh': /[\u4e00-\u9fff]/,
            'ja': /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]/,
            'ko': /[\uac00-\ud7af]/
        };
        
        if (expectedLanguage === 'en') {
            // Check if translation contains non-English characters
            const hasNonEnglish = Object.values(languagePatterns)
                .some(pattern => pattern.test(translated));
                
            if (hasNonEnglish) {
                return {
                    type: 'language',
                    severity: 'high',
                    message: 'Translation does not appear to be in English',
                    suggestion: 'Retry translation with explicit language specification'
                };
            }
        } else if (languagePatterns[expectedLanguage]) {
            const pattern = languagePatterns[expectedLanguage];
            if (!pattern.test(translated)) {
                return {
                    type: 'language',
                    severity: 'medium',
                    message: `Translation may not be in ${expectedLanguage}`,
                    suggestion: 'Verify target language setting'
                };
            }
        }
        
        return null;
    }
}
```

### 4. Translation Pipeline Orchestrator

**Purpose**: Coordinates the entire translation process

```javascript
class TranslationPipelineOrchestrator {
    constructor() {
        this.contextManager = new TranslationContextManager();
        this.promptGenerator = new TranslationPromptGenerator();
        this.qualityChecker = new TranslationQualityChecker();
        this.ollamaService = new OllamaService();
        
        this.translationQueue = [];
        this.isProcessing = false;
        this.maxRetries = 2;
    }
    
    async translateSentence(sentenceSegment, sourceLanguage, targetLanguage) {
        const translationRequest = {
            id: sentenceSegment.id,
            segment: sentenceSegment,
            sourceLanguage,
            targetLanguage,
            attempts: 0,
            startTime: Date.now()
        };
        
        return await this.processTranslationRequest(translationRequest);
    }
    
    async processTranslationRequest(request) {
        request.attempts++;
        
        try {
            // Get relevant context
            const context = this.contextManager.getRelevantContext(request.segment.text);
            
            // Generate optimized prompt
            const prompt = this.promptGenerator.generatePrompt(
                request.segment.text,
                request.sourceLanguage,
                request.targetLanguage,
                {
                    previousContext: context,
                    domainVocabulary: this.contextManager.domainVocabulary
                }
            );
            
            // Call Ollama for translation
            const ollamaResult = await this.ollamaService.refineText(
                request.segment.text,
                prompt
            );
            
            if (!ollamaResult.success) {
                throw new Error(`Ollama translation failed: ${ollamaResult.message}`);
            }
            
            const translatedText = this.cleanTranslationOutput(ollamaResult.refinedText);
            
            // Quality check
            const qualityCheck = await this.qualityChecker.checkTranslationQuality(
                request.segment.text,
                translatedText,
                request.sourceLanguage,
                request.targetLanguage
            );
            
            if (!qualityCheck.isValid && request.attempts < this.maxRetries) {
                console.warn(`Translation quality issues, retrying: ${qualityCheck.issues.map(i => i.message).join(', ')}`);
                return await this.processTranslationRequest(request);
            }
            
            // Add to context for future translations
            this.contextManager.addSentenceToContext(
                request.segment.text,
                translatedText,
                {
                    timestamp: request.segment.timestamp,
                    sourceLanguage: request.sourceLanguage,
                    confidence: qualityCheck.confidence
                }
            );
            
            return {
                success: true,
                translatedText,
                confidence: qualityCheck.confidence,
                processingTime: Date.now() - request.startTime,
                attempts: request.attempts,
                qualityMetrics: qualityCheck
            };
            
        } catch (error) {
            if (request.attempts < this.maxRetries) {
                console.warn(`Translation attempt ${request.attempts} failed, retrying:`, error.message);
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 1000 * request.attempts));
                return await this.processTranslationRequest(request);
            }
            
            return {
                success: false,
                error: error.message,
                translatedText: '[Translation failed]',
                attempts: request.attempts,
                processingTime: Date.now() - request.startTime
            };
        }
    }
    
    cleanTranslationOutput(rawTranslation) {
        // Remove common translation artifacts
        let cleaned = rawTranslation.trim();
        
        // Remove translation prefixes
        const prefixes = [
            /^Translation:\s*/i,
            /^Translated text:\s*/i,
            /^Here is the translation:\s*/i,
            /^The translation is:\s*/i
        ];
        
        prefixes.forEach(prefix => {
            cleaned = cleaned.replace(prefix, '');
        });
        
        // Remove quotes if they wrap the entire translation
        if ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
            (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
            cleaned = cleaned.slice(1, -1);
        }
        
        // Remove extra whitespace
        cleaned = cleaned.replace(/\s+/g, ' ').trim();
        
        return cleaned;
    }
}
```

## Model Selection Strategy

### Optimized Models for Different Scenarios

```javascript
const translationModelStrategy = {
    // Fast, real-time translation
    realtime: {
        model: 'llama3:8b',
        temperature: 0.1,
        maxTokens: 512,
        timeout: 15000 // 15 seconds
    },
    
    // Accurate, quality translation
    quality: {
        model: 'llama3:70b',
        temperature: 0.05,
        maxTokens: 1024,
        timeout: 60000 // 60 seconds
    },
    
    // Balanced approach
    balanced: {
        model: 'gemma3:12b',
        temperature: 0.1,
        maxTokens: 768,
        timeout: 30000 // 30 seconds
    },
    
    selectModel(requirements) {
        if (requirements.realtime && requirements.latency < 10000) {
            return this.realtime;
        } else if (requirements.quality && !requirements.realtime) {
            return this.quality;
        } else {
            return this.balanced;
        }
    }
};
```

## Performance Optimization

### Batching and Caching

```javascript
class TranslationOptimizer {
    constructor() {
        this.translationCache = new Map(); // Cache for repeated phrases
        this.batchQueue = [];
        this.batchTimeout = null;
        this.maxBatchSize = 3;
        this.batchWaitTime = 200; // milliseconds
    }
    
    async optimizedTranslate(sentences, sourceLanguage, targetLanguage) {
        // Check cache first
        const cacheResults = sentences.map(sentence => {
            const cacheKey = `${sourceLanguage}-${targetLanguage}-${sentence.text}`;
            return this.translationCache.get(cacheKey);
        }).filter(Boolean);
        
        // Process uncached sentences
        const uncachedSentences = sentences.filter((sentence, index) => 
            !cacheResults[index]);
        
        if (uncachedSentences.length === 0) {
            return cacheResults;
        }
        
        // Batch similar sentences for efficiency
        const batches = this.createOptimalBatches(uncachedSentences);
        const batchResults = await Promise.all(
            batches.map(batch => this.processBatch(batch, sourceLanguage, targetLanguage))
        );
        
        // Cache results
        batchResults.flat().forEach(result => {
            const cacheKey = `${sourceLanguage}-${targetLanguage}-${result.original}`;
            this.translationCache.set(cacheKey, result);
        });
        
        return [...cacheResults, ...batchResults.flat()];
    }
    
    createOptimalBatches(sentences) {
        // Group sentences by similarity for better context
        const batches = [];
        let currentBatch = [];
        
        sentences.forEach(sentence => {
            if (currentBatch.length < this.maxBatchSize) {
                currentBatch.push(sentence);
            } else {
                batches.push(currentBatch);
                currentBatch = [sentence];
            }
        });
        
        if (currentBatch.length > 0) {
            batches.push(currentBatch);
        }
        
        return batches;
    }
}
```

## Error Recovery Strategies

### Translation Fallback System

```javascript
const translationFallbacks = {
    async handleTranslationFailure(sentence, sourceLanguage, targetLanguage, error) {
        console.warn(`Primary translation failed: ${error.message}`);
        
        // Fallback 1: Try with simpler prompt
        try {
            const simplePrompt = `Translate to ${targetLanguage}: ${sentence.text}`;
            const result = await this.ollamaService.refineText(sentence.text, simplePrompt);
            if (result.success) {
                return { success: true, translatedText: result.refinedText, method: 'simple-prompt' };
            }
        } catch (fallbackError) {
            console.warn('Simple prompt fallback failed:', fallbackError.message);
        }
        
        // Fallback 2: Word-by-word translation for very short sentences
        if (sentence.text.split(' ').length <= 3) {
            try {
                const wordTranslation = await this.translateWordByWord(sentence.text, sourceLanguage, targetLanguage);
                return { success: true, translatedText: wordTranslation, method: 'word-by-word' };
            } catch (wordError) {
                console.warn('Word-by-word fallback failed:', wordError.message);
            }
        }
        
        // Fallback 3: Return original with indication
        return {
            success: false,
            translatedText: `[${sentence.text}]`, // Original in brackets
            method: 'no-translation',
            error: error.message
        };
    }
};
```

This translation pipeline provides robust, context-aware, and high-quality translations while maintaining the performance needed for real-time applications.