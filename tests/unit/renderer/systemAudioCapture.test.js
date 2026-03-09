jest.mock('../../../src/renderer/utils/UIHelpers.js', () => ({
    UIHelpers: {
        show: jest.fn(),
        hide: jest.fn(),
        toggle: jest.fn(),
        isVisible: jest.fn(),
        addClass: jest.fn(),
        removeClass: jest.fn(),
        toggleClass: jest.fn(),
        setText: jest.fn(),
        getValue: jest.fn(),
        setValue: jest.fn(),
        setDisabled: jest.fn(),
        getElementById: jest.fn().mockReturnValue(null),
        setHTML: jest.fn(),
        setStyle: jest.fn(),
    }
}));

jest.mock('../../../src/renderer/utils/EventHandler.js', () => ({
    EventHandler: {
        addListener: jest.fn().mockReturnValue(true),
        addListeners: jest.fn(),
        removeListener: jest.fn(),
        createAsyncHandler: jest.fn((fn) => fn),
        debounce: jest.fn((fn) => fn),
    }
}));

jest.mock('../../../src/renderer/utils/Constants.js', () => ({
    RECORDING_SETTINGS: { DEFAULT_QUALITY: 'high', DEFAULT_FORMAT: 'webm' },
    TABS: { RECORDING: 'recording', TRANSCRIPTION: 'transcription' },
    CSS_CLASSES: { HIDDEN: 'hidden', ACTIVE: 'active' },
    SELECTORS: { RECORDING_TAB: '#recording-tab' }
}));

jest.mock('../../../src/renderer/utils/vad/energyVAD.js', () => ({
    calibrate: jest.fn().mockReturnValue({}),
    detect: jest.fn().mockReturnValue({ isSpeech: false, confidence: 0 })
}));

jest.mock('../../../src/renderer/utils/vad/webrtcVAD.js', () => ({
    calibrate: jest.fn().mockReturnValue({}),
    detect: jest.fn().mockReturnValue({ isSpeech: false, confidence: 0 })
}));

jest.mock('../../../src/renderer/utils/vad/segmenter.js', () => ({
    segment: jest.fn().mockReturnValue([])
}));

jest.mock('../../../src/renderer/utils/wavEncoder.js', () => ({
    encodePCM16: jest.fn().mockReturnValue(new ArrayBuffer(0))
}));

jest.mock('../../../src/renderer/utils/metrics.js', () => ({
    record: jest.fn(),
    reset: jest.fn(),
    getSnapshot: jest.fn().mockReturnValue({})
}));

const { UIHelpers } = require('../../../src/renderer/utils/UIHelpers.js');
const { RecordingController } = require('../../../src/renderer/controllers/RecordingController.js');

function buildMockStream({ audioTracks = 1, videoTracks = 0 } = {}) {
    const tracks = [];
    for (let i = 0; i < audioTracks; i++) tracks.push({ kind: 'audio', stop: jest.fn() });
    for (let i = 0; i < videoTracks; i++) tracks.push({ kind: 'video', stop: jest.fn() });

    return {
        getTracks: jest.fn(() => tracks),
        getAudioTracks: jest.fn(() => tracks.filter((t) => t.kind === 'audio')),
        getVideoTracks: jest.fn(() => tracks.filter((t) => t.kind === 'video')),
    };
}

function buildMockAudioContext(destinationStream) {
    const destination = { stream: destinationStream || buildMockStream() };
    const gain = { gain: { value: 1 }, connect: jest.fn() };
    const compressor = {
        threshold: { value: 0 },
        knee: { value: 0 },
        ratio: { value: 0 },
        attack: { value: 0 },
        release: { value: 0 },
        connect: jest.fn(),
    };
    const source = { connect: jest.fn() };
    const ctx = {
        createMediaStreamDestination: jest.fn().mockReturnValue(destination),
        createMediaStreamSource: jest.fn().mockReturnValue(source),
        createGain: jest.fn().mockReturnValue(gain),
        createDynamicsCompressor: jest.fn().mockReturnValue(compressor),
        createAnalyser: jest.fn().mockReturnValue({
            fftSize: 256,
            smoothingTimeConstant: 0,
            frequencyBinCount: 128,
            connect: jest.fn(),
        }),
        close: jest.fn(),
    };
    return ctx;
}

