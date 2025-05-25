/**
 * Unit tests for Whisper model selection functionality
 */

const defaultConfig = require('../../src/config/default');

describe('Model Selection', () => {
    describe('Default Model Configuration', () => {
        test('should include all 10 Whisper models', () => {
            const models = defaultConfig.whisper.availableModels;
            expect(models).toHaveLength(10);
            
            const expectedModels = [
                'tiny', 'tiny.en', 'base', 'base.en', 'small', 'small.en',
                'medium', 'medium.en', 'large', 'turbo'
            ];
            
            const actualModelNames = models.map(m => m.name);
            expect(actualModelNames).toEqual(expectedModels);
        });

        test('should have correct model properties', () => {
            const models = defaultConfig.whisper.availableModels;
            
            models.forEach(model => {
                expect(model).toHaveProperty('name');
                expect(model).toHaveProperty('size');
                expect(model).toHaveProperty('vram');
                expect(model).toHaveProperty('speed');
                expect(model).toHaveProperty('type');
                expect(['multilingual', 'english-only']).toContain(model.type);
            });
        });

        test('should have 4 English-only models', () => {
            const models = defaultConfig.whisper.availableModels;
            const englishOnlyModels = models.filter(m => m.type === 'english-only');
            
            expect(englishOnlyModels).toHaveLength(4);
            expect(englishOnlyModels.map(m => m.name)).toEqual([
                'tiny.en', 'base.en', 'small.en', 'medium.en'
            ]);
        });

        test('should have 6 multilingual models', () => {
            const models = defaultConfig.whisper.availableModels;
            const multilingualModels = models.filter(m => m.type === 'multilingual');
            
            expect(multilingualModels).toHaveLength(6);
            expect(multilingualModels.map(m => m.name)).toEqual([
                'tiny', 'base', 'small', 'medium', 'large', 'turbo'
            ]);
        });
    });

    describe('Model Specifications', () => {
        test('should have correct turbo model specs', () => {
            const models = defaultConfig.whisper.availableModels;
            const turboModel = models.find(m => m.name === 'turbo');
            
            expect(turboModel).toEqual({
                name: 'turbo',
                size: '809M params',
                vram: '~6GB',
                speed: '~8x',
                type: 'multilingual'
            });
        });

        test('should have correct large model specs', () => {
            const models = defaultConfig.whisper.availableModels;
            const largeModel = models.find(m => m.name === 'large');
            
            expect(largeModel).toEqual({
                name: 'large',
                size: '1550M params',
                vram: '~10GB',
                speed: '1x',
                type: 'multilingual'
            });
        });

        test('should have consistent specs for model families', () => {
            const models = defaultConfig.whisper.availableModels;
            
            // Tiny models should have same specs except type
            const tinyModels = models.filter(m => m.name.startsWith('tiny'));
            expect(tinyModels.every(m => m.size === '39M params')).toBe(true);
            expect(tinyModels.every(m => m.vram === '~1GB')).toBe(true);
            expect(tinyModels.every(m => m.speed === '~10x')).toBe(true);
        });
    });

    describe('Model Categories', () => {
        test('should identify low-resource models (1GB VRAM)', () => {
            const models = defaultConfig.whisper.availableModels;
            const lowResourceModels = models.filter(m => m.vram === '~1GB');
            
            expect(lowResourceModels).toHaveLength(4);
            expect(lowResourceModels.map(m => m.name)).toEqual([
                'tiny', 'tiny.en', 'base', 'base.en'
            ]);
        });

        test('should identify fast models (7x+ speed)', () => {
            const models = defaultConfig.whisper.availableModels;
            const fastModels = models.filter(m => {
                if (m.speed === '1x') return false;
                const speedNum = parseInt(m.speed.match(/(\d+)/)[1]);
                return speedNum >= 7;
            });
            
            expect(fastModels.length).toBeGreaterThan(0);
            expect(fastModels.some(m => m.name === 'tiny')).toBe(true);
            expect(fastModels.some(m => m.name === 'turbo')).toBe(true);
        });

        test('should identify high-accuracy models (500M+ params)', () => {
            const models = defaultConfig.whisper.availableModels;
            const highAccuracyModels = models.filter(m => {
                const paramNum = parseInt(m.size.match(/(\d+)/)[1]);
                return paramNum >= 500;
            });
            
            expect(highAccuracyModels.length).toBeGreaterThan(0);
            expect(highAccuracyModels.some(m => m.name === 'medium')).toBe(true);
            expect(highAccuracyModels.some(m => m.name === 'large')).toBe(true);
            expect(highAccuracyModels.some(m => m.name === 'turbo')).toBe(true);
        });
    });

    describe('Configuration Validation', () => {
        test('should have base as default model', () => {
            expect(defaultConfig.whisper.model).toBe('base');
        });

        test('should have all required whisper config properties', () => {
            expect(defaultConfig.whisper).toHaveProperty('model');
            expect(defaultConfig.whisper).toHaveProperty('language');
            expect(defaultConfig.whisper).toHaveProperty('threads');
            expect(defaultConfig.whisper).toHaveProperty('translate');
            expect(defaultConfig.whisper).toHaveProperty('availableModels');
        });

        test('should have valid model names', () => {
            const models = defaultConfig.whisper.availableModels;
            
            models.forEach(model => {
                // Model names should be lowercase and may contain dots
                expect(model.name).toMatch(/^[a-z]+(\.[a-z]+)?$/);
                
                // English-only models should end with .en
                if (model.type === 'english-only') {
                    expect(model.name.endsWith('.en')).toBe(true);
                }
            });
        });
    });
});