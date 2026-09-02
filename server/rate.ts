export function medianRate(counts: number[]) {
  const sorted = counts.filter(count => count > 0).sort((a, b) => a - b);
  return sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0;
}

export function completedObservedMinuteRate(
  postsCount: number,
  observedSeconds: number,
  fallback: number,
) {
  if (observedSeconds < 45) return fallback;
  return Math.round(postsCount * 60 / observedSeconds);
}
