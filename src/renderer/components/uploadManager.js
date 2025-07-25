// Upload Manager - Handles file upload and drag & drop functionality
class UploadManager {
    constructor(app) {
        this.app = app;
        
        // Upload state
        this.uploadState = {
            isUploading: false,
            currentFile: null,
            progress: 0,
            supportedFormats: [
                'mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg', 'wma',
                'mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', '3gp'
            ]
        };
        
        this.setupUpload();
    }

    setupUpload() {
        const uploadArea = document.getElementById('file-upload');
        const browseBtn = document.getElementById('browse-btn');

        if (!uploadArea || !browseBtn) {
            console.warn('Upload elements not found in DOM');
            return;
        }

        // Click to browse handlers
        browseBtn.addEventListener('click', () => {
            this.selectFile();
        });

        uploadArea.addEventListener('click', () => {
            this.selectFile();
        });

        // Drag and drop handlers
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            
            const files = Array.from(e.dataTransfer.files);
            if (files.length > 0) {
                this.handleFileUpload(files[0].path);
            }
        });

        console.log('Upload Manager initialized successfully');
    }

    async selectFile() {
        try {
            // Check if the electron API is available
            if (!window.electronAPI?.selectFile) {
                this.app.showError('File selection not available');
                return;
            }

            this.app.updateStatus('Opening file dialog...');
            
            const result = await window.electronAPI.selectFile({
                title: 'Select audio or video file',
                buttonLabel: 'Select File',
                filters: [
                    { name: 'Audio Files', extensions: ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg', 'wma'] },
                    { name: 'Video Files', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', '3gp'] },
                    { name: 'All Files', extensions: ['*'] }
                ],
                properties: ['openFile']
            });

            if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
                this.app.updateStatus('File selection cancelled');
                return;
            }

            const selectedFile = result.filePaths[0];
            await this.handleFileUpload(selectedFile);

        } catch (error) {
            console.error('Error selecting file:', error);
            this.app.showError(`Failed to select file: ${error.message}`);
        }
    }

    async handleFileUpload(filePath) {
        if (!filePath) {
            this.app.showError('No file selected');
            return;
        }

        try {
            this.uploadState.isUploading = true;
            this.updateUploadUI();

            // Validate file
            const validation = await this.validateFile(filePath);
            if (!validation.valid) {
                throw new Error(validation.error);
            }

            // Update UI with file info
            this.displayFileInfo(validation.fileInfo);
            
            // Switch to transcription tab
            this.app.switchTab('transcription');
            
            // Start transcription
            await this.transcribeFile(filePath, validation.fileInfo);

        } catch (error) {
            console.error('Error handling file upload:', error);
            this.app.showError(`Upload failed: ${error.message}`);
        } finally {
            this.uploadState.isUploading = false;
            this.updateUploadUI();
        }
    }

    async validateFile(filePath) {
        try {
            // Basic file validation without getFileInfo (which isn't available)
            if (!filePath || typeof filePath !== 'string') {
                return { valid: false, error: 'Invalid file path' };
            }

            // Check file extension
            const extension = this.getFileExtension(filePath).toLowerCase();
            if (!this.uploadState.supportedFormats.includes(extension)) {
                return { 
                    valid: false, 
                    error: `Unsupported file format: .${extension}. Supported formats: ${this.uploadState.supportedFormats.join(', ')}` 
                };
            }

            // Create basic file info object
            const fileInfo = {
                path: filePath,
                extension,
                exists: true, // Assume exists since it was selected
                size: 0 // Will be determined later if needed
            };

            return { 
                valid: true, 
                fileInfo
            };

        } catch (error) {
            return { valid: false, error: `File validation failed: ${error.message}` };
        }
    }

    displayFileInfo(fileInfo) {
        // Update upload area to show selected file
        const uploadArea = document.getElementById('file-upload');
        const uploadText = document.getElementById('upload-text');
        const uploadSubtext = document.getElementById('upload-subtext');

        if (uploadArea && uploadText) {
            uploadArea.classList.add('file-selected');
            uploadText.textContent = `Selected: ${this.getFileName(fileInfo.path)}`;
            
            if (uploadSubtext) {
                uploadSubtext.textContent = `${fileInfo.extension.toUpperCase()} file`;
            }
        }

        // Store current file
        this.uploadState.currentFile = fileInfo;
        
        this.app.updateStatus(`File loaded: ${this.getFileName(fileInfo.path)}`);
    }

    async transcribeFile(filePath, fileInfo) {
        try {
            this.app.updateStatus('Starting transcription...');
            this.showTranscriptionLoading(true);

            // Set up progress listener
            if (window.electronAPI.onTranscriptionProgress) {
                window.electronAPI.onTranscriptionProgress((event, progress) => {
                    this.updateTranscriptionProgress(progress);
                });
            }

            // Start transcription
            const result = await window.electronAPI.transcribeFile(filePath);

            if (result.success) {
                this.app.getTranscriptionManager()?.showTranscriptionResult(result.text, result.segments);
                this.app.updateStatus(`File transcribed successfully (Language: ${result.language || 'unknown'})`);
                this.clearUploadArea();
            } else {
                throw new Error(result.error || 'Transcription failed');
            }

        } catch (error) {
            console.error('Error transcribing file:', error);
            this.app.showError(`Transcription failed: ${error.message}`);
        } finally {
            this.showTranscriptionLoading(false);
            
            // Clean up progress listener
            if (window.electronAPI.removeAllListeners) {
                window.electronAPI.removeAllListeners('transcription:progress');
            }
        }
    }

    showTranscriptionLoading(show) {
        const loadingElement = document.getElementById('transcription-loading');
        const emptyElement = document.getElementById('transcription-empty');
        
        if (loadingElement) {
            loadingElement.classList.toggle('hidden', !show);
        }
        
        if (emptyElement) {
            emptyElement.classList.toggle('hidden', show);
        }
    }

    updateTranscriptionProgress(progress) {
        const progressElement = document.getElementById('transcription-progress');
        const progressBar = document.getElementById('transcription-progress-bar');
        const progressText = document.getElementById('transcription-progress-text');

        if (progressElement) {
            progressElement.classList.remove('hidden');
        }

        if (progressBar) {
            progressBar.style.width = `${progress.percentage || 0}%`;
        }

        if (progressText) {
            progressText.textContent = progress.message || 'Processing...';
        }

        this.app.updateStatus(progress.message || 'Transcribing...');
    }

    updateUploadUI() {
        const uploadArea = document.getElementById('file-upload');
        const browseBtn = document.getElementById('browse-btn');

        if (uploadArea) {
            uploadArea.classList.toggle('uploading', this.uploadState.isUploading);
        }

        if (browseBtn) {
            browseBtn.disabled = this.uploadState.isUploading;
            browseBtn.textContent = this.uploadState.isUploading ? 'Uploading...' : 'Browse Files';
        }
    }

    clearUploadArea() {
        const uploadArea = document.getElementById('file-upload');
        const uploadText = document.getElementById('upload-text');
        const uploadSubtext = document.getElementById('upload-subtext');
        const browseBtn = document.getElementById('browse-btn');

        if (uploadArea) {
            uploadArea.classList.remove('file-selected', 'uploading');
        }

        if (uploadText) {
            uploadText.textContent = 'Drop audio or video files here';
        }

        if (uploadSubtext) {
            uploadSubtext.textContent = 'or click to browse';
        }

        if (browseBtn) {
            browseBtn.textContent = 'Browse Files';
            browseBtn.disabled = false;
        }

        this.uploadState.currentFile = null;
        this.uploadState.progress = 0;
    }

    // Utility methods
    getFileName(filePath) {
        return filePath.split(/[\\/]/).pop();
    }

    getFileExtension(filePath) {
        return filePath.split('.').pop();
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Public API methods
    getCurrentFile() {
        return this.uploadState.currentFile;
    }

    isUploading() {
        return this.uploadState.isUploading;
    }

    getSupportedFormats() {
        return [...this.uploadState.supportedFormats];
    }

    // For testing - simulate file upload
    async simulateUpload(filePath) {
        if (typeof filePath === 'string') {
            await this.handleFileUpload(filePath);
        }
    }
}

// Export for use in main app
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UploadManager;
}