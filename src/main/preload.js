const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // File operations
    selectFile: () => ipcRenderer.invoke('dialog:openFile'),
    saveFile: (content, filename) => ipcRenderer.invoke('dialog:saveFile', content, filename),
  
    // Audio recording
    startRecording: (options) => ipcRenderer.invoke('recording:start', options),
    stopRecording: (audioData) => ipcRenderer.invoke('recording:stop', audioData),
    pauseRecording: () => ipcRenderer.invoke('recording:pause'),
    resumeRecording: () => ipcRenderer.invoke('recording:resume'),
    getRecordingStatus: () => ipcRenderer.invoke('recording:status'),
    getRecordingSettings: () => ipcRenderer.invoke('recording:settings'),
    updateRecordingSettings: (settings) => ipcRenderer.invoke('recording:updateSettings', settings),
    getRecordingHistory: () => ipcRenderer.invoke('recording:history'),
    getRecordingConstraints: () => ipcRenderer.invoke('recording:constraints'),
  
    // Transcription
    transcribeFile: (filePath) => ipcRenderer.invoke('transcription:file', filePath),
    transcribeAudio: (audioData) => ipcRenderer.invoke('transcription:audio', audioData),
  
    // Configuration
    getConfig: () => ipcRenderer.invoke('config:get'),
    setConfig: (config) => ipcRenderer.invoke('config:set', config),
  
    // File system
    getAppPath: () => ipcRenderer.invoke('app:getPath'),
    getAppPaths: () => ipcRenderer.invoke('app:getPaths'),
    openProjectDirectory: () => ipcRenderer.invoke('app:openProjectDirectory'),

    // Recording auto-save
    saveRecordingChunk: (audioData, filename) => ipcRenderer.invoke('recording:saveChunk', audioData, filename),
    loadRecordingChunk: (filePath) => ipcRenderer.invoke('recording:loadChunk', filePath),
    deleteRecordingChunk: (filePath) => ipcRenderer.invoke('recording:deleteChunk', filePath),
    findRecordingChunks: (sessionId) => ipcRenderer.invoke('recording:findChunks', sessionId),
  
    // Local Whisper
    testWhisper: () => ipcRenderer.invoke('whisper:test'),

    // Model management
    downloadModel: (modelName) => ipcRenderer.invoke('model:download', modelName),
    getModelInfo: (modelName) => ipcRenderer.invoke('model:info', modelName),
    
    // AI Refinement - Templates
    getAllTemplates: () => ipcRenderer.invoke('template:getAll'),
    getTemplate: (id) => ipcRenderer.invoke('template:get', id),
    getDefaultTemplate: () => ipcRenderer.invoke('template:getDefault'),
    createTemplate: (templateData) => ipcRenderer.invoke('template:create', templateData),
    updateTemplate: (id, templateData) => ipcRenderer.invoke('template:update', id, templateData),
    deleteTemplate: (id) => ipcRenderer.invoke('template:delete', id),
    setDefaultTemplate: (id) => ipcRenderer.invoke('template:setDefault', id),
    
    // AI Refinement - Ollama
    testOllamaConnection: () => ipcRenderer.invoke('ollama:testConnection'),
    getOllamaModels: () => ipcRenderer.invoke('ollama:getModels'),
    refineText: (text, templateId) => ipcRenderer.invoke('ollama:refineText', text, templateId),
    
    // AI Refinement - Settings
    getAIRefinementSettings: () => ipcRenderer.invoke('aiRefinement:getSettings'),
    saveAIRefinementSettings: (settings) => ipcRenderer.invoke('aiRefinement:saveSettings', settings),
  
    // Event listeners
    onTranscriptionProgress: (callback) => {
        ipcRenderer.on('transcription:progress', callback);
    },
    onRecordingUpdate: (callback) => {
        ipcRenderer.on('recording:update', callback);
    },
    onModelDownloadProgress: (callback) => {
        ipcRenderer.on('model:download:progress', callback);
    },
    onRefinementProgress: (callback) => {
        ipcRenderer.on('refinement:progress', callback);
    },
  
    // Remove listeners
    removeAllListeners: (channel) => {
        ipcRenderer.removeAllListeners(channel);
    }
});

// Expose a limited API for the renderer
contextBridge.exposeInMainWorld('versions', {
    node: () => process.versions.node,
    chrome: () => process.versions.chrome,
    electron: () => process.versions.electron,
    app: () => require('../../package.json').version
});