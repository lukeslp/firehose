import { describe, expect, it } from 'vitest';
import { STREAM_STALL_MS, streamRestartReason } from './streamHealth';

describe('stream health', () => {
  it('restarts an open socket that has been silent past the stall window', () => {
    expect(streamRestartReason(true, false, 0, STREAM_STALL_MS)).toBeNull();
    expect(streamRestartReason(true, false, 0, STREAM_STALL_MS + 1)).toBe('silent');
  });

  it('restarts a connection attempt that never opens', () => {
    expect(streamRestartReason(false, false, 0, STREAM_STALL_MS + 1)).toBe('stuck connecting');
  });

  it('leaves a pending reconnect alone', () => {
    expect(streamRestartReason(false, true, 0, STREAM_STALL_MS * 10)).toBeNull();
  });
});
