const path = require('path');
const fs = require('fs');
const { LocalWhisperService } = require('../../src/services/localWhisperService');
const config = require('../../src/config');

describe('End-to-End Transcription Test', () => {
    let whisperService;
    const testAudioFile = path.join(__dirname, '../data/test.wav');
    const expectedText = "Thank you for contacting us. All lines are currently busy. Your call is very important to us.";

    beforeAll(async () => {
        // Initialize the whisper service
        whisperService = new LocalWhisperService();
        
        // Check if test audio file exists
        if (!fs.existsSync(testAudioFile)) {
            throw new Error(`Test audio file not found: ${testAudioFile}`);
        }
        
        // Check if whisper is available
        if (!whisperService.isAvailable()) {
            throw new Error('Whisper.cpp is not available. Please run setup first.');
        }
        
        console.log('🎤 Test audio file:', testAudioFile);
        console.log('📊 File size:', fs.statSync(testAudioFile).size, 'bytes');
    });

    test('should transcribe test audio file correctly', async () => {
        console.log('🎬 Starting transcription test...');
        
        // Transcribe the test file
        const result = await whisperService.transcribeFile(testAudioFile, {
            model: 'tiny', // Use 'tiny' model which is available
            threads: 4,
            translate: false
        });

        console.log('🎬 Transcription result:', result);
        console.log('📝 Transcribed text:', result.text);
        console.log('🎬 Segments count:', result.segments?.length || 0);
        
        if (result.segments && result.segments.length > 0) {
            console.log('🎬 First segment:', result.segments[0]);
            result.segments.forEach((segment, index) => {
                console.log(`🎬 Segment ${index}: ${segment.start}s - ${segment.end}s: "${segment.text}"`);
            });
        }

        // Verify the result
        expect(result.success).toBe(true);
        expect(result.text).toBeDefined();
        expect(result.text.length).toBeGreaterThan(0);
        
        // Check if the transcribed text contains key words from expected text
        const transcribedLower = result.text.toLowerCase();
        const expectedWords = ['thank', 'you', 'contacting', 'lines', 'busy', 'call', 'important'];
        
        let matchedWords = 0;
        expectedWords.forEach(word => {
            if (transcribedLower.includes(word)) {
                matchedWords++;
                console.log(`✅ Found expected word: "${word}"`);
            } else {
                console.log(`❌ Missing expected word: "${word}"`);
            }
        });
        
        // Expect at least 70% of key words to be present
        const matchPercentage = (matchedWords / expectedWords.length) * 100;
        console.log(`🎯 Word match percentage: ${matchPercentage.toFixed(1)}%`);
        
        expect(matchPercentage).toBeGreaterThanOrEqual(70);
        
        // Verify segments are present
        if (result.segments) {
            expect(result.segments).toBeInstanceOf(Array);
            expect(result.segments.length).toBeGreaterThan(0);
            
            // Verify segment structure
            result.segments.forEach((segment, index) => {
                expect(segment).toHaveProperty('start');
                expect(segment).toHaveProperty('end');
                expect(segment).toHaveProperty('text');
                expect(typeof segment.start).toBe('number');
                expect(typeof segment.end).toBe('number');
                expect(typeof segment.text).toBe('string');
                expect(segment.end).toBeGreaterThanOrEqual(segment.start);
                expect(segment.text.length).toBeGreaterThan(0);
            });
        }
    }, 30000); // 30 second timeout

    test('should handle audio buffer transcription (simulating recording)', async () => {
        console.log('🎤 Testing audio buffer transcription...');
        
        // Read the test file as a buffer (simulating recorded audio)
        const audioBuffer = fs.readFileSync(testAudioFile);
        console.log('📊 Audio buffer size:', audioBuffer.length, 'bytes');
        
        // Transcribe the buffer
        const result = await whisperService.transcribeBuffer(audioBuffer, {
            model: 'tiny', // Use 'tiny' model which is available
            threads: 4,
            translate: false
        });

        console.log('🎬 Buffer transcription result:', result);
        console.log('📝 Transcribed text:', result.text);
        console.log('🎬 Segments count:', result.segments?.length || 0);

        // Verify the result
        expect(result.success).toBe(true);
        expect(result.text).toBeDefined();
        expect(result.text.length).toBeGreaterThan(0);
        
        // Check if the transcribed text contains key words
        const transcribedLower = result.text.toLowerCase();
        const expectedWords = ['thank', 'you', 'contacting'];
        
        let matchedWords = 0;
        expectedWords.forEach(word => {
            if (transcribedLower.includes(word)) {
                matchedWords++;
                console.log(`✅ Found expected word: "${word}"`);
            }
        });
        
        expect(matchedWords).toBeGreaterThan(0);
    }, 30000); // 30 second timeout
});