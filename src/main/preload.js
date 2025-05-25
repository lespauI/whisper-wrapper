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
    openProjectDirectory: () => ipcRenderer.invoke('app:openProjectDirectory'),
  
    // Local Whisper
    testWhisper: () => ipcRenderer.invoke('whisper:test'),

    // Model management
    downloadModel: (modelName) => ipcRenderer.invoke('model:download', modelName),
    getModelInfo: (modelName) => ipcRenderer.invoke('model:info', modelName),
  
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