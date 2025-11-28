/**
 * Simple fixed-size ring buffer for recent items (frames, decisions, etc.).
 * Preserves insertion order; overwrites oldest when capacity exceeded.
 */

export class RingBuffer {
    /**
     * @param {number} capacity
     */
    constructor(capacity) {
        if (!Number.isFinite(capacity) || capacity <= 0) {
            throw new Error('RingBuffer capacity must be > 0');
        }
        this._buf = new Array(capacity);
        this._cap = capacity;
        this._size = 0;
        this._head = 0; // next write index
    }

    get capacity() { return this._cap; }
    get size() { return this._size; }
    isFull() { return this._size === this._cap; }
    isEmpty() { return this._size === 0; }

    clear() {
        this._buf = new Array(this._cap);
        this._size = 0;
        this._head = 0;
    }

    /**
     * Push a value, overwriting oldest if buffer is full.
     * @param {*} value
     */
    push(value) {
        this._buf[this._head] = value;
        this._head = (this._head + 1) % this._cap;
        if (this._size < this._cap) {
            this._size++;
        }
    }

    /**
     * Get items from oldest to newest as a new array.
     * @returns {Array<*>}
     */
    getAll() {
        const out = new Array(this._size);
        const start = this._size === this._cap ? this._head : 0;
        for (let i = 0; i < this._size; i++) {
            out[i] = this._buf[(start + i) % this._cap];
        }
        return out;
    }

    /**
     * Get the most recent N items (<= size), newest last.
     * @param {number} n
     */
    getRecent(n) {
        const k = Math.max(0, Math.min(n | 0, this._size));
        const out = new Array(k);
        const endIndex = (this._head - 1 + this._cap) % this._cap; // newest index
        for (let i = k - 1; i >= 0; i--) {
            const idx = (endIndex - (k - 1 - i) + this._cap) % this._cap;
            out[i] = this._buf[idx];
        }
        return out;
    }

    /**
     * Peek last pushed item, or undefined.
     */
    peekLast() {
        if (this._size === 0) return undefined;
        const idx = (this._head - 1 + this._cap) % this._cap;
        return this._buf[idx];
    }
}

