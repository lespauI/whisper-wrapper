#!/usr/bin/env node

/**
 * Test script for local Whisper service
 */

const LocalWhisperService = require('./src/services/localWhisperService');

async function testWhisper() {
    console.log('🧪 Testing Local Whisper Service...\n');
    
    const whisperService = new LocalWhisperService();
    
    // Test 1: Check if whisper.cpp binary exists
    console.log('1. Checking whisper.cpp binary...');
    const isAvailable = whisperService.isAvailable();
    console.log(`   Binary available: ${isAvailable ? '✅' : '❌'}`);
    
    if (!isAvailable) {
        console.log('   Binary path checked:', whisperService.whisperPath);
        console.log('\n❌ whisper.cpp not found. Please run the setup script:');
        console.log('   macOS/Linux: ./scripts/setup-whisper.sh');
        console.log('   Windows: scripts\\setup-whisper.bat');
        return;
    }
    
    // Test 2: Check available models
    console.log('\n2. Checking available models...');
    const models = whisperService.getAvailableModels();
    console.log(`   Found ${models.length} models:`);
    models.forEach(model => {
        console.log(`   - ${model.name} (${model.size})`);
    });
    
    if (models.length === 0) {
        console.log('\n❌ No models found. Please run the setup script to download models.');
        return;
    }
    
    // Test 3: Test installation
    console.log('\n3. Testing installation...');
    try {
        const testResult = await whisperService.testInstallation();
        if (testResult.success) {
            console.log('   ✅ Installation test passed');
            console.log(`   Whisper path: ${testResult.whisperPath}`);
            console.log(`   Models path: ${testResult.modelsPath}`);
        } else {
            console.log(`   ❌ Installation test failed: ${testResult.error}`);
        }
    } catch (error) {
        console.log(`   ❌ Installation test error: ${error.message}`);
    }
    
    console.log('\n🎉 Local Whisper service test completed!');
    console.log('\nTo test with actual audio:');
    console.log('1. Start the application: npm start');
    console.log('2. Upload an audio file or record audio');
    console.log('3. Check the transcription results');
}

// Run the test
testWhisper().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
});