/**
 * Main Renderer Entry Point
 * Initializes the modular Whisper Wrapper application
 */

import { App } from './app/App.js';

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Starting Whisper Wrapper...');
    
    try {
        // Create and initialize the main application
        const app = new App();
        
        // Make app globally accessible for debugging and legacy compatibility
        window.whisperApp = app;
        
        console.log('✅ Whisper Wrapper started successfully');
        
    } catch (error) {
        console.error('❌ Failed to start Whisper Wrapper:', error);
        
        // Show error to user
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #f8d7da;
            color: #721c24;
            padding: 20px;
            border: 1px solid #f5c6cb;
            border-radius: 5px;
            font-family: Arial, sans-serif;
            z-index: 10000;
            max-width: 400px;
            text-align: center;
        `;
        errorDiv.innerHTML = `
            <h3>⚠️ Application Error</h3>
            <p>Failed to start Whisper Wrapper:</p>
            <p><code>${error.message}</code></p>
            <p>Please refresh the page or check the console for more details.</p>
        `;
        document.body.appendChild(errorDiv);
    }
});

// Handle module loading errors
window.addEventListener('error', (e) => {
    if (e.filename && e.filename.includes('.js')) {
        console.error('Module loading error:', e);
    }
});

// Export for testing if in Node.js environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { App };
}