function buildController() {
    const appState = {
        subscribe: jest.fn(),
        getRecordingState: jest.fn().mockReturnValue({}),
        setRecordingState: jest.fn(),
    };
    const statusController = { updateStatus: jest.fn() };
    const tabController = { switchTab: jest.fn() };

    global.window = global.window || {};
    global.window.electronAPI = {
        getAudioSources: jest.fn(),
        setConfig: jest.fn().mockResolvedValue({}),
        getConfig: jest.fn().mockResolvedValue({}),
        getRecordingConstraints: jest.fn().mockResolvedValue({}),
        startRecording: jest.fn().mockResolvedValue({}),
        stopRecording: jest.fn().mockResolvedValue({}),
        saveRecordingChunk: jest.fn().mockResolvedValue({}),
        getVADMetrics: jest.fn().mockResolvedValue({}),
    };

    global.navigator = global.navigator || {};
    global.navigator.mediaDevices = {
        getUserMedia: jest.fn(),
    };

    const mockAudioCtx = buildMockAudioContext();
    global.window.AudioContext = jest.fn().mockReturnValue(mockAudioCtx);
    global.window.webkitAudioContext = undefined;
    global.window.MediaRecorder = jest.fn().mockImplementation(() => ({
        start: jest.fn(),
        stop: jest.fn(),
        pause: jest.fn(),
        resume: jest.fn(),
        ondataavailable: null,
        onstop: null,
        state: 'inactive',
        stream: buildMockStream(),
    }));
    global.MediaRecorder = global.window.MediaRecorder;
    global.AudioContext = global.window.AudioContext;

    const controller = new RecordingController(appState, statusController, tabController);
    controller._mockAudioCtx = mockAudioCtx;
    return controller;
}

