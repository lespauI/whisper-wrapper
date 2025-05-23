const { Menu, shell, app, dialog } = require('electron');

const isMac = process.platform === 'darwin';

const template = [
    // App menu (macOS)
    ...(isMac ? [{
        label: app.getName(),
        submenu: [
            { role: 'about' },
            { type: 'separator' },
            {
                label: 'Preferences...',
                accelerator: 'Cmd+,',
                click: () => {
                    // TODO: Open preferences window
                }
            },
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideothers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' }
        ]
    }] : []),

    // File menu
    {
        label: 'File',
        submenu: [
            {
                label: 'Open Audio File...',
                accelerator: 'CmdOrCtrl+O',
                click: () => {
                    // TODO: Trigger file open dialog
                }
            },
            { type: 'separator' },
            {
                label: 'Save Transcription...',
                accelerator: 'CmdOrCtrl+S',
                click: () => {
                    // TODO: Save current transcription
                }
            },
            {
                label: 'Export As...',
                submenu: [
                    {
                        label: 'Text File (.txt)',
                        click: () => {
                            // TODO: Export as text
                        }
                    },
                    {
                        label: 'Markdown (.md)',
                        click: () => {
                            // TODO: Export as markdown
                        }
                    }
                ]
            },
            { type: 'separator' },
            ...(isMac ? [] : [{ role: 'quit' }])
        ]
    },

    // Edit menu
    {
        label: 'Edit',
        submenu: [
            { role: 'undo' },
            { role: 'redo' },
            { type: 'separator' },
            { role: 'cut' },
            { role: 'copy' },
            { role: 'paste' },
            ...(isMac ? [
                { role: 'pasteAndMatchStyle' },
                { role: 'delete' },
                { role: 'selectAll' },
                { type: 'separator' },
                {
                    label: 'Speech',
                    submenu: [
                        { role: 'startSpeaking' },
                        { role: 'stopSpeaking' }
                    ]
                }
            ] : [
                { role: 'delete' },
                { type: 'separator' },
                { role: 'selectAll' }
            ])
        ]
    },

    // Record menu
    {
        label: 'Record',
        submenu: [
            {
                label: 'Start Recording',
                accelerator: 'CmdOrCtrl+R',
                click: () => {
                    // TODO: Start recording
                }
            },
            {
                label: 'Stop Recording',
                accelerator: 'CmdOrCtrl+Shift+R',
                click: () => {
                    // TODO: Stop recording
                }
            },
            { type: 'separator' },
            {
                label: 'Recording Settings...',
                click: () => {
                    // TODO: Open recording settings
                }
            }
        ]
    },

    // View menu
    {
        label: 'View',
        submenu: [
            { role: 'reload' },
            { role: 'forceReload' },
            { role: 'toggleDevTools' },
            { type: 'separator' },
            { role: 'resetZoom' },
            { role: 'zoomIn' },
            { role: 'zoomOut' },
            { type: 'separator' },
            { role: 'togglefullscreen' }
        ]
    },

    // Window menu
    {
        label: 'Window',
        submenu: [
            { role: 'minimize' },
            { role: 'close' },
            ...(isMac ? [
                { type: 'separator' },
                { role: 'front' },
                { type: 'separator' },
                { role: 'window' }
            ] : [])
        ]
    },

    // Help menu
    {
        role: 'help',
        submenu: [
            {
                label: 'About Whisper Wrapper',
                click: async () => {
                    await dialog.showMessageBox({
                        type: 'info',
                        title: 'About Whisper Wrapper',
                        message: 'Whisper Wrapper',
                        detail: `Version: ${app.getVersion()}\n\nA user-friendly interface for OpenAI's Whisper speech-to-text model.`
                    });
                }
            },
            {
                label: 'Learn More',
                click: async () => {
                    await shell.openExternal('https://github.com/your-username/whisper-wrapper');
                }
            },
            { type: 'separator' },
            {
                label: 'Report Issue',
                click: async () => {
                    await shell.openExternal('https://github.com/your-username/whisper-wrapper/issues');
                }
            }
        ]
    }
];

module.exports = Menu.buildFromTemplate(template);