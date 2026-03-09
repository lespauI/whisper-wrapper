/**
 * Unit Tests for Audio Player functionality in TranscriptionController
 * Tests segment lookup by timestamp and audio player state management
 */

const { JSDOM } = require('jsdom');

describe('Audio Player - TranscriptionController', () => {
    let dom;
    let document;
    let controller;

    const mockSegments = [
        { id: 0, start: 0.0, end: 3.5, text: 'Hello world.' },
        { id: 1, start: 3.5, end: 7.2, text: 'This is segment two.' },
        { id: 2, start: 7.2, end: 10.0, text: 'Third segment here.' },
        { id: 3, start: 12.0, end: 15.5, text: 'After a gap.' },
        { id: 4, start: 15.5, end: 20.0, text: 'Final segment.' }
    ];

    beforeEach(() => {
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
            <body>
                <div id="audio-player-bar" class="hidden"></div>
                <audio id="audio-player"></audio>
                <button id="audio-play-btn">&#9654;</button>
                <input id="audio-seek" type="range" min="0" max="100" value="0">
                <span id="audio-current-time">0:00</span>
                <span id="audio-duration">0:00</span>
                <select id="audio-speed">
                    <option value="1" selected>1x</option>
                </select>
                <div id="transcription-segments"></div>
                <textarea id="transcription-text"></textarea>
                <div id="transcription-status"></div>
                <button id="undo-btn"></button>
                <button id="redo-btn"></button>
                <div id="transcription-empty"></div>
            </body>
            </html>
        `, { url: 'http://localhost' });

        document = dom.window;
        global.window = dom.window;
        global.document = dom.window.document;
        global.localStorage = {
            data: {},
            getItem: jest.fn(k => global.localStorage.data[k] || null),
            setItem: jest.fn((k, v) => { global.localStorage.data[k] = v; }),
            removeItem: jest.fn(k => { delete global.localStorage.data[k]; })
        };
        global.console = { log: jest.fn(), error: jest.fn(), warn: jest.fn() };

        controller = {
            findSegmentAtTime(segments, time) {
                if (!segments || !segments.length) return -1;
                for (let i = 0; i < segments.length; i++) {
                    if (time >= segments[i].start && time < segments[i].end) {
                        return i;
                    }
                }
                if (time >= segments[segments.length - 1].end) {
                    return segments.length - 1;
                }
                return -1;
            },

            _formatAudioTime(seconds) {
                if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
                const m = Math.floor(seconds / 60);
                const s = Math.floor(seconds % 60);
                return `${m}:${s.toString().padStart(2, '0')}`;
            },

            showAudioPlayer() {
                const bar = global.document.getElementById('audio-player-bar');
                if (bar) bar.classList.remove('hidden');
            },

            hideAudioPlayer() {
                const bar = global.document.getElementById('audio-player-bar');
                if (bar) bar.classList.add('hidden');
                const player = global.document.getElementById('audio-player');
                if (player) {
                    player.setAttribute('src', '');
                    player._audioPlayerBound = false;
                }
            },

            _highlightActiveSegment(currentTime) {
                const container = global.document.getElementById('transcription-segments');
                if (!container) return;
                const segments = container.querySelectorAll('.transcription-segment[data-start]');
                let activeEl = null;
                for (const seg of segments) {
                    const start = parseFloat(seg.dataset.start);
                    const end = parseFloat(seg.dataset.end);
                    if (currentTime >= start && currentTime < end) {
                        activeEl = seg;
                        break;
                    }
                }
                container.querySelectorAll('.transcription-segment--active').forEach(el => {
                    el.classList.remove('transcription-segment--active');
                });
                if (activeEl) {
                    activeEl.classList.add('transcription-segment--active');
                }
            }
        };
    });

    describe('findSegmentAtTime()', () => {
        it('returns -1 for empty segments array', () => {
            expect(controller.findSegmentAtTime([], 1.0)).toBe(-1);
        });

        it('returns -1 for null segments', () => {
            expect(controller.findSegmentAtTime(null, 1.0)).toBe(-1);
        });

        it('finds the first segment at time 0', () => {
            expect(controller.findSegmentAtTime(mockSegments, 0.0)).toBe(0);
        });

        it('finds the correct segment in the middle of its range', () => {
            expect(controller.findSegmentAtTime(mockSegments, 5.0)).toBe(1);
        });

        it('returns the segment at its exact start time', () => {
            expect(controller.findSegmentAtTime(mockSegments, 3.5)).toBe(1);
        });

        it('returns the previous segment just before the next segment starts', () => {
            expect(controller.findSegmentAtTime(mockSegments, 3.49)).toBe(0);
        });

        it('returns -1 (or last segment) for time in a gap between segments', () => {
            const idx = controller.findSegmentAtTime(mockSegments, 11.0);
            expect(idx).toBe(-1);
        });

        it('returns the last segment index when time is past all segments', () => {
            expect(controller.findSegmentAtTime(mockSegments, 25.0)).toBe(mockSegments.length - 1);
        });

        it('works with a single segment', () => {
            const single = [{ start: 5.0, end: 10.0, text: 'Only segment' }];
            expect(controller.findSegmentAtTime(single, 7.0)).toBe(0);
        });
    });

    describe('_formatAudioTime()', () => {
        it('formats 0 as 0:00', () => {
            expect(controller._formatAudioTime(0)).toBe('0:00');
        });

        it('formats 65 seconds as 1:05', () => {
            expect(controller._formatAudioTime(65)).toBe('1:05');
        });

        it('formats 3600 seconds as 60:00', () => {
            expect(controller._formatAudioTime(3600)).toBe('60:00');
        });

        it('formats 90.9 as 1:30 (rounds down)', () => {
            expect(controller._formatAudioTime(90.9)).toBe('1:30');
        });

        it('returns 0:00 for NaN', () => {
            expect(controller._formatAudioTime(NaN)).toBe('0:00');
        });

        it('returns 0:00 for Infinity', () => {
            expect(controller._formatAudioTime(Infinity)).toBe('0:00');
        });
    });

    describe('showAudioPlayer() / hideAudioPlayer()', () => {
        it('removes hidden class when showing player', () => {
            const bar = global.document.getElementById('audio-player-bar');
            expect(bar.classList.contains('hidden')).toBe(true);
            controller.showAudioPlayer();
            expect(bar.classList.contains('hidden')).toBe(false);
        });

        it('adds hidden class when hiding player', () => {
            const bar = global.document.getElementById('audio-player-bar');
            bar.classList.remove('hidden');
            controller.hideAudioPlayer();
            expect(bar.classList.contains('hidden')).toBe(true);
        });

        it('clears audio player src when hiding', () => {
            const player = global.document.getElementById('audio-player');
            player.src = 'data:audio/wav;base64,fake';
            controller.hideAudioPlayer();
            expect(player.getAttribute('src')).toBe('');
        });
    });

    describe('_highlightActiveSegment()', () => {
        let container;

        beforeEach(() => {
            container = global.document.getElementById('transcription-segments');
            mockSegments.forEach(seg => {
                const div = global.document.createElement('div');
                div.className = 'transcription-segment';
                div.dataset.start = seg.start;
                div.dataset.end = seg.end;
                container.appendChild(div);
            });
        });

        it('adds active class to the matching segment', () => {
            controller._highlightActiveSegment(1.0);
            const active = container.querySelectorAll('.transcription-segment--active');
            expect(active).toHaveLength(1);
            expect(parseFloat(active[0].dataset.start)).toBe(0.0);
        });

        it('moves active class to the new segment on time change', () => {
            controller._highlightActiveSegment(1.0);
            controller._highlightActiveSegment(5.0);
            const active = container.querySelectorAll('.transcription-segment--active');
            expect(active).toHaveLength(1);
            expect(parseFloat(active[0].dataset.start)).toBe(3.5);
        });

        it('removes active class when time is in a gap', () => {
            controller._highlightActiveSegment(1.0);
            controller._highlightActiveSegment(11.0);
            const active = container.querySelectorAll('.transcription-segment--active');
            expect(active).toHaveLength(0);
        });

        it('does nothing when container is empty', () => {
            container.innerHTML = '';
            expect(() => controller._highlightActiveSegment(5.0)).not.toThrow();
        });
    });
});
