/**
 * SentimentDistributionCard.tsx - Vertical Stacked Bar Chart
 *
 * Shows sentiment distribution with:
 * - Stacked vertical bar (positive/neutral/negative)
 * - Live counts and percentages
 * - Swiss Design color palette
 */

import { DataCard } from '../DataCard';

interface SentimentCounts {
  positive: number;
  neutral: number;
  negative: number;
}

interface SentimentDistributionCardProps {
  sentimentCounts: SentimentCounts;
  className?: string;
}

export function SentimentDistributionCard({
  sentimentCounts,
  className,
}: SentimentDistributionCardProps) {
  const total =
    (sentimentCounts?.positive || 0) +
    (sentimentCounts?.neutral || 0) +
    (sentimentCounts?.negative || 0);

  const posPercent = total > 0 ? ((sentimentCounts?.positive || 0) / total) * 100 : 0;
  const neuPercent = total > 0 ? ((sentimentCounts?.neutral || 0) / total) * 100 : 0;
  const negPercent = total > 0 ? ((sentimentCounts?.negative || 0) / total) * 100 : 0;

  return (
    <DataCard title="Sentiment Distribution" className={className}>
      <div className="flex flex-col items-center gap-6">
        {/* Stacked Vertical Bar */}
        <div className="w-24 h-64 border-2 border-foreground relative flex flex-col">
          {/* Positive (top) */}
          <div
            className="w-full transition-all duration-500 border-b border-foreground"
            style={{
              height: `${posPercent}%`,
              background:
                'linear-gradient(180deg, oklch(0.8 0.25 145) 0%, oklch(0.7 0.2 145) 100%)',
            }}
          />
          {/* Neutral (middle) */}
          <div
            className="w-full transition-all duration-500 border-b border-foreground"
            style={{
              height: `${neuPercent}%`,
              background:
                'linear-gradient(180deg, oklch(0.7 0.08 90) 0%, oklch(0.6 0.05 90) 100%)',
            }}
          />
          {/* Negative (bottom) */}
          <div
            className="w-full transition-all duration-500"
            style={{
              height: `${negPercent}%`,
              background:
                'linear-gradient(180deg, oklch(0.65 0.25 25) 0%, oklch(0.55 0.22 25) 100%)',
            }}
          />
        </div>

        {/* Legend */}
        <div className="space-y-3 w-full">
          <div className="flex justify-between items-baseline">
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4"
                style={{ background: 'oklch(0.75 0.22 145)' }}
              />
              <span className="text-xs font-bold uppercase tracking-wider">
                POSITIVE
              </span>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold tabular-nums">
                {(sentimentCounts?.positive || 0).toLocaleString()}
              </div>
              <div className="text-xs opacity-60">{posPercent.toFixed(1)}%</div>
            </div>
          </div>

          <div className="flex justify-between items-baseline">
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4"
                style={{ background: 'oklch(0.65 0.06 90)' }}
              />
              <span className="text-xs font-bold uppercase tracking-wider">
                NEUTRAL
              </span>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold tabular-nums">
                {(sentimentCounts?.neutral || 0).toLocaleString()}
              </div>
              <div className="text-xs opacity-60">{neuPercent.toFixed(1)}%</div>
            </div>
          </div>

          <div className="flex justify-between items-baseline">
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4"
                style={{ background: 'oklch(0.6 0.23 25)' }}
              />
              <span className="text-xs font-bold uppercase tracking-wider">
                NEGATIVE
              </span>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold tabular-nums">
                {(sentimentCounts?.negative || 0).toLocaleString()}
              </div>
              <div className="text-xs opacity-60">{negPercent.toFixed(1)}%</div>
            </div>
          </div>
        </div>
      </div>
    </DataCard>
  );
}
