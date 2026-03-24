module.exports = {
    app: {
        getPath: jest.fn(() => '/mock/path'),
        quit: jest.fn(),
        whenReady: jest.fn(() => Promise.resolve())
    },
    dialog: {
        showOpenDialog: jest.fn(),
        showSaveDialog: jest.fn()
    },
    shell: {
        openPath: jest.fn()
    },
    ipcMain: {
        handle: jest.fn(),
        on: jest.fn()
    },
    ipcRenderer: {
        invoke: jest.fn(),
        on: jest.fn(),
        removeAllListeners: jest.fn()
    },
    contextBridge: {
        exposeInMainWorld: jest.fn()
    },
    desktopCapturer: {
        getSources: jest.fn()
    },
    BrowserWindow: jest.fn(() => ({
        loadFile: jest.fn(),
        on: jest.fn(),
        close: jest.fn(),
        webContents: {
            openDevTools: jest.fn(),
            executeJavaScript: jest.fn(() => Promise.resolve('mock result'))
        }
    }))
};
