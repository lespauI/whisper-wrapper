#!/usr/bin/env node

/**
 * Setup verification script
 * Checks that all required files and dependencies are in place
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Whisper Wrapper setup...\n');

// Check required files
const requiredFiles = [
    'package.json',
    'src/main/index.js',
    'src/main/preload.js',
    'src/main/menu.js',
    'src/renderer/index.html',
    'src/renderer/index.js',
    'src/renderer/styles/main.css',
    'src/services/fileService.js',
    'src/services/recordingService.js',
    'src/services/transcriptionService.js',
    'src/services/exportService.js',
    'src/config/default.js',
    'src/utils/formatters.js',
    'scripts/start-renderer.js',
    'scripts/build-renderer.js',
    '.eslintrc.js',
    '.prettierrc',
    'jest.config.js'
];

let allFilesExist = true;

console.log('📁 Checking required files:');
requiredFiles.forEach(file => {
    const exists = fs.existsSync(path.join(__dirname, '..', file));
    console.log(`  ${exists ? '✅' : '❌'} ${file}`);
    if (!exists) allFilesExist = false;
});

// Check package.json structure
console.log('\n📦 Checking package.json:');
try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    
    const requiredScripts = ['start', 'start:renderer', 'start:electron', 'build', 'test'];
    const requiredDeps = ['electron', 'express', 'openai', 'axios', 'electron-store'];
    
    console.log('  Scripts:');
    requiredScripts.forEach(script => {
        const exists = packageJson.scripts && packageJson.scripts[script];
        console.log(`    ${exists ? '✅' : '❌'} ${script}`);
    });
    
    console.log('  Dependencies:');
    requiredDeps.forEach(dep => {
        const exists = packageJson.dependencies && packageJson.dependencies[dep];
        console.log(`    ${exists ? '✅' : '❌'} ${dep}`);
    });
    
} catch (error) {
    console.log('  ❌ Error reading package.json:', error.message);
    allFilesExist = false;
}

// Check directory structure
console.log('\n📂 Checking directory structure:');
const requiredDirs = [
    'src/main',
    'src/renderer',
    'src/renderer/styles',
    'src/services',
    'src/config',
    'src/utils',
    'tests/unit/services',
    'tests/unit/utils',
    'scripts'
];

requiredDirs.forEach(dir => {
    const exists = fs.existsSync(path.join(__dirname, '..', dir));
    console.log(`  ${exists ? '✅' : '❌'} ${dir}/`);
    if (!exists) allFilesExist = false;
});

// Check node_modules
console.log('\n📚 Checking dependencies:');
const nodeModulesExists = fs.existsSync(path.join(__dirname, '..', 'node_modules'));
console.log(`  ${nodeModulesExists ? '✅' : '❌'} node_modules installed`);

// Summary
console.log('\n' + '='.repeat(50));
if (allFilesExist && nodeModulesExists) {
    console.log('🎉 Setup verification PASSED!');
    console.log('\nYou can now run:');
    console.log('  npm start     - Start the application');
    console.log('  npm test      - Run tests');
    console.log('  npm run lint  - Check code quality');
    process.exit(0);
} else {
    console.log('❌ Setup verification FAILED!');
    console.log('\nPlease ensure all required files are present and dependencies are installed.');
    console.log('Run: npm install');
    process.exit(1);
}