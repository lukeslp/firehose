/**
 * SentimentTimelineCard.tsx - Real-time Sentiment Area Chart
 *
 * Shows sentiment percentages over last 60 minutes
 * Uses Recharts AreaChart with stacked areas
 */

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import { DataCard } from '../DataCard';

interface SentimentTimelineData {
  timestamp: number;
  positivePercent: number;
  neutralPercent: number;
  negativePercent: number;
}

interface SentimentTimelineCardProps {
  data: SentimentTimelineData[];
  className?: string;
}

export function SentimentTimelineCard({
  data,
  className,
}: SentimentTimelineCardProps) {
  // Prepare chart data
  const chartData = data.map((d) => {
    const date = new Date(d.timestamp);
    return {
      time: date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      positive: d.positivePercent,
      neutral: d.neutralPercent,
      negative: d.negativePercent,
    };
  });

  return (
    <DataCard
      title="Sentiment Timeline (Last 60 Min)"
      className={className}
      defaultExpanded
    >
      {chartData.length === 0 ? (
        <div className="py-12 text-center text-xs uppercase tracking-wider opacity-40">
          WAITING FOR DATA
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorPositive" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="oklch(0.7 0.2 145)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="oklch(0.7 0.2 145)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="colorNeutral" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="oklch(0.6 0.05 90)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="oklch(0.6 0.05 90)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="colorNegative" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="oklch(0.55 0.22 25)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="oklch(0.55 0.22 25)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="0" stroke="currentColor" strokeOpacity={0.1} />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10 }}
              stroke="currentColor"
              interval="preserveStartEnd"
            />
            <YAxis tick={{ fontSize: 10 }} stroke="currentColor" />
            <Area
              type="monotone"
              dataKey="positive"
              stackId="1"
              stroke="oklch(0.7 0.2 145)"
              strokeWidth={2}
              fill="url(#colorPositive)"
              animationDuration={800}
            />
            <Area
              type="monotone"
              dataKey="neutral"
              stackId="1"
              stroke="oklch(0.6 0.05 90)"
              strokeWidth={2}
              fill="url(#colorNeutral)"
              animationDuration={800}
            />
            <Area
              type="monotone"
              dataKey="negative"
              stackId="1"
              stroke="oklch(0.55 0.22 25)"
              strokeWidth={2}
              fill="url(#colorNegative)"
              animationDuration={800}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </DataCard>
  );
}
