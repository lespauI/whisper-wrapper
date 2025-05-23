const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // File operations
    selectFile: () => ipcRenderer.invoke('dialog:openFile'),
    saveFile: (content, filename) => ipcRenderer.invoke('dialog:saveFile', content, filename),
  
    // Audio recording
    startRecording: () => ipcRenderer.invoke('recording:start'),
    stopRecording: () => ipcRenderer.invoke('recording:stop'),
    pauseRecording: () => ipcRenderer.invoke('recording:pause'),
  
    // Transcription
    transcribeFile: (filePath) => ipcRenderer.invoke('transcription:file', filePath),
    transcribeAudio: (audioData) => ipcRenderer.invoke('transcription:audio', audioData),
  
    // Configuration
    getConfig: () => ipcRenderer.invoke('config:get'),
    setConfig: (config) => ipcRenderer.invoke('config:set', config),
  
    // File system
    getAppPath: () => ipcRenderer.invoke('app:getPath'),
  
    // Event listeners
    onTranscriptionProgress: (callback) => {
        ipcRenderer.on('transcription:progress', callback);
    },
    onRecordingUpdate: (callback) => {
        ipcRenderer.on('recording:update', callback);
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