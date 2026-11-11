const { afterEach, describe, expect, it, jest: jestApi } = require('@jest/globals');
const { RecordingController } = require('../../../src/renderer/controllers/RecordingController.js');
const { UIHelpers } = require('../../../src/renderer/utils/UIHelpers.js');

describe('partial recording transcription', () => {
    afterEach(() => {
        delete global.window;
        jestApi.restoreAllMocks();
    });

    it('keeps partial metadata in app state and warns the user', async () => {
        const transcriptionResult = {
            success: true,
            status: 'partial',
            partial: true,
            issues: [{ code: 'decoder_recovery_failed', start: 3, end: 8 }],
            resumeId: 'resume-id',
            text: 'Recovered words',
            segments: [],
            audioDurationSeconds: 60,
            processingDurationMs: 1500
        };
        const appState = { setTranscriptionState: jestApi.fn() };
        const statusController = {
            beginTranscription: () => ({ canceled: false }),
            endTranscription: jestApi.fn(),
            showWarning: jestApi.fn(),
            updateStatus: jestApi.fn(),
            updateTranscriptionProgress: jestApi.fn()
        };
        const tabController = { switchTab: jestApi.fn() };
        const controller = Object.create(RecordingController.prototype);
        Object.assign(controller, {
            appState,
            statusController,
            tabController,
            recordingBlob: { arrayBuffer: jestApi.fn().mockResolvedValue(new ArrayBuffer(4)) },
            recordingTranscription: null
        });
        global.window = {
            electronAPI: {
                onTranscriptionProgress: jestApi.fn().mockReturnValue(jestApi.fn()),
                transcribeAudio: jestApi.fn().mockResolvedValue(transcriptionResult)
            },
            whisperApp: {
                controllers: { fileUpload: { showTranscriptionResult: jestApi.fn() } }
            }
        };

        await controller.transcribeRecording();

        expect(appState.setTranscriptionState).toHaveBeenCalledWith(expect.objectContaining({
            status: 'partial',
            partial: true,
            issues: transcriptionResult.issues,
            resumeId: 'resume-id',
            audioDurationSeconds: 60,
            processingDurationMs: 1500
        }));
        expect(statusController.showWarning).toHaveBeenCalledWith(expect.stringContaining('partial'));
        expect(tabController.switchTab).toHaveBeenCalled();
    });

    it('retains partial metadata from a background audio segment', async () => {
        const issue = { code: 'decoder_recovery_failed', start: 1, end: 2 };
        const controller = Object.create(RecordingController.prototype);
        controller.ongoingTranscription = {
            enabled: true,
            processingQueue: true,
            chunkQueue: [{ chunkNumber: 4, blob: { arrayBuffer: jestApi.fn().mockResolvedValue(new ArrayBuffer(4)) } }],
            transcriptionText: '',
            chunks: [],
            partial: false,
            status: 'complete',
            issues: [],
            resumeIds: []
        };
        controller.statusController = {
            beginTranscription: () => ({ canceled: false }),
            endTranscription: jestApi.fn()
        };
        controller._segmentChunkToWavs = jestApi.fn().mockResolvedValue({
            wavBuffers: [new ArrayBuffer(1)],
            segments: [{ startMs: 0, endMs: 2000 }]
        });
        controller.generateContextPrompt = () => null;
        controller.updateOngoingTranscriptionDisplay = jestApi.fn();
        jestApi.spyOn(UIHelpers, 'setText').mockImplementation(() => {});
        global.window = {
            electronAPI: {
                transcribeAudio: jestApi.fn(async () => {
                    controller.ongoingTranscription.enabled = false;
                    return {
                        success: true,
                        status: 'partial',
                        partial: true,
                        issues: [issue],
                        resumeId: 'segment-resume-id',
                        text: '[Review required]'
                    };
                })
            }
        };

        await controller.processTranscriptionQueue();

        expect(controller.ongoingTranscription).toMatchObject({
            status: 'partial',
            partial: true,
            issues: [{ ...issue, chunkNumber: 4, segmentNumber: 1 }],
            resumeIds: ['segment-resume-id']
        });
    });
});
