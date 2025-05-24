/**
 * Local Whisper Service - Handles transcription using local whisper.cpp
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class LocalWhisperService {
    constructor() {
        console.log('🔧 LocalWhisperService: Initializing...');
        
        this.whisperPath = this.findWhisperBinary();
        this.modelsPath = path.join(process.cwd(), 'models');
        this.tempDir = path.join(os.tmpdir(), 'whisper-wrapper');
        
        console.log('📁 LocalWhisperService: Paths configured:');
        console.log(`   - Whisper binary: ${this.whisperPath || 'NOT FOUND'}`);
        console.log(`   - Models directory: ${this.modelsPath}`);
        console.log(`   - Temp directory: ${this.tempDir}`);
        
        // Default settings
        this.model = 'base';
        this.language = 'auto';
        this.threads = 4;
        this.translate = false;
        
        console.log('⚙️ LocalWhisperService: Default settings:');
        console.log(`   - Model: ${this.model}`);
        console.log(`   - Language: ${this.language}`);
        console.log(`   - Threads: ${this.threads}`);
        
        // Ensure temp directory exists
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
            console.log(`📂 LocalWhisperService: Created temp directory: ${this.tempDir}`);
        } else {
            console.log(`📂 LocalWhisperService: Using existing temp directory: ${this.tempDir}`);
        }
        
        // Log available models
        const availableModels = this.getAvailableModels();
        console.log(`🤖 LocalWhisperService: Found ${availableModels.length} models:`, availableModels.map(m => m.name));
        
        console.log('✅ LocalWhisperService: Initialization complete');
    }

    /**
     * Find the whisper.cpp binary
     */
    findWhisperBinary() {
        console.log('🔍 LocalWhisperService: Searching for whisper.cpp binary...');
        
        const possiblePaths = [
            path.join(process.cwd(), 'whisper.cpp', 'build', 'bin', 'whisper-cli'),
            path.join(process.cwd(), 'whisper.cpp', 'build', 'bin', 'whisper-cli.exe'),
            path.join(process.cwd(), 'whisper.cpp', 'main'),
            path.join(process.cwd(), 'whisper.cpp', 'main.exe'),
            path.join(process.cwd(), 'whisper.cpp', 'build', 'bin', 'main'),
            path.join(process.cwd(), 'whisper.cpp', 'build', 'bin', 'main.exe'),
            path.join(process.cwd(), 'whisper.cpp', 'build', 'bin', 'Release', 'main.exe'),
        ];

        console.log('🔍 LocalWhisperService: Checking possible paths:');
        for (const whisperPath of possiblePaths) {
            const exists = fs.existsSync(whisperPath);
            console.log(`   - ${whisperPath}: ${exists ? '✅ FOUND' : '❌ NOT FOUND'}`);
            if (exists) {
                console.log(`🎯 LocalWhisperService: Using whisper binary: ${whisperPath}`);
                return whisperPath;
            }
        }

        console.log('❌ LocalWhisperService: No whisper.cpp binary found!');
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
     * Extract audio from video file using ffmpeg
     * @param {string} inputPath - Path to video file
     * @param {string} outputPath - Path for extracted audio
     * @returns {Promise<void>}
     */
    async extractAudioFromVideo(inputPath, outputPath) {
        console.log('🎬 LocalWhisperService: Extracting audio from video...');
        console.log(`📹 Input: ${inputPath}`);
        console.log(`🎵 Output: ${outputPath}`);

        return new Promise((resolve, reject) => {
            // Use ffmpeg to extract audio as WAV
            const ffmpegArgs = [
                '-i', inputPath,           // Input file
                '-vn',                     // No video
                '-acodec', 'pcm_s16le',    // Audio codec: 16-bit PCM
                '-ar', '16000',            // Sample rate: 16kHz (good for speech)
                '-ac', '1',                // Mono audio
                '-y',                      // Overwrite output file
                outputPath                 // Output file
            ];

            console.log('🚀 LocalWhisperService: Executing ffmpeg command:');
            console.log(`   Command: ffmpeg ${ffmpegArgs.join(' ')}`);

            const ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let stdout = '';
            let stderr = '';

            ffmpegProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            ffmpegProcess.stderr.on('data', (data) => {
                const chunk = data.toString();
                stderr += chunk;
                // FFmpeg outputs progress to stderr, so we log it
                if (chunk.includes('time=') || chunk.includes('size=')) {
                    console.log('📊 FFmpeg progress:', chunk.trim());
                }
            });

            ffmpegProcess.on('close', (code) => {
                if (code === 0) {
                    console.log('✅ LocalWhisperService: Audio extraction completed successfully');
                    
                    // Verify output file exists and has content
                    if (fs.existsSync(outputPath)) {
                        const stats = fs.statSync(outputPath);
                        console.log(`📊 Extracted audio size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
                        resolve();
                    } else {
                        reject(new Error('Audio extraction completed but output file not found'));
                    }
                } else {
                    console.log(`❌ LocalWhisperService: FFmpeg failed with code ${code}`);
                    console.log('📄 FFmpeg stderr:', stderr);
                    reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
                }
            });

            ffmpegProcess.on('error', (error) => {
                console.log('❌ LocalWhisperService: Failed to start ffmpeg:', error.message);
                reject(new Error(`Failed to start ffmpeg: ${error.message}`));
            });
        });
    }

    /**
     * Check if file is a video format that needs audio extraction
     * @param {string} filePath - Path to file
     * @returns {boolean}
     */
    isVideoFile(filePath) {
        const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.flv', '.wmv'];
        const ext = path.extname(filePath).toLowerCase();
        return videoExtensions.includes(ext);
    }

    /**
     * Check if file is already an audio format supported by whisper.cpp
     * @param {string} filePath - Path to file
     * @returns {boolean}
     */
    isSupportedAudioFile(filePath) {
        const supportedExtensions = ['.wav', '.mp3', '.flac', '.ogg'];
        const ext = path.extname(filePath).toLowerCase();
        return supportedExtensions.includes(ext);
    }

    /**
     * Transcribe audio file using whisper.cpp
     */
    async transcribeFile(filePath, options = {}) {
        console.log('🎤 LocalWhisperService: Starting transcription...');
        console.log(`📁 Input file: ${filePath}`);
        console.log(`⚙️ Options:`, options);
        
        if (!this.isAvailable()) {
            console.log('❌ LocalWhisperService: whisper.cpp is not available');
            throw new Error('whisper.cpp is not available. Please run the setup script first.');
        }

        // Check if input file exists
        if (!fs.existsSync(filePath)) {
            console.log(`❌ LocalWhisperService: Input file does not exist: ${filePath}`);
            throw new Error(`Input file does not exist: ${filePath}`);
        }

        const fileStats = fs.statSync(filePath);
        console.log(`📊 Input file size: ${(fileStats.size / 1024 / 1024).toFixed(2)} MB`);

        // Determine if we need to extract audio from video
        let audioFilePath = filePath;
        let needsCleanup = false;

        if (this.isVideoFile(filePath)) {
            console.log('🎬 LocalWhisperService: Video file detected, extracting audio...');
            
            // Create temporary audio file path
            const audioFileName = `extracted_audio_${Date.now()}.wav`;
            audioFilePath = path.join(this.tempDir, audioFileName);
            needsCleanup = true;

            try {
                // Extract audio from video
                await this.extractAudioFromVideo(filePath, audioFilePath);
                console.log(`🎵 LocalWhisperService: Audio extracted to: ${audioFilePath}`);
            } catch (extractionError) {
                console.log('❌ LocalWhisperService: Audio extraction failed:', extractionError.message);
                throw new Error(`Audio extraction failed: ${extractionError.message}`);
            }
        } else if (this.isSupportedAudioFile(filePath)) {
            console.log('🎵 LocalWhisperService: Audio file detected, proceeding with transcription');
        } else {
            console.log('❌ LocalWhisperService: Unsupported file format');
            const ext = path.extname(filePath);
            throw new Error(`Unsupported file format: ${ext}. Supported formats: .wav, .mp3, .flac, .ogg, .mp4, .mov, .avi, .mkv, .webm`);
        }

        const {
            model = 'base',
            language = 'auto',
            translate = false,
            outputFormat = 'json',
            threads = 4
        } = options;

        console.log(`🤖 Using model: ${model}`);
        console.log(`🌍 Language: ${language}`);
        console.log(`🔄 Translate: ${translate}`);
        console.log(`🧵 Threads: ${threads}`);

        // Find model file
        const modelPath = this.findModelPath(model);
        if (!modelPath) {
            const availableModels = this.getAvailableModels().map(m => m.name).join(', ');
            console.log(`❌ LocalWhisperService: Model '${model}' not found. Available: ${availableModels}`);
            throw new Error(`Model '${model}' not found. Available models: ${availableModels}`);
        }

        console.log(`📦 Model path: ${modelPath}`);

        // Prepare output file
        const outputFile = path.join(this.tempDir, `transcription_${Date.now()}.json`);
        console.log(`📄 Output file: ${outputFile}`);

        // Build whisper.cpp command
        const args = [
            '-m', modelPath,
            '-f', audioFilePath,  // Use the audio file path (extracted or original)
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

        console.log('🚀 LocalWhisperService: Executing whisper.cpp command:');
        console.log(`   Command: ${this.whisperPath}`);
        console.log(`   Args: ${args.join(' ')}`);

        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const whisperProcess = spawn(this.whisperPath, args, {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let stdout = '';
            let stderr = '';

            whisperProcess.stdout.on('data', (data) => {
                const chunk = data.toString();
                stdout += chunk;
                console.log('📤 STDOUT:', chunk.trim());
            });

            whisperProcess.stderr.on('data', (data) => {
                const chunk = data.toString();
                stderr += chunk;
                console.log('📥 STDERR:', chunk.trim());
            });

            whisperProcess.on('close', (code) => {
                const duration = Date.now() - startTime;
                console.log(`⏱️ LocalWhisperService: Process completed in ${duration}ms with code ${code}`);
                
                if (code === 0) {
                    console.log('✅ LocalWhisperService: Transcription successful, processing output...');
                    try {
                        // Read the JSON output file
                        const jsonOutputFile = outputFile;
                        console.log(`📖 Looking for output file: ${jsonOutputFile}`);
                        
                        if (fs.existsSync(jsonOutputFile)) {
                            console.log('📄 JSON output file found, parsing...');
                            const result = JSON.parse(fs.readFileSync(jsonOutputFile, 'utf8'));
                            console.log('📊 Parsed JSON result:', {
                                transcriptionSegments: result.transcription?.length || 0,
                                hasTranscription: !!result.transcription
                            });
                            
                            // Clean up temp file
                            fs.unlinkSync(jsonOutputFile);
                            console.log('🗑️ Cleaned up temp file');
                            
                            // Extract text from segments
                            const text = result.transcription
                                .map(segment => segment.text)
                                .join(' ')
                                .trim();

                            console.log(`📝 Extracted text (${text.length} chars): ${text.substring(0, 100)}...`);

                            // Detect language from result
                            const detectedLanguage = this.detectLanguageFromOutput(stderr) || language;
                            console.log(`🌍 Detected language: ${detectedLanguage}`);

                            const finalResult = {
                                success: true,
                                text: text,
                                language: detectedLanguage,
                                segments: result.transcription,
                                model: model,
                                duration: this.extractDuration(stderr)
                            };

                            console.log('🎉 LocalWhisperService: Transcription completed successfully!');
                            
                            // Clean up extracted audio file if needed
                            if (needsCleanup && fs.existsSync(audioFilePath)) {
                                console.log('🗑️ LocalWhisperService: Cleaning up extracted audio file');
                                fs.unlinkSync(audioFilePath);
                            }
                            
                            resolve(finalResult);
                        } else {
                            console.log('⚠️ JSON output file not found, using fallback text extraction');
                            // Fallback: extract text from stdout
                            const text = this.extractTextFromOutput(stdout);
                            console.log(`📝 Fallback extracted text: ${text}`);
                            
                            const fallbackResult = {
                                success: true,
                                text: text,
                                language: language,
                                model: model
                            };
                            
                            console.log('✅ LocalWhisperService: Transcription completed with fallback method');
                            
                            // Clean up extracted audio file if needed
                            if (needsCleanup && fs.existsSync(audioFilePath)) {
                                console.log('🗑️ LocalWhisperService: Cleaning up extracted audio file');
                                fs.unlinkSync(audioFilePath);
                            }
                            
                            resolve(fallbackResult);
                        }
                    } catch (error) {
                        console.log('❌ LocalWhisperService: Failed to parse output:', error.message);
                        console.log('📄 STDOUT:', stdout);
                        console.log('📄 STDERR:', stderr);
                        
                        // Clean up extracted audio file if needed
                        if (needsCleanup && fs.existsSync(audioFilePath)) {
                            console.log('🗑️ LocalWhisperService: Cleaning up extracted audio file');
                            fs.unlinkSync(audioFilePath);
                        }
                        
                        reject(new Error(`Failed to parse whisper.cpp output: ${error.message}`));
                    }
                } else {
                    console.log(`❌ LocalWhisperService: whisper.cpp failed with code ${code}`);
                    console.log('📄 STDERR:', stderr);
                    console.log('📄 STDOUT:', stdout);
                    
                    // Clean up extracted audio file if needed
                    if (needsCleanup && fs.existsSync(audioFilePath)) {
                        console.log('🗑️ LocalWhisperService: Cleaning up extracted audio file');
                        fs.unlinkSync(audioFilePath);
                    }
                    
                    reject(new Error(`whisper.cpp failed with code ${code}: ${stderr}`));
                }
            });

            whisperProcess.on('error', (error) => {
                console.log('❌ LocalWhisperService: Failed to start whisper.cpp process:', error.message);
                
                // Clean up extracted audio file if needed
                if (needsCleanup && fs.existsSync(audioFilePath)) {
                    console.log('🗑️ LocalWhisperService: Cleaning up extracted audio file');
                    fs.unlinkSync(audioFilePath);
                }
                
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