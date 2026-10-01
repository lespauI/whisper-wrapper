const { WhisperServerWorker } = require('./whisperServerWorker');

class PcmAudio {
    constructor(wav) {
        if (!Buffer.isBuffer(wav) || wav.length < 44 || wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') {
            throw new Error('Converted audio must be a PCM WAV file');
        }
        let validFormat = false;
        for (let offset = 12; offset + 8 <= wav.length;) {
            const type = wav.toString('ascii', offset, offset + 4);
            const size = wav.readUInt32LE(offset + 4);
            const start = offset + 8;
            if (start + size > wav.length) throw new Error('Truncated PCM WAV file');
            if (type === 'fmt ') {
                validFormat = size >= 16 && wav.readUInt16LE(start) === 1 && wav.readUInt16LE(start + 2) === 1 &&
                    wav.readUInt32LE(start + 4) === 16000 && wav.readUInt16LE(start + 12) === 2 && wav.readUInt16LE(start + 14) === 16;
            }
            if (type === 'data') this.pcm = wav.subarray(start, start + size);
            offset = start + size + (size % 2);
        }
        if (!validFormat || !this.pcm || !this.pcm.length || this.pcm.length % 2) {
            throw new Error('Converted audio must contain nonempty 16 kHz mono PCM16 samples');
        }
        this.duration = this.pcm.length / 32000;
    }

    slice(start, end) {
        const pcm = this.pcm.subarray(Math.round(start * 16000) * 2, Math.round(end * 16000) * 2);
        const header = Buffer.alloc(44);
        header.write('RIFF', 0);
        header.writeUInt32LE(pcm.length + 36, 4);
        header.write('WAVEfmt ', 8);
        header.writeUInt32LE(16, 16);
        header.writeUInt16LE(1, 20);
        header.writeUInt16LE(1, 22);
        header.writeUInt32LE(16000, 24);
        header.writeUInt32LE(32000, 28);
        header.writeUInt16LE(2, 32);
        header.writeUInt16LE(16, 34);
        header.write('data', 36);
        header.writeUInt32LE(pcm.length, 40);
        return [header, pcm];
    }

    isSilent(start, end) {
        const pcm = this.slice(start, end)[1];
        let energy = 0;
        for (let offset = 0; offset < pcm.length; offset += 2) energy += pcm.readInt16LE(offset) ** 2;
        return energy / (pcm.length / 2) < 20 ** 2;
    }

    nearestSilence(position, minimum, maximum) {
        const first = Math.max(minimum, position - 2.5);
        const last = Math.min(maximum, position + 2.5);
        let quietStart = null;
        let nearest = position;
        let distance = Infinity;
        const consider = end => {
            if (quietStart !== null && end - quietStart >= 0.1) {
                const candidate = Math.max(quietStart + 0.05, Math.min(end - 0.05, position));
                if (Math.abs(candidate - position) < distance) {
                    nearest = candidate;
                    distance = Math.abs(candidate - position);
                }
            }
        };
        for (let start = first; start + 0.02 <= last; start += 0.02) {
            const samples = this.slice(start, start + 0.02)[1];
            let energy = 0;
            for (let i = 0; i < samples.length; i += 2) energy += samples.readInt16LE(i) ** 2;
            if (energy / (samples.length / 2) < 200 ** 2) {
                if (quietStart === null) quietStart = start;
            } else {
                consider(start);
                quietStart = null;
            }
        }
        consider(last);
        return Math.round(nearest * 16000) / 16000;
    }
}

class MultilingualWhisperService {
    constructor() {
        this.workers = new Map();
        this.queue = Promise.resolve();
        this.closed = false;
    }

    worker(binary, model, options) {
        const key = JSON.stringify([binary, model, options.threads, options.useGpu, options.flashAttn, options.gpuDevice]);
        if (!this.workers.has(key)) this.workers.set(key, new WhisperServerWorker(binary, model, options));
        return this.workers.get(key);
    }

    transcribe(wav, settings) {
        const task = this.queue.then(async () => {
            try {
                return await this.run(wav, settings);
            } catch (error) {
                this.disposeWorkers();
                this.configuration = undefined;
                throw error;
            }
        });
        this.queue = task.catch(() => undefined);
        return task;
    }

    async detect(worker, audio, start, end) {
        const result = await worker.infer(audio.slice(start, end), {
            language: 'auto', detect_language: true, response_format: 'verbose_json',
            no_language_probabilities: false, token_timestamps: false, max_context: 0
        });
        const ranked = Object.entries(result.language_probabilities || {})
            .filter(([, probability]) => Number.isFinite(probability) && probability > 0)
            .sort((left, right) => right[1] - left[1]);
        if (!ranked.length) throw new Error('whisper-server must support verbose_json language probabilities; rebuild the server with the current whisper.cpp sources');
        return { language: ranked[0][0], confidence: ranked[0][1],
            margin: ranked[0][1] - (ranked[1] ? ranked[1][1] : 0) };
    }

