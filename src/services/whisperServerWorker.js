const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const { randomBytes } = require('crypto');

class WhisperServerWorker {
    constructor(binary, model, options = {}) {
        this.binary = binary;
        this.model = model;
        this.options = options;
        this.prefix = `/worker-${randomBytes(16).toString('hex')}`;
        this.requests = new Set();
        this.closed = false;
        this.diagnostics = '';
    }

    async start() {
        if (this.closed) throw new Error('Whisper worker has been closed');
        if (!this.starting) this.starting = this.launch();
        await this.starting;
        if (this.failure) throw this.failure;
    }

    async launch() {
        this.port = await new Promise((resolve, reject) => {
            const reservation = net.createServer();
            reservation.once('error', reject);
            reservation.listen(0, '127.0.0.1', () => {
                const port = reservation.address().port;
                reservation.close(error => error ? reject(error) : resolve(port));
            });
        });
        if (this.closed) throw new Error('Whisper worker has been closed');
        const args = ['-m', this.model, '-t', String(this.options.threads || 4),
            '--host', '127.0.0.1', '--port', String(this.port), '--request-path', this.prefix];
        if (this.options.useGpu === false) args.push('--no-gpu');
        else args.push('--device', String(this.options.gpuDevice || 0));
        args.push(this.options.flashAttn === false ? '--no-flash-attn' : '--flash-attn');
        this.process = spawn(this.binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        this.exitHandler = () => this.process.kill('SIGKILL');
        process.once('exit', this.exitHandler);
        this.process.once('exit', () => process.removeListener('exit', this.exitHandler));
        const capture = data => { this.diagnostics = (this.diagnostics + data.toString()).slice(-8192); };
        this.process.stdout.on('data', capture);
        this.process.stderr.on('data', capture);
        const fail = message => {
            this.failure = new Error(`${message}: ${this.diagnostics.trim()}`);
            for (const request of this.requests) request.destroy(this.failure);
        };
        this.process.once('error', error => fail(`Failed to start whisper-server (${error.message})`));
        this.process.once('exit', (code, signal) => {
            if (!this.closed) fail(`whisper-server exited (${signal || code})`);
        });
        const deadline = Date.now() + (this.options.startupTimeout || 60000);
        try {
            while (Date.now() < deadline) {
                if (this.closed || this.failure) throw this.failure || new Error('Whisper worker has been closed');
                try {
                    const status = await this.request('GET', '/health', [], null, 500);
                    if (status.status === 'ok') return;
                } catch (error) {
                    if (this.failure) throw this.failure;
                    if (!['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT'].includes(error.code)) throw error;
                }
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            throw new Error('Timed out loading the resident Whisper model');
        } catch (error) {
            this.close();
            throw error;
        }
    }

    request(method, route, parts, contentType, timeout) {
        return new Promise((resolve, reject) => {
            if (this.closed) return reject(new Error('Whisper worker has been closed'));
            const headers = contentType ? {
                'Content-Type': contentType,
                'Content-Length': parts.reduce((sum, part) => sum + part.length, 0)
            } : {};
            const request = http.request({ hostname: '127.0.0.1', port: this.port,
                path: this.prefix + route, method, headers }, response => {
                const chunks = [];
                let bytes = 0;
                response.on('data', chunk => {
                    bytes += chunk.length;
                    if (bytes > 32 * 1024 * 1024) request.destroy(new Error('Whisper response exceeds 32 MB'));
                    else chunks.push(chunk);
                });
                response.on('error', reject);
                response.on('aborted', () => reject(new Error('Whisper response was interrupted')));
                response.on('end', () => {
                    try {
                        const result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
                        if (response.statusCode !== 200) throw new Error(`Whisper HTTP ${response.statusCode}: ${result.error || 'inference failed'}`);
                        resolve(result);
                    } catch (error) { reject(error); }
                });
            });
            this.requests.add(request);
            request.once('close', () => this.requests.delete(request));
            request.once('error', reject);
            request.setTimeout(timeout, () => {
                const error = new Error('Whisper request timed out');
                error.code = 'ETIMEDOUT';
                request.destroy(error);
            });
            for (const part of parts) request.write(part);
            request.end();
        });
    }

    async infer(audioParts, fields) {
        await this.start();
        const boundary = `whisper-${randomBytes(16).toString('hex')}`;
        const parts = Object.entries(fields).map(([name, value]) => Buffer.from(
            `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
        parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.wav"\r\nContent-Type: audio/wav\r\n\r\n`),
            ...audioParts, Buffer.from(`\r\n--${boundary}--\r\n`));
        return this.request('POST', '/inference', parts, `multipart/form-data; boundary=${boundary}`,
            this.options.requestTimeout || 30 * 60 * 1000);
    }

    close() {
        this.closed = true;
        if (this.exitHandler && (!this.process || this.process.exitCode !== null || this.process.signalCode !== null)) {
            process.removeListener('exit', this.exitHandler);
        }
        for (const request of this.requests) request.destroy(new Error('Whisper worker has been closed'));
        if (this.process && this.process.exitCode === null && this.process.signalCode === null) {
            this.process.kill('SIGTERM');
            const process = this.process;
            const timer = setTimeout(() => {
                if (process.exitCode === null && process.signalCode === null) process.kill('SIGKILL');
            }, 2000);
            timer.unref();
            process.once('exit', () => clearTimeout(timer));
        }
    }
}

module.exports = { WhisperServerWorker };
