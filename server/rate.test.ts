import { describe, expect, it } from 'vitest';
import { completedObservedMinuteRate, medianRate } from './rate';

describe('rate continuity', () => {
  it('uses a median so a partial persisted minute does not tank startup rate', () => {
    expect(medianRate([2747, 2689, 2546, 2601, 2])).toBe(2601);
  });

  it('does not replace a healthy fallback with a short restart fragment', () => {
    expect(completedObservedMinuteRate(2, 3, 2601)).toBe(2601);
    expect(completedObservedMinuteRate(2000, 50, 2601)).toBe(2400);
  });
});
