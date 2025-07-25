/**
 * Test Entry Point - Minimal version to debug module loading
 */

console.log('🔍 Starting module load test...');

// Test 1: Basic module loading
try {
    // Test import of constants
    import('./utils/Constants.js').then(constants => {
        console.log('✅ Constants loaded:', Object.keys(constants));
        
        // Test import of UIHelpers
        return import('./utils/UIHelpers.js');
    }).then(uiHelpers => {
        console.log('✅ UIHelpers loaded:', Object.keys(uiHelpers));
        
        // Test import of EventHandler  
        return import('./utils/EventHandler.js');
    }).then(eventHandler => {
        console.log('✅ EventHandler loaded:', Object.keys(eventHandler));
        
        // Test import of AppState
        return import('./app/AppState.js');
    }).then(appState => {
        console.log('✅ AppState loaded:', Object.keys(appState));
        
        // Test import of controllers
        return import('./controllers/StatusController.js');
    }).then(statusController => {
        console.log('✅ StatusController loaded:', Object.keys(statusController));
        
        return import('./controllers/TabController.js');
    }).then(tabController => {
        console.log('✅ TabController loaded:', Object.keys(tabController));
        
        return import('./controllers/FileUploadController.js');
    }).then(fileUploadController => {
        console.log('✅ FileUploadController loaded:', Object.keys(fileUploadController));
        
        return import('./controllers/RecordingController.js');
    }).then(recordingController => {
        console.log('✅ RecordingController loaded:', Object.keys(recordingController));
        
        // Test import of main App
        return import('./app/App.js');
    }).then(app => {
        console.log('✅ App loaded:', Object.keys(app));
        
        // Try creating the app
        console.log('🚀 Creating App instance...');
        const appInstance = new app.App();
        console.log('✅ App instance created successfully!');
        
        // Make it globally available
        window.whisperApp = appInstance;
        
    }).catch(error => {
        console.error('❌ Module loading failed:', error);
        console.error('Error details:', error.message);
        console.error('Stack:', error.stack);
        
        // Show detailed error in UI
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            right: 20px;
            background: #f8d7da;
            color: #721c24;
            padding: 20px;
            border: 1px solid #f5c6cb;
            border-radius: 5px;
            font-family: monospace;
            z-index: 10000;
            max-height: 400px;
            overflow-y: auto;
            white-space: pre-wrap;
        `;
        errorDiv.innerHTML = `
❌ MODULE LOADING ERROR

Error: ${error.message}

Stack:
${error.stack}

Check the browser console for more details.
        `;
        document.body.appendChild(errorDiv);
    });
    
} catch (error) {
    console.error('❌ Immediate error:', error);
}

// Test DOM readiness
document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ DOM loaded');
});

console.log('🔍 Test script loaded successfully');