    async run(wav, settings) {
        const started = Date.now();
        if (this.closed) throw new Error('Multilingual transcription service has been closed');
        const audio = new PcmAudio(wav);
        const { binary, modelPath, tinyModelPath, options } = settings;
        const configuration = JSON.stringify([binary, modelPath, tinyModelPath, options.threads, options.useGpu, options.flashAttn, options.gpuDevice]);
        if (configuration !== this.configuration) {
            this.disposeWorkers();
            this.configuration = configuration;
        }
        const decoder = this.worker(binary, modelPath, options);
        const detector = this.worker(binary, tinyModelPath || modelPath, options);
        const windows = [];
        for (let start = 0; start < audio.duration; start += 30) {
            const end = Math.min(start + 30, audio.duration);
            if (audio.isSilent(start, end)) {
                windows.push({ start, end, silent: true });
                continue;
            }
            let detection = await this.detect(detector, audio, start, end);
            const previous = windows[windows.length - 1];
            if ((detection.confidence < 0.45 || detection.margin < 0.1) && decoder !== detector) {
                detection = await this.detect(decoder, audio, start, end);
            }
            if (end - start < 5 && previous && !previous.silent && detection.confidence < 0.8) {
                detection.language = previous.language;
            }
            windows.push({ start, end, ...detection });
        }
        for (let i = 1; i + 1 < windows.length; i++) {
            const previous = windows[i - 1];
            const current = windows[i];
            const next = windows[i + 1];
            if (!current.silent && previous.language && previous.language === next.language && current.language !== previous.language && decoder !== detector) {
                Object.assign(current, await this.detect(decoder, audio, current.start, current.end));
            }
        }
        const boundaryWindows = new Set();
        for (let i = 1; i < windows.length; i++) {
            if (windows[i].language && windows[i - 1].language && windows[i].language !== windows[i - 1].language) {
                boundaryWindows.add(i - 1);
                boundaryWindows.add(i);
            }
        }
        const refined = [];
        for (let i = 0; i < windows.length; i++) {
            const window = windows[i];
            if (!boundaryWindows.has(i)) { refined.push(window); continue; }
            const neighbors = new Set([windows[i - 1]?.language, window.language, windows[i + 1]?.language]);
            for (let start = window.start; start < window.end; start += 5) {
                const end = Math.min(start + 5, window.end);
                if (audio.isSilent(start, end)) { refined.push({ start, end, silent: true }); continue; }
                const detection = await this.detect(decoder, audio, start, end);
                const language = neighbors.has(detection.language) && detection.confidence >= 0.8 && detection.margin >= 0.2 ? detection.language : window.language;
                refined.push({ start, end, language });
            }
        }
        const sections = [];
        for (const window of refined) {
            if (window.silent) continue;
            const previous = sections[sections.length - 1];
            if (previous && previous.language === window.language && previous.end === window.start) previous.end = window.end;
            else sections.push({ start: window.start, end: window.end, language: window.language });
        }
        for (let i = 1; i < sections.length; i++) {
            const previous = sections[i - 1];
            const current = sections[i];
            if (previous.end === current.start) {
                const boundary = audio.nearestSilence(current.start, previous.start + 0.1, current.end - 0.1);
                previous.end = boundary;
                current.start = boundary;
            }
        }
        const segments = [];
        for (const section of sections) {
            for (let start = section.start; start < section.end; start += 600) {
                const end = Math.min(start + 600, section.end);
                const result = await decoder.infer(audio.slice(start, end), {
                    language: section.language, translate: !!options.translate,
                    prompt: options.prompt || '', carry_initial_prompt: false,
                    response_format: 'verbose_json', no_language_probabilities: true,
                    max_context: 0, max_len: 1000000, token_timestamps: false,
                    best_of: 5, beam_size: 5, temperature: 0, temperature_inc: 0
                });
                if (!Array.isArray(result.segments)) throw new Error('Whisper returned invalid transcription segments');
                for (const segment of result.segments) {
                    if (!Number.isFinite(segment.start) || !Number.isFinite(segment.end) || segment.end < segment.start || typeof segment.text !== 'string') {
                        throw new Error('Whisper returned invalid segment timestamps or text');
                    }
                    const text = segment.text.trim();
                    if (!text) continue;
                    segments.push({ id: segments.length, start: Math.min(end, Math.max(start, start + segment.start)),
                        end: Math.min(end, Math.max(start, start + segment.end)), text, language: section.language });
                }
            }
        }
        const languages = [...new Set(sections.map(section => section.language))];
        return { success: true, text: segments.map(segment => segment.text).join(' '), segments,
            language: languages.length > 1 ? 'mixed' : languages[0] || 'auto', languages,
            model: options.model, duration: Date.now() - started, audioDuration: audio.duration };
    }

    disposeWorkers() {
        for (const worker of this.workers.values()) worker.close();
        this.workers.clear();
    }

    close() {
        this.closed = true;
        this.disposeWorkers();
    }
}

module.exports = { MultilingualWhisperService, PcmAudio };
