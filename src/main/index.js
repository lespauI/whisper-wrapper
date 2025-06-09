const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
// Check if we're in development mode
// Force production mode if NODE_ENV is explicitly set to production
const isDev = process.env.NODE_ENV === 'production' ? false : (process.env.NODE_ENV === 'development' || !app.isPackaged);
const IPCHandlers = require('./ipcHandlers');
const RefinementHandlers = require('./refinementHandlers');

// Keep a global reference of the window object
let mainWindow;

function createWindow() {
    // Create the browser window
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, '../renderer/assets/icons/app-icon.png'),
        show: false,
        titleBarStyle: 'default'
    });

    // Load the app
    const startUrl = isDev 
        ? 'http://localhost:3000' 
        : `file://${path.join(__dirname, '../renderer/dist/index.html')}`;
    
    console.log(`🔧 Environment: NODE_ENV=${process.env.NODE_ENV}, isDev=${isDev}, isPackaged=${app.isPackaged}`);
    console.log(`🌐 Loading URL: ${startUrl}`);
  
    mainWindow.loadURL(startUrl);

    // Show window when ready to prevent visual flash
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    
        // Open DevTools in development
        if (isDev) {
            mainWindow.webContents.openDevTools();
        }
    });

    // Emitted when the window is closed
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Handle window controls on macOS
    mainWindow.on('close', (event) => {
        if (process.platform === 'darwin') {
            event.preventDefault();
            mainWindow.hide();
        }
    });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
    createWindow();

    // Initialize IPC handlers
    new IPCHandlers(mainWindow);
    
    // Initialize Refinement handlers
    new RefinementHandlers();

    // Set up application menu
    const menu = require('./menu');
    Menu.setApplicationMenu(menu);

    app.on('activate', () => {
    // On macOS, re-create window when dock icon is clicked
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        } else if (mainWindow) {
            mainWindow.show();
        }
    });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
    // On macOS, keep app running even when all windows are closed
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
    contents.on('new-window', (event) => {
        event.preventDefault();
    });
});

// Handle app protocol for deep linking (future feature)
app.setAsDefaultProtocolClient('whisper-wrapper');