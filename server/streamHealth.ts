// Jetstream sends several events a second, so a socket with no frame (or, while
// connecting, no progress) for this long is dead. On Oct 14, 2026 both upstream
// sockets went silent without a close frame and stayed OPEN for 18 days.
export const STREAM_STALL_MS = 60_000;
export const STREAM_WATCHDOG_MS = 30_000;

export type StreamRestartReason = 'silent' | 'stuck connecting';

export function streamRestartReason(
  open: boolean,
  reconnectPending: boolean,
  lastActivityAt: number,
  now: number,
  stallMs = STREAM_STALL_MS,
): StreamRestartReason | null {
  if (reconnectPending || now - lastActivityAt <= stallMs) return null;
  return open ? 'silent' : 'stuck connecting';
}
