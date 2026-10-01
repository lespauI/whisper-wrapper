jest.mock('child_process', () => ({ spawn: jest.fn() }));
jest.mock('http', () => ({ request: jest.fn() }));
jest.mock('net', () => ({ createServer: jest.fn() }));
const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const { WhisperServerWorker } = require('../../src/services/whisperServerWorker');

describe('Whisper server lifecycle and protocol', () => {
    let worker;
    let process;
    let replies;
    let requests;

    beforeEach(() => {
        jest.resetAllMocks();
        replies = [];
        requests = [];
        net.createServer.mockImplementation(() => {
            const server = new EventEmitter();
            server.listen = jest.fn((port, host, callback) => setImmediate(callback));
            server.address = () => ({ port: 12345 });
            server.close = jest.fn(callback => callback());
            return server;
        });
        spawn.mockImplementation(() => {
            process = new EventEmitter();
            process.stdout = new EventEmitter();
            process.stderr = new EventEmitter();
            process.exitCode = null;
            process.signalCode = null;
            process.kill = jest.fn(signal => {
                process.signalCode = signal;
                process.emit('exit', null, signal);
            });
            return process;
        });
        http.request.mockImplementation((options, callback) => {
            const request = new EventEmitter();
            request.options = options;
            request.parts = [];
            request.write = part => request.parts.push(part);
            request.setTimeout = jest.fn((timeout, action) => { request.timeoutAction = action; });
            request.destroy = jest.fn(error => {
                if (error) request.emit('error', error);
                request.emit('close');
            });
            request.end = () => setImmediate(() => {
                const reply = options.method === 'GET' ? { body: { status: 'ok' } } : replies.shift() || { body: { segments: [] } };
                if (reply.pending) return;
                if (reply.error) { request.destroy(reply.error); return; }
                const response = new EventEmitter();
                response.statusCode = reply.status || 200;
                callback(response);
                response.emit('data', Buffer.from(reply.raw || JSON.stringify(reply.body)));
                response.emit('end');
                request.emit('close');
            });
            requests.push(request);
            return request;
        });
        worker = new WhisperServerWorker('/bin/whisper-server', '/models/large',
            { threads: 8, useGpu: true, gpuDevice: 1, flashAttn: true });
    });

    afterEach(() => worker.close());

    it('loads a model once for concurrent starts and repeated inference requests', async () => {
        await Promise.all([worker.start(), worker.start()]);
        await worker.infer([Buffer.from('WAV')], { language: 'ru' });
        await worker.infer([Buffer.from('WAV')], { language: 'en' });
        expect(spawn).toHaveBeenCalledTimes(1);
        expect(spawn.mock.calls[0][1]).toEqual(expect.arrayContaining(['-m', '/models/large', '-t', '8', '--device', '1', '--flash-attn']));
        expect(requests.map(request => request.options.method)).toEqual(['GET', 'POST', 'POST']);
    });

    it('binds to loopback and uses a private random request prefix', async () => {
        await worker.start();
        expect(spawn.mock.calls[0][1]).toEqual(expect.arrayContaining(['--host', '127.0.0.1']));
        expect(requests[0].options.hostname).toBe('127.0.0.1');
        expect(requests[0].options.path).toMatch(/^\/worker-[a-f0-9]{32}\/health$/);
    });

    it('sends PCM parts without a conversion process or a model load endpoint', async () => {
        const header = Buffer.from('HEADER');
        const samples = Buffer.from('SAMPLES');
        await worker.infer([header, samples], { language: 'en', prompt: 'München', max_context: 0 });
        const request = requests[1];
        expect(request.parts).toContain(header);
        expect(request.parts).toContain(samples);
        expect(request.options.headers['Content-Length']).toBe(Buffer.concat(request.parts).length);
        expect(Buffer.concat(request.parts).toString()).toContain('München');
        expect(request.options.path).toBe(worker.prefix + '/inference');
        expect(spawn).toHaveBeenCalledTimes(1);
    });

    it('supports CPU mode and disabled flash attention', async () => {
        worker.close();
        worker = new WhisperServerWorker('/server', '/tiny', { useGpu: false, flashAttn: false });
        await worker.start();
        expect(spawn.mock.calls[0][1]).toEqual(expect.arrayContaining(['--no-gpu', '--no-flash-attn']));
        expect(spawn.mock.calls[0][1]).not.toContain('--device');
    });

    it('propagates HTTP inference errors and malformed JSON', async () => {
        replies.push({ status: 500, body: { error: 'failed to process audio' } }, { raw: '{broken' });
        await expect(worker.infer([Buffer.from('audio')], {})).rejects.toThrow('HTTP 500');
        await expect(worker.infer([Buffer.from('audio')], {})).rejects.toThrow();
    });

    it('propagates connection errors', async () => {
        replies.push({ error: new Error('connection reset') });
        await expect(worker.infer([Buffer.from('audio')], {})).rejects.toThrow('connection reset');
    });

    it('aborts active inference when the child crashes and retains bounded diagnostics', async () => {
        await worker.start();
        replies.push({ pending: true });
        const pending = worker.infer([Buffer.from('audio')], {});
        await new Promise(resolve => setImmediate(resolve));
        process.stderr.emit('data', Buffer.from('x'.repeat(9000) + ' Metal allocation failed'));
        process.emit('exit', 1, null);
        await expect(pending).rejects.toThrow('Metal allocation failed');
        expect(worker.diagnostics.length).toBeLessThanOrEqual(8192);
        await expect(worker.start()).rejects.toThrow('exited');
    });

    it('reports process spawn failures and stops the worker', async () => {
        spawn.mockImplementationOnce(() => {
            process = new EventEmitter();
            process.stdout = new EventEmitter();
            process.stderr = new EventEmitter();
            process.kill = jest.fn();
            setImmediate(() => process.emit('error', new Error('ENOEXEC')));
            return process;
        });
        await expect(worker.start()).rejects.toThrow('ENOEXEC');
        expect(worker.closed).toBe(true);
    });

    it('rejects timed out requests', async () => {
        await worker.start();
        replies.push({ pending: true });
        const pending = worker.infer([Buffer.from('audio')], {});
        await new Promise(resolve => setImmediate(resolve));
        requests.at(-1).timeoutAction();
        await expect(pending).rejects.toThrow('timed out');
    });

    it('kills the child and rejects outstanding work on cleanup', async () => {
        await worker.start();
        replies.push({ pending: true });
        const pending = worker.infer([Buffer.from('audio')], {});
        await new Promise(resolve => setImmediate(resolve));
        worker.close();
        await expect(pending).rejects.toThrow('closed');
        expect(process.kill).toHaveBeenCalledWith('SIGTERM');
        await expect(worker.start()).rejects.toThrow('closed');
    });

    it('times out startup and releases the child when health never becomes ready', async () => {
        worker.options.startupTimeout = 1;
        const original = http.request.getMockImplementation();
        http.request.mockImplementation((options, callback) => {
            const request = original(options, callback);
            request.end = () => setImmediate(() => {
                const response = new EventEmitter();
                response.statusCode = 200;
                callback(response);
                response.emit('data', Buffer.from('{"status":"loading"}'));
                response.emit('end');
                request.emit('close');
            });
            return request;
        });
        await expect(worker.start()).rejects.toThrow('Timed out loading');
        expect(process.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('retries connection refused during startup without spawning another process', async () => {
        const original = http.request.getMockImplementation();
        let first = true;
        http.request.mockImplementation((options, callback) => {
            const request = original(options, callback);
            if (first) {
                first = false;
                request.end = () => setImmediate(() => {
                    const error = new Error('not ready');
                    error.code = 'ECONNREFUSED';
                    request.destroy(error);
                });
            }
            return request;
        });
        await worker.start();
        expect(spawn).toHaveBeenCalledTimes(1);
        expect(requests).toHaveLength(2);
    });

    it('escalates cleanup to SIGKILL for an unresponsive child', async () => {
        await worker.start();
        jest.useFakeTimers();
        try {
            process.kill.mockImplementation(() => undefined);
            worker.close();
            expect(require('process').listeners('exit')).toContain(worker.exitHandler);
            jest.advanceTimersByTime(2000);
            expect(process.kill.mock.calls).toEqual([['SIGTERM'], ['SIGKILL']]);
            process.signalCode = 'SIGKILL';
            process.emit('exit', null, 'SIGKILL');
            expect(require('process').listeners('exit')).not.toContain(worker.exitHandler);
        } finally { jest.useRealTimers(); }
    });

    it('kills a resident child on parent exit and removes the hook on cleanup', async () => {
        await worker.start();
        const parent = require('process');
        expect(parent.listeners('exit')).toContain(worker.exitHandler);
        worker.exitHandler();
        expect(process.kill).toHaveBeenCalledWith('SIGKILL');
        worker.close();
        expect(parent.listeners('exit')).not.toContain(worker.exitHandler);
    });
});
