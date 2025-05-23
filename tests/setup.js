/**
 * Test setup and configuration
 */

// Global test timeout
jest.setTimeout(30000);

// Mock Electron modules for unit tests
jest.mock('electron', () => ({
    app: {
        getPath: jest.fn(() => '/mock/path'),
        quit: jest.fn()
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
        webContents: {
            openDevTools: jest.fn()
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

// Mock fs operations for tests that don't need real file system
const mockFs = {
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
    readdirSync: jest.fn(),
    statSync: jest.fn(),
    createReadStream: jest.fn(),
    createWriteStream: jest.fn(),
    mkdirSync: jest.fn(),
    unlinkSync: jest.fn()
};

// Mock fs module
jest.mock('fs', () => mockFs);

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
    }),
    mockFs
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