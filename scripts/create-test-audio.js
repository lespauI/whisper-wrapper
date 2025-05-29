#!/usr/bin/env node

/**
 * Script to create test audio files for E2E testing
 * This creates simple audio files that can be used for testing file upload functionality
 */

const fs = require('fs');
const path = require('path');

const audioDir = path.join(__dirname, '../tests/fixtures/audio');

// Ensure directory exists
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

// Create mock audio files with minimal content
const testFiles = [
  { name: 'test-audio-short.wav', content: 'RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x22\x56\x00\x00\x44\xAC\x00\x00\x02\x00\x10\x00data\x00\x00\x00\x00' },
  { name: 'test-audio-medium.mp3', content: 'ID3\x03\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00' },
  { name: 'test-video.mp4', content: '\x00\x00\x00\x20ftypmp41\x00\x00\x00\x00mp41mp42isom\x00\x00\x00\x08free' },
  { name: 'invalid-file.txt', content: 'This is not an audio file - should cause validation error' },
  { name: 'large-file.wav', content: 'RIFF' + 'x'.repeat(1000) + 'WAVE' }, // Simulated large file
];

console.log('Creating test audio files...');

testFiles.forEach(file => {
  const filePath = path.join(audioDir, file.name);
  fs.writeFileSync(filePath, file.content, 'binary');
  console.log(`Created: ${file.name} (${file.content.length} bytes)`);
});

console.log('Test audio files created successfully!');
console.log(`Files available in: ${audioDir}`);