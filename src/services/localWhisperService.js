/**
 * Local Whisper Service - Handles transcription using local whisper.cpp
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class LocalWhisperService {
    constructor() {
        this.whisperPath = this.findWhisperBinary();
        this.modelsPath = path.join(process.cwd(), 'models');
        this.tempDir = path.join(os.tmpdir(), 'whisper-wrapper');
        
        // Default settings
        this.model = 'base';
        this.language = 'auto';
        this.threads = 4;
        this.translate = false;
        
        // Ensure temp directory exists
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    /**
     * Find the whisper.cpp binary
     */
    findWhisperBinary() {
        const possiblePaths = [
            path.join(process.cwd(), 'whisper.cpp', 'build', 'bin', 'whisper-cli'),
            path.join(process.cwd(), 'whisper.cpp', 'build', 'bin', 'whisper-cli.exe'),
            path.join(process.cwd(), 'whisper.cpp', 'main'),
            path.join(process.cwd(), 'whisper.cpp', 'main.exe'),
            path.join(process.cwd(), 'whisper.cpp', 'build', 'bin', 'main'),
            path.join(process.cwd(), 'whisper.cpp', 'build', 'bin', 'main.exe'),
            path.join(process.cwd(), 'whisper.cpp', 'build', 'bin', 'Release', 'main.exe'),
        ];

        for (const whisperPath of possiblePaths) {
            if (fs.existsSync(whisperPath)) {
                return whisperPath;
            }
        }

        return null;
    }

    /**
     * Check if whisper.cpp is available
     */
    isAvailable() {
        return !!(this.whisperPath && fs.existsSync(this.whisperPath));
    }

    /**
     * Get available models
     */
    getAvailableModels() {
        if (!fs.existsSync(this.modelsPath)) {
            return [];
        }

        return fs.readdirSync(this.modelsPath)
            .filter(file => file.endsWith('.bin'))
            .map(file => ({
                name: file.replace('ggml-', '').replace('.bin', ''),
                path: path.join(this.modelsPath, file),
                size: this.getFileSize(path.join(this.modelsPath, file))
            }));
    }

    /**
     * Get file size in human readable format
     */
    getFileSize(filePath) {
        try {
            const stats = fs.statSync(filePath);
            const bytes = stats.size;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            if (bytes === 0) return '0 Bytes';
            const i = Math.floor(Math.log(bytes) / Math.log(1024));
            return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
        } catch (error) {
            return 'Unknown';
        }
    }

    /**
     * Set the model to use for transcription
     */
    setModel(model) {
        const validModels = ['tiny', 'base', 'small', 'medium', 'large', 'large-v1', 'large-v2', 'large-v3'];
        if (!validModels.includes(model)) {
            throw new Error(`Invalid model: ${model}. Valid models are: ${validModels.join(', ')}`);
        }
        this.model = model;
    }

    /**
     * Set the language for transcription
     */
    setLanguage(language) {
        this.language = language;
    }

    /**
     * Set the number of threads to use
     */
    setThreads(threads) {
        if (threads < 1 || threads > 16) {
            throw new Error('Thread count must be between 1 and 16');
        }
        this.threads = threads;
    }

    /**
     * Set whether to translate to English
     */
    setTranslate(translate) {
        this.translate = translate;
    }

    /**
     * Transcribe audio file using whisper.cpp
     */
    async transcribeFile(filePath, options = {}) {
        if (!this.isAvailable()) {
            throw new Error('whisper.cpp is not available. Please run the setup script first.');
        }

        const {
            model = 'base',
            language = 'auto',
            translate = false,
            outputFormat = 'json',
            threads = 4
        } = options;

        // Find model file
        const modelPath = this.findModelPath(model);
        if (!modelPath) {
            throw new Error(`Model '${model}' not found. Available models: ${this.getAvailableModels().map(m => m.name).join(', ')}`);
        }

        // Prepare output file
        const outputFile = path.join(this.tempDir, `transcription_${Date.now()}.json`);

        // Build whisper.cpp command
        const args = [
            '-m', modelPath,
            '-f', filePath,
            '-t', threads.toString(),
            '-oj', // Output JSON
            '-of', outputFile.replace('.json', '') // whisper.cpp adds .json automatically
        ];

        // Add language if specified
        if (language && language !== 'auto') {
            args.push('-l', language);
        }

        // Add translate flag if needed
        if (translate) {
            args.push('-tr');
        }

        // Add other options
        args.push('-np'); // No progress output to stderr

        return new Promise((resolve, reject) => {
            const whisperProcess = spawn(this.whisperPath, args, {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let stdout = '';
            let stderr = '';

            whisperProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            whisperProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            whisperProcess.on('close', (code) => {
                if (code === 0) {
                    try {
                        // Read the JSON output file
                        const jsonOutputFile = outputFile;
                        if (fs.existsSync(jsonOutputFile)) {
                            const result = JSON.parse(fs.readFileSync(jsonOutputFile, 'utf8'));
                            
                            // Clean up temp file
                            fs.unlinkSync(jsonOutputFile);
                            
                            // Extract text from segments
                            const text = result.transcription
                                .map(segment => segment.text)
                                .join(' ')
                                .trim();

                            // Detect language from result
                            const detectedLanguage = this.detectLanguageFromOutput(stderr) || language;

                            resolve({
                                success: true,
                                text: text,
                                language: detectedLanguage,
                                segments: result.transcription,
                                model: model,
                                duration: this.extractDuration(stderr)
                            });
                        } else {
                            // Fallback: extract text from stdout
                            const text = this.extractTextFromOutput(stdout);
                            resolve({
                                success: true,
                                text: text,
                                language: language,
                                model: model
                            });
                        }
                    } catch (error) {
                        reject(new Error(`Failed to parse whisper.cpp output: ${error.message}`));
                    }
                } else {
                    reject(new Error(`whisper.cpp failed with code ${code}: ${stderr}`));
                }
            });

            whisperProcess.on('error', (error) => {
                reject(new Error(`Failed to start whisper.cpp: ${error.message}`));
            });
        });
    }

    /**
     * Transcribe audio buffer
     */
    async transcribeBuffer(audioBuffer, options = {}) {
        // Save buffer to temporary file
        const tempFile = path.join(this.tempDir, `temp_audio_${Date.now()}.wav`);
        
        try {
            fs.writeFileSync(tempFile, audioBuffer);
            const result = await this.transcribeFile(tempFile, options);
            return result;
        } finally {
            // Clean up temp file
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }
        }
    }

    /**
     * Find model path by name
     */
    findModelPath(modelName) {
        const possibleNames = [
            `ggml-${modelName}.bin`,
            `${modelName}.bin`,
            modelName
        ];

        for (const name of possibleNames) {
            const fullPath = path.join(this.modelsPath, name);
            if (fs.existsSync(fullPath)) {
                return fullPath;
            }
        }

        return null;
    }

    /**
     * Extract text from whisper.cpp stdout (fallback)
     */
    extractTextFromOutput(output) {
        // Remove timestamps and extract just the text
        const lines = output.split('\n');
        const textLines = lines
            .filter(line => line.includes(']'))
            .map(line => {
                const match = line.match(/\]\s*(.+)$/);
                return match ? match[1].trim() : '';
            })
            .filter(text => text.length > 0);

        return textLines.join(' ');
    }

    /**
     * Detect language from whisper.cpp output
     */
    detectLanguageFromOutput(output) {
        const match = output.match(/auto-detected language:\s*(\w+)/i);
        return match ? match[1] : null;
    }

    /**
     * Extract duration from whisper.cpp output
     */
    extractDuration(output) {
        const match = output.match(/total time\s*=\s*([\d.]+)\s*ms/i);
        return match ? parseFloat(match[1]) : null;
    }

    /**
     * Test whisper.cpp installation
     */
    async testInstallation() {
        if (!this.isAvailable()) {
            return {
                success: false,
                error: 'whisper.cpp binary not found'
            };
        }

        const models = this.getAvailableModels();
        if (models.length === 0) {
            return {
                success: false,
                error: 'No Whisper models found'
            };
        }

        return {
            success: true,
            whisperPath: this.whisperPath,
            modelsPath: this.modelsPath,
            models: models
        };
    }

    /**
     * Clean up temporary files
     */
    cleanup() {
        try {
            if (fs.existsSync(this.tempDir)) {
                const files = fs.readdirSync(this.tempDir);
                for (const file of files) {
                    const filePath = path.join(this.tempDir, file);
                    if (fs.statSync(filePath).isFile()) {
                        fs.unlinkSync(filePath);
                    }
                }
            }
        } catch (error) {
            console.warn('Failed to cleanup temp files:', error.message);
        }
    }
}

module.exports = LocalWhisperService;