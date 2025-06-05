/**
 * Test script for demonstrating the initial_prompt functionality
 * 
 * Usage:
 * node scripts/test-initial-prompt.js <audio-file-path> <prompt>
 * 
 * Example:
 * node scripts/test-initial-prompt.js ./test.mp3 "Technical terms: Node.js, JavaScript, React"
 */

const { LocalWhisperService } = require('../src/services/localWhisperService');
const path = require('path');

async function testInitialPrompt() {
    // Get command line arguments
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
        console.error('Usage: node scripts/test-initial-prompt.js <audio-file-path> <prompt>');
        process.exit(1);
    }
    
    const audioFilePath = path.resolve(args[0]);
    const initialPrompt = args[1];
    
    console.log('='.repeat(80));
    console.log('Testing Initial Prompt Functionality');
    console.log('='.repeat(80));
    console.log(`Audio file: ${audioFilePath}`);
    console.log(`Initial prompt: "${initialPrompt}"`);
    console.log('-'.repeat(80));
    
    // Initialize the service
    const whisperService = new LocalWhisperService();
    
    // Test if the service is available
    const isAvailable = await whisperService.testInstallation();
    if (!isAvailable.success) {
        console.error('Error: Whisper service is not available:', isAvailable.error);
        process.exit(1);
    }
    
    console.log('Whisper service is available');
    console.log('Available models:', isAvailable.models.map(m => m.name).join(', '));
    console.log('-'.repeat(80));
    
    try {
        // Set the initial prompt
        whisperService.setInitialPrompt(initialPrompt);
        
        console.log('Starting transcription...');
        
        // Start time measurement
        const startTime = Date.now();
        
        // Transcribe the file
        const result = await whisperService.transcribeFile(audioFilePath, {
            model: 'base', // Use base model for faster testing
            language: 'auto'
        });
        
        // End time measurement
        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000; // in seconds
        
        console.log('-'.repeat(80));
        console.log(`Transcription completed in ${duration.toFixed(2)} seconds`);
        console.log('-'.repeat(80));
        console.log('Detected language:', result.language);
        console.log('Number of segments:', result.segments.length);
        console.log('-'.repeat(80));
        console.log('Transcription:');
        console.log(result.text);
        console.log('-'.repeat(80));
        
        // Now try without the initial prompt for comparison
        console.log('Now transcribing the same file WITHOUT initial prompt for comparison...');
        
        // Clear the initial prompt
        whisperService.clearInitialPrompt();
        
        // Start time measurement
        const startTime2 = Date.now();
        
        // Transcribe the file again
        const result2 = await whisperService.transcribeFile(audioFilePath, {
            model: 'base', // Use base model for faster testing
            language: 'auto'
        });
        
        // End time measurement
        const endTime2 = Date.now();
        const duration2 = (endTime2 - startTime2) / 1000; // in seconds
        
        console.log('-'.repeat(80));
        console.log(`Transcription without prompt completed in ${duration2.toFixed(2)} seconds`);
        console.log('-'.repeat(80));
        console.log('Detected language:', result2.language);
        console.log('Number of segments:', result2.segments.length);
        console.log('-'.repeat(80));
        console.log('Transcription without prompt:');
        console.log(result2.text);
        console.log('-'.repeat(80));
        
        // Compare the results
        console.log('Comparison:');
        console.log('- WITH prompt length:', result.text.length, 'characters');
        console.log('- WITHOUT prompt length:', result2.text.length, 'characters');
        
        // Simple diff - count how many characters are different
        let diffCount = 0;
        const minLength = Math.min(result.text.length, result2.text.length);
        for (let i = 0; i < minLength; i++) {
            if (result.text[i] !== result2.text[i]) {
                diffCount++;
            }
        }
        diffCount += Math.abs(result.text.length - result2.text.length);
        
        const diffPercentage = (diffCount / Math.max(result.text.length, result2.text.length)) * 100;
        console.log(`- Difference: ${diffCount} characters (${diffPercentage.toFixed(2)}%)`);
        
        console.log('='.repeat(80));
        console.log('Test completed successfully!');
        
    } catch (error) {
        console.error('Error during transcription:', error);
        process.exit(1);
    }
}

testInitialPrompt().catch(console.error);