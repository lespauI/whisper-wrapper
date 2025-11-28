const { RingBuffer } = require('../../../../src/renderer/utils/ringBuffer.js');

describe('RingBuffer', () => {
  test('constructor validation', () => {
    expect(() => new RingBuffer(0)).toThrow();
    expect(() => new RingBuffer(-1)).toThrow();
    expect(new RingBuffer(1).capacity).toBe(1);
  });

  test('push/getAll preserves order and overwrites oldest', () => {
    const rb = new RingBuffer(3);
    rb.push(1); rb.push(2);
    expect(rb.getAll()).toEqual([1,2]);
    rb.push(3);
    expect(rb.getAll()).toEqual([1,2,3]);
    rb.push(4); // overwrite 1
    expect(rb.getAll()).toEqual([2,3,4]);
    rb.push(5); // overwrite 2
    expect(rb.getAll()).toEqual([3,4,5]);
  });

  test('getRecent and peekLast', () => {
    const rb = new RingBuffer(4);
    [10, 20, 30].forEach(v => rb.push(v));
    expect(rb.peekLast()).toBe(30);
    expect(rb.getRecent(2)).toEqual([20, 30]);
    rb.push(40); rb.push(50);
    expect(rb.getAll()).toEqual([20,30,40,50]);
    expect(rb.getRecent(3)).toEqual([30,40,50]);
  });

  test('clear resets state', () => {
    const rb = new RingBuffer(2);
    rb.push('a'); rb.push('b');
    expect(rb.size).toBe(2);
    rb.clear();
    expect(rb.size).toBe(0);
    expect(rb.getAll()).toEqual([]);
    expect(rb.peekLast()).toBeUndefined();
  });
});

