#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🎬 Running transcription end-to-end test...');
console.log('📁 Make sure you have placed "Thank you for contac.wav" in tests/data/ directory');

const testFile = path.join(__dirname, '../tests/integration/transcription-e2e.test.js');

const jest = spawn('npx', ['jest', testFile, '--verbose'], {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
});

jest.on('close', (code) => {
    if (code === 0) {
        console.log('✅ Transcription test completed successfully!');
    } else {
        console.log('❌ Transcription test failed with code:', code);
    }
    process.exit(code);
});

jest.on('error', (error) => {
    console.error('❌ Failed to run test:', error.message);
    process.exit(1);
});