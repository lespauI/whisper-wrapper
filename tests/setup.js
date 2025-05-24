/**
 * Test setup and configuration
 */

// Global test timeout
jest.setTimeout(30000);

// Mock Electron modules for unit tests
jest.mock('electron', () => ({
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
    BrowserWindow: jest.fn(() => ({
        loadFile: jest.fn(),
        on: jest.fn(),
        close: jest.fn(),
        webContents: {
            openDevTools: jest.fn(),
            executeJavaScript: jest.fn(() => Promise.resolve('mock result'))
        }
    }))
}));

// Mock electron-store
jest.mock('electron-store', () => {
    return jest.fn().mockImplementation(() => ({
        get: jest.fn(),
        set: jest.fn(),
        clear: jest.fn(),
        store: {}
    }));
});

// Note: fs is not globally mocked to allow integration tests to use real file system
// Individual tests can mock fs methods as needed

// Global test utilities
global.testUtils = {
    createMockAudioFile: () => Buffer.from('mock audio data'),
    createMockConfig: () => ({
        model: 'base',
        language: 'auto',
        threads: 4,
        translate: false
    }),
    createMockTranscriptionResult: () => ({
        success: true,
        text: 'Hello world',
        language: 'en'
    })
};

// Console override for cleaner test output
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
    // Suppress console errors/warnings in tests unless explicitly needed
    console.error = jest.fn();
    console.warn = jest.fn();
});

afterAll(() => {
    // Restore original console methods
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
});

// Clean up after each test
afterEach(() => {
    jest.clearAllMocks();
});