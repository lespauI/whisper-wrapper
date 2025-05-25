#!/usr/bin/env node

/**
 * E2E Testing Script
 * 
 * This script builds the entire application and runs it in a production-like environment
 * for end-to-end testing purposes. It ensures you're testing the actual built files
 * that would be used in production.
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Starting E2E Testing Environment...\n');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

function logStep(step, message) {
    log(`${colors.cyan}[${step}]${colors.reset} ${message}`);
}

function logSuccess(message) {
    log(`${colors.green}✅ ${message}${colors.reset}`);
}

function logError(message) {
    log(`${colors.red}❌ ${message}${colors.reset}`);
}

function logWarning(message) {
    log(`${colors.yellow}⚠️  ${message}${colors.reset}`);
}

// Function to run a command and return a promise
function runCommand(command, args = [], options = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            stdio: 'inherit',
            shell: true,
            ...options
        });

        child.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Command failed with exit code ${code}`));
            }
        });

        child.on('error', (error) => {
            reject(error);
        });
    });
}

// Function to check if a file exists
function fileExists(filePath) {
    return fs.existsSync(filePath);
}

// Function to clean up previous builds
function cleanDist() {
    const distPath = path.join(__dirname, '../src/renderer/dist');
    if (fs.existsSync(distPath)) {
        fs.rmSync(distPath, { recursive: true, force: true });
        logSuccess('Cleaned previous dist files');
    }
}

// Main execution function
async function main() {
    try {
        // Step 1: Clean previous builds
        logStep('1/6', 'Cleaning previous builds...');
        cleanDist();

        // Step 2: Build renderer
        logStep('2/6', 'Building renderer files...');
        await runCommand('npm', ['run', 'build:renderer']);
        logSuccess('Renderer build completed');

        // Step 3: Verify build output
        logStep('3/6', 'Verifying build output...');
        const requiredFiles = [
            'src/renderer/dist/index.html',
            'src/renderer/dist/index.js',
            'src/renderer/dist/styles/main.css'
        ];

        let allFilesExist = true;
        for (const file of requiredFiles) {
            const fullPath = path.join(__dirname, '..', file);
            if (fileExists(fullPath)) {
                log(`  ✅ ${file}`);
            } else {
                log(`  ❌ ${file}`);
                allFilesExist = false;
            }
        }

        if (!allFilesExist) {
            throw new Error('Some required build files are missing');
        }
        logSuccess('All build files verified');

        // Step 4: Check Whisper setup
        logStep('4/6', 'Checking Whisper setup...');
        const whisperPaths = [
            'whisper.cpp/build/bin/whisper-cli',
            'whisper.cpp/build/bin/main',
            'models'
        ];

        let whisperReady = true;
        for (const whisperPath of whisperPaths) {
            const fullPath = path.join(__dirname, '..', whisperPath);
            if (fileExists(fullPath)) {
                log(`  ✅ ${whisperPath}`);
            } else {
                log(`  ❌ ${whisperPath}`);
                if (whisperPath.includes('whisper.cpp')) {
                    whisperReady = false;
                }
            }
        }

        if (!whisperReady) {
            logWarning('Whisper.cpp not found. Run "npm run setup-whisper" first.');
            logWarning('The app will start but transcription features may not work.');
        } else {
            logSuccess('Whisper setup verified');
        }

        // Step 5: Set environment for production-like testing
        logStep('5/6', 'Setting up production-like environment...');
        process.env.NODE_ENV = 'production';
        process.env.E2E_TESTING = 'true';
        logSuccess('Environment configured for E2E testing');

        // Step 6: Start the application
        logStep('6/6', 'Starting application...');
        log('\n' + '='.repeat(60));
        log(`${colors.bright}🎯 E2E TESTING ENVIRONMENT READY${colors.reset}`);
        log('='.repeat(60));
        log(`${colors.green}The app is now running in production mode using built files.${colors.reset}`);
        log(`${colors.yellow}Perfect for E2E testing!${colors.reset}\n`);
        
        log(`${colors.cyan}Testing Tips:${colors.reset}`);
        log('• Test file transcription with various formats');
        log('• Test audio recording functionality');
        log('• Verify timestamp display and scrolling');
        log('• Test view mode toggling');
        log('• Check copy functionality');
        log('\n' + '='.repeat(60) + '\n');

        // Start electron in production mode
        await runCommand('electron', ['.'], {
            env: {
                ...process.env,
                NODE_ENV: 'production',
                E2E_TESTING: 'true'
            }
        });

    } catch (error) {
        logError(`E2E setup failed: ${error.message}`);
        process.exit(1);
    }
}

// Handle cleanup on exit
process.on('SIGINT', () => {
    log('\n\n🛑 E2E testing session ended');
    process.exit(0);
});

process.on('SIGTERM', () => {
    log('\n\n🛑 E2E testing session ended');
    process.exit(0);
});

// Run the main function
main().catch((error) => {
    logError(`Unexpected error: ${error.message}`);
    process.exit(1);
});