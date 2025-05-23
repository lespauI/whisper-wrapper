#!/usr/bin/env node

/**
 * Test script for configuration
 */

const config = require('./src/config');

console.log('🧪 Testing Configuration...\n');

// Test 1: Get simplified config
console.log('1. Getting simplified configuration...');
const simplifiedConfig = config.getSimplified();
console.log('   Current config:', JSON.stringify(simplifiedConfig, null, 2));

// Test 2: Check if model is correct
console.log('\n2. Checking model configuration...');
if (simplifiedConfig.model === 'base' || simplifiedConfig.model === 'small') {
    console.log('   ✅ Model is correctly set to local Whisper model:', simplifiedConfig.model);
} else {
    console.log('   ❌ Model is still set to old value:', simplifiedConfig.model);
    console.log('   Resetting configuration...');
    config.reset();
    const newConfig = config.getSimplified();
    console.log('   New config after reset:', JSON.stringify(newConfig, null, 2));
}

console.log('\n🎉 Configuration test completed!');