describe('RecordingController — system audio capture', () => {
    let controller;

    beforeEach(() => {
        jest.clearAllMocks();
        UIHelpers.getElementById.mockReturnValue(null);
        controller = buildController();
    });

    describe('_getSystemAudioStream', () => {
        it('throws when getAudioSources reports failure', async () => {
            global.window.electronAPI.getAudioSources.mockResolvedValue({
                success: false,
                systemAudioSupported: false,
                sources: [],
                platform: 'darwin'
            });

            await expect(controller._getSystemAudioStream()).rejects.toThrow(
                'System audio capture is not supported on this platform.'
            );
        });

        it('throws when platform does not support system audio', async () => {
            global.window.electronAPI.getAudioSources.mockResolvedValue({
                success: true,
                systemAudioSupported: false,
                sources: [{ id: 'screen:0', name: 'Screen' }],
                platform: 'freebsd'
            });

            await expect(controller._getSystemAudioStream()).rejects.toThrow(
                'System audio capture is not supported on this platform.'
            );
        });

        it('throws when no screen source is found', async () => {
            global.window.electronAPI.getAudioSources.mockResolvedValue({
                success: true,
                systemAudioSupported: true,
                sources: [{ id: 'window:1', name: 'My App' }],
                platform: 'darwin'
            });

            await expect(controller._getSystemAudioStream()).rejects.toThrow(
                'No screen source found for system audio capture'
            );
        });

        it('returns a stream when screen source is found and audio tracks exist', async () => {
            const mockStream = buildMockStream({ audioTracks: 1, videoTracks: 1 });
            global.window.electronAPI.getAudioSources.mockResolvedValue({
                success: true,
                systemAudioSupported: true,
                sources: [{ id: 'screen:0', name: 'Entire Screen' }],
                platform: 'win32'
            });
            global.navigator.mediaDevices.getUserMedia.mockResolvedValue(mockStream);

            const stream = await controller._getSystemAudioStream();

            expect(stream).toBe(mockStream);
            expect(mockStream.getVideoTracks()[0].stop).toHaveBeenCalled();
        });

        it('passes the correct desktop capture constraints to getUserMedia', async () => {
            const mockStream = buildMockStream({ audioTracks: 1, videoTracks: 1 });
            global.window.electronAPI.getAudioSources.mockResolvedValue({
                success: true,
                systemAudioSupported: true,
                sources: [{ id: 'screen:42', name: 'Monitor' }],
                platform: 'linux'
            });
            global.navigator.mediaDevices.getUserMedia.mockResolvedValue(mockStream);

            await controller._getSystemAudioStream();

            expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(
                expect.objectContaining({
                    audio: expect.objectContaining({
                        mandatory: expect.objectContaining({
                            chromeMediaSource: 'desktop',
                            chromeMediaSourceId: 'screen:42'
                        })
                    })
                })
            );
        });

        it('throws when stream has no audio tracks', async () => {
            const mockStream = buildMockStream({ audioTracks: 0, videoTracks: 1 });
            global.window.electronAPI.getAudioSources.mockResolvedValue({
                success: true,
                systemAudioSupported: true,
                sources: [{ id: 'screen:0', name: 'Screen' }],
                platform: 'darwin'
            });
            global.navigator.mediaDevices.getUserMedia.mockResolvedValue(mockStream);

            await expect(controller._getSystemAudioStream()).rejects.toThrow(
                'System audio capture returned no audio tracks'
            );
            expect(mockStream.getTracks()[0].stop).toHaveBeenCalled();
        });
    });

    describe('_getMixedStream', () => {
        it('creates an AudioContext, connects both streams, and returns destination stream', async () => {
            const micStream = buildMockStream({ audioTracks: 1 });
            const sysStream = buildMockStream({ audioTracks: 1 });
            const destStream = buildMockStream({ audioTracks: 1 });

            const mockCtx = buildMockAudioContext(destStream);
            global.window.AudioContext = jest.fn().mockReturnValue(mockCtx);

            const result = await controller._getMixedStream(micStream, sysStream);

            expect(mockCtx.createMediaStreamDestination).toHaveBeenCalledTimes(1);
            expect(mockCtx.createMediaStreamSource).toHaveBeenCalledTimes(2);
            expect(mockCtx.createGain).toHaveBeenCalledTimes(2);
            expect(mockCtx.createDynamicsCompressor).toHaveBeenCalledTimes(1);
            expect(result).toBe(destStream);
        });

        it('sets gain values to 0.7 for both mic and system', async () => {
            const micStream = buildMockStream({ audioTracks: 1 });
            const sysStream = buildMockStream({ audioTracks: 1 });

            const micGain = { gain: { value: 1 }, connect: jest.fn() };
            const sysGain = { gain: { value: 1 }, connect: jest.fn() };
            const compressor = {
                threshold: { value: 0 }, knee: { value: 0 }, ratio: { value: 0 },
                attack: { value: 0 }, release: { value: 0 }, connect: jest.fn()
            };
            const source = { connect: jest.fn() };
            const destination = { stream: buildMockStream() };
            const mockCtx = {
                createMediaStreamDestination: jest.fn().mockReturnValue(destination),
                createMediaStreamSource: jest.fn().mockReturnValue(source),
                createGain: jest.fn()
                    .mockReturnValueOnce(micGain)
                    .mockReturnValueOnce(sysGain),
                createDynamicsCompressor: jest.fn().mockReturnValue(compressor),
                close: jest.fn(),
            };
            global.window.AudioContext = jest.fn().mockReturnValue(mockCtx);

            await controller._getMixedStream(micStream, sysStream);

            expect(micGain.gain.value).toBe(0.7);
            expect(sysGain.gain.value).toBe(0.7);
        });

        it('stores the AudioContext reference in _mixAudioContext', async () => {
            const micStream = buildMockStream({ audioTracks: 1 });
            const sysStream = buildMockStream({ audioTracks: 1 });
            const mockCtx = buildMockAudioContext();
            global.window.AudioContext = jest.fn().mockReturnValue(mockCtx);

            await controller._getMixedStream(micStream, sysStream);

            expect(controller._mixAudioContext).toBe(mockCtx);
        });

        it('falls back to webkitAudioContext when AudioContext is unavailable', async () => {
            const micStream = buildMockStream({ audioTracks: 1 });
            const sysStream = buildMockStream({ audioTracks: 1 });
            const mockCtx = buildMockAudioContext();
            global.window.AudioContext = undefined;
            global.window.webkitAudioContext = jest.fn().mockReturnValue(mockCtx);

            await controller._getMixedStream(micStream, sysStream);

            expect(global.window.webkitAudioContext).toHaveBeenCalled();
            expect(controller._mixAudioContext).toBe(mockCtx);
        });
    });

    describe('_updateCaptureModeUI', () => {
        it('hides warning and returns early when mode is microphone', async () => {
            UIHelpers.getElementById.mockReturnValue({ textContent: '' });

            await controller._updateCaptureModeUI('microphone');

            expect(UIHelpers.addClass).toHaveBeenCalledWith('#system-audio-warning', 'hidden');
            expect(global.window.electronAPI.getAudioSources).not.toHaveBeenCalled();
        });

        it('returns early when warning elements are absent from DOM', async () => {
            UIHelpers.getElementById.mockReturnValue(null);

            await controller._updateCaptureModeUI('system');

            expect(global.window.electronAPI.getAudioSources).not.toHaveBeenCalled();
        });

        it('shows unsupported message when systemAudioSupported is false', async () => {
            const warningEl = {};
            const warningTextEl = { textContent: '' };
            UIHelpers.getElementById
                .mockReturnValueOnce(warningEl)
                .mockReturnValueOnce(warningTextEl);

            global.window.electronAPI.getAudioSources.mockResolvedValue({
                success: true,
                systemAudioSupported: false,
                sources: [],
                platform: 'linux'
            });

            await controller._updateCaptureModeUI('system');

            expect(warningTextEl.textContent).toBe(
                'System audio capture is not supported on this platform.'
            );
            expect(UIHelpers.removeClass).toHaveBeenCalledWith('#system-audio-warning', 'hidden');
        });

        it('shows BlackHole install message on darwin platform', async () => {
            const warningEl = {};
            const warningTextEl = { textContent: '' };
            UIHelpers.getElementById
                .mockReturnValueOnce(warningEl)
                .mockReturnValueOnce(warningTextEl);

            global.window.electronAPI.getAudioSources.mockResolvedValue({
                success: true,
                systemAudioSupported: true,
                sources: [{ id: 'screen:0', name: 'Screen' }],
                platform: 'darwin'
            });

            await controller._updateCaptureModeUI('system');

            expect(warningTextEl.textContent).toContain('BlackHole');
            expect(warningTextEl.textContent).toContain('https://existential.audio/blackhole');
            expect(UIHelpers.removeClass).toHaveBeenCalledWith('#system-audio-warning', 'hidden');
        });

        it('hides warning on non-darwin supported platforms', async () => {
            const warningEl = {};
            const warningTextEl = { textContent: '' };
            UIHelpers.getElementById
                .mockReturnValueOnce(warningEl)
                .mockReturnValueOnce(warningTextEl);

            global.window.electronAPI.getAudioSources.mockResolvedValue({
                success: true,
                systemAudioSupported: true,
                sources: [{ id: 'screen:0', name: 'Screen' }],
                platform: 'win32'
            });

            await controller._updateCaptureModeUI('system');

            expect(UIHelpers.addClass).toHaveBeenCalledWith('#system-audio-warning', 'hidden');
        });

        it('shows BlackHole message also when mode is both', async () => {
            const warningEl = {};
            const warningTextEl = { textContent: '' };
            UIHelpers.getElementById
                .mockReturnValueOnce(warningEl)
                .mockReturnValueOnce(warningTextEl);

            global.window.electronAPI.getAudioSources.mockResolvedValue({
                success: true,
                systemAudioSupported: true,
                sources: [{ id: 'screen:0', name: 'Screen' }],
                platform: 'darwin'
            });

            await controller._updateCaptureModeUI('both');

            expect(warningTextEl.textContent).toContain('BlackHole');
        });

        it('hides warning and does not throw when getAudioSources throws', async () => {
            const warningEl = {};
            const warningTextEl = { textContent: '' };
            UIHelpers.getElementById
                .mockReturnValueOnce(warningEl)
                .mockReturnValueOnce(warningTextEl);

            global.window.electronAPI.getAudioSources.mockRejectedValue(new Error('IPC error'));

            await expect(controller._updateCaptureModeUI('system')).resolves.toBeUndefined();
            expect(UIHelpers.addClass).toHaveBeenCalledWith('#system-audio-warning', 'hidden');
        });
    });

    describe('startRecording — capture mode selection', () => {
        function stubStartRecording(ctrl, stream) {
            ctrl.getRecordingConstraints = jest.fn().mockReturnValue({ audio: true });
            ctrl.getMimeType = jest.fn().mockReturnValue('audio/webm');
            ctrl.initializeAutoSaveSession = jest.fn().mockResolvedValue(undefined);
            ctrl.initializeOngoingTranscription = jest.fn().mockResolvedValue(undefined);
            ctrl.updateRecordingUI = jest.fn();
            ctrl.startRecordingTimer = jest.fn();
            ctrl.startVisualization = jest.fn();
            ctrl.startAutoSaveTimer = jest.fn();

            const analyser = {
                fftSize: 256,
                smoothingTimeConstant: 0,
                frequencyBinCount: 128,
                connect: jest.fn(),
            };
            const source = { connect: jest.fn() };
            const mockCtx = {
                createAnalyser: jest.fn().mockReturnValue(analyser),
                createMediaStreamSource: jest.fn().mockReturnValue(source),
                close: jest.fn(),
            };
            global.window.AudioContext = jest.fn().mockReturnValue(mockCtx);

            global.window.MediaRecorder = jest.fn().mockImplementation(() => {
                const rec = {
                    start: jest.fn(),
                    stop: jest.fn(),
                    stream,
                    ondataavailable: null,
                    onstop: null,
                    state: 'inactive',
                };
                return rec;
            });
            global.MediaRecorder = global.window.MediaRecorder;

            global.navigator.mediaDevices.getUserMedia.mockResolvedValue(stream);
        }

        it('uses getUserMedia for mic-only mode and assigns _micStream', async () => {
            const stream = buildMockStream({ audioTracks: 1 });
            stubStartRecording(controller, stream);
            controller.captureMode = 'microphone';

            await controller.startRecording();

            expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
            expect(controller._micStream).toBe(stream);
            expect(controller._systemAudioStream).toBeNull();
            expect(controller.isRecording).toBe(true);
        });

        it('uses _getSystemAudioStream for system mode and assigns _systemAudioStream', async () => {
            const stream = buildMockStream({ audioTracks: 1 });
            stubStartRecording(controller, stream);
            controller.captureMode = 'system';
            controller._getSystemAudioStream = jest.fn().mockResolvedValue(stream);

            await controller.startRecording();

            expect(controller._getSystemAudioStream).toHaveBeenCalled();
            expect(controller._systemAudioStream).toBe(stream);
            expect(controller._micStream).toBeNull();
            expect(controller.isRecording).toBe(true);
        });

        it('mixes both streams in both mode', async () => {
            const micStream = buildMockStream({ audioTracks: 1 });
            const sysStream = buildMockStream({ audioTracks: 1 });
            const mixedStream = buildMockStream({ audioTracks: 1 });
            const stream = micStream;
            stubStartRecording(controller, stream);
            global.navigator.mediaDevices.getUserMedia.mockResolvedValue(micStream);
            controller.captureMode = 'both';
            controller._getSystemAudioStream = jest.fn().mockResolvedValue(sysStream);
            controller._getMixedStream = jest.fn().mockResolvedValue(mixedStream);

            await controller.startRecording();

            expect(controller._micStream).toBe(micStream);
            expect(controller._systemAudioStream).toBe(sysStream);
            expect(controller._getMixedStream).toHaveBeenCalledWith(micStream, sysStream);
            expect(controller.isRecording).toBe(true);
        });

        it('defaults to microphone mode when captureMode is unset', async () => {
            const stream = buildMockStream({ audioTracks: 1 });
            stubStartRecording(controller, stream);
            controller.captureMode = null;

            await controller.startRecording();

            expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
            expect(controller.isRecording).toBe(true);
        });

        it('cleans up streams and shows error when system stream fails in both mode', async () => {
            const micStream = buildMockStream({ audioTracks: 1 });
            const stream = micStream;
            stubStartRecording(controller, stream);
            global.navigator.mediaDevices.getUserMedia.mockResolvedValue(micStream);
            controller.captureMode = 'both';
            controller._getSystemAudioStream = jest.fn().mockRejectedValue(new Error('no system audio'));
            controller.statusController.showError = jest.fn();

            await controller.startRecording();

            expect(micStream.getTracks()[0].stop).toHaveBeenCalled();
            expect(controller.statusController.showError).toHaveBeenCalledWith(
                expect.stringContaining('Failed to start recording')
            );
            expect(controller.isRecording).toBe(false);
        });
    });

    describe('stopRecording — stream cleanup', () => {
        function buildMockRecorder(stream) {
            return {
                stop: jest.fn(),
                pause: jest.fn(),
                resume: jest.fn(),
                stream,
                ondataavailable: null,
                onstop: null,
                state: 'recording',
            };
        }

        it('stops only the recorder stream tracks in microphone mode', async () => {
            const recorderStream = buildMockStream({ audioTracks: 1 });
            controller.mediaRecorder = buildMockRecorder(recorderStream);
            controller._micStream = recorderStream;
            controller._systemAudioStream = null;
            controller.isRecording = true;
            controller.saveCurrentRecordingChunk = jest.fn().mockResolvedValue(undefined);
            controller.stopAutoSaveTimer = jest.fn();
            controller.stopRecordingTimer = jest.fn();
            controller.stopVisualization = jest.fn();
            controller.stopOngoingTranscription = jest.fn();
            controller.updateRecordingUI = jest.fn();
            controller.audioContext = { close: jest.fn() };

            await controller.stopRecording();

            expect(recorderStream.getTracks()[0].stop).toHaveBeenCalled();
        });

        it('closes _mixAudioContext when it exists', async () => {
            const recorderStream = buildMockStream({ audioTracks: 1 });
            const mixCtx = { close: jest.fn() };
            controller.mediaRecorder = buildMockRecorder(recorderStream);
            controller._micStream = null;
            controller._systemAudioStream = null;
            controller._mixAudioContext = mixCtx;
            controller.isRecording = true;
            controller.saveCurrentRecordingChunk = jest.fn().mockResolvedValue(undefined);
            controller.stopAutoSaveTimer = jest.fn();
            controller.stopRecordingTimer = jest.fn();
            controller.stopVisualization = jest.fn();
            controller.stopOngoingTranscription = jest.fn();
            controller.updateRecordingUI = jest.fn();
            controller.audioContext = { close: jest.fn() };

            await controller.stopRecording();

            expect(mixCtx.close).toHaveBeenCalled();
            expect(controller._mixAudioContext).toBeNull();
        });

        it('does not double-stop _micStream when it equals the recorder stream', async () => {
            const recorderStream = buildMockStream({ audioTracks: 1 });
            controller.mediaRecorder = buildMockRecorder(recorderStream);
            controller._micStream = recorderStream;
            controller._systemAudioStream = null;
            controller._mixAudioContext = null;
            controller.isRecording = true;
            controller.saveCurrentRecordingChunk = jest.fn().mockResolvedValue(undefined);
            controller.stopAutoSaveTimer = jest.fn();
            controller.stopRecordingTimer = jest.fn();
            controller.stopVisualization = jest.fn();
            controller.stopOngoingTranscription = jest.fn();
            controller.updateRecordingUI = jest.fn();
            controller.audioContext = { close: jest.fn() };

            await controller.stopRecording();

            expect(recorderStream.getTracks()[0].stop).toHaveBeenCalledTimes(1);
        });

        it('stops separate _systemAudioStream tracks in mixed mode', async () => {
            const recorderStream = buildMockStream({ audioTracks: 1 });
            const micStream = buildMockStream({ audioTracks: 1 });
            const sysStream = buildMockStream({ audioTracks: 1 });
            controller.mediaRecorder = buildMockRecorder(recorderStream);
            controller._micStream = micStream;
            controller._systemAudioStream = sysStream;
            controller._mixAudioContext = null;
            controller.isRecording = true;
            controller.saveCurrentRecordingChunk = jest.fn().mockResolvedValue(undefined);
            controller.stopAutoSaveTimer = jest.fn();
            controller.stopRecordingTimer = jest.fn();
            controller.stopVisualization = jest.fn();
            controller.stopOngoingTranscription = jest.fn();
            controller.updateRecordingUI = jest.fn();
            controller.audioContext = { close: jest.fn() };

            await controller.stopRecording();

            expect(micStream.getTracks()[0].stop).toHaveBeenCalled();
            expect(sysStream.getTracks()[0].stop).toHaveBeenCalled();
        });
    });